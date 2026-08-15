import Phaser from 'phaser';
import { SoundGarden } from '../audio/SoundGarden';
import { DinoNeed, GameModel, loadProgress, saveProgress, SAVE_KEY } from '../game/GameModel';

const WIDTH = 1280;
const HEIGHT = 720;
const FIELD = { left: 70, right: 1210, top: 115, bottom: 580 };
const DINO_SCALE = 1;
const EGG_SCALE = 1;
const REWARD_EGG_SCALE = 0.72;
const BALL_TRAY_SCALE = 1;
const BALL_FIELD_SCALE = 1.06;
const DINO_RADIUS = 40;
const CARE_ITEM_RADIUS = 33;
const CARE_COLLISION_RADIUS = DINO_RADIUS + CARE_ITEM_RADIUS;
const CARE_ATTRACTION_RADIUS = 360;
const MUSIC_PROXIMITY_RADIUS = 125;
const EGG_COLLISION_RADIUS = 50;
const NEED_BUBBLE_OFFSET_Y = 73;
const NEED_BUBBLE_DEPTH = 680;
const REWARD_EGG_DEPTH = 640;
const EGG_HOME = { x: 490, y: 360 };
const REWARD_EGG_HOME = { x: 760, y: 285 };
const BALL_HOME = { x: 86, y: 650 };
const DRINK_HOME = { x: 170, y: 650 };
const FOOD_A_HOME = { x: 254, y: 650 };
const FOOD_B_HOME = { x: 338, y: 650 };
const SPEAKER_HOME = { x: 422, y: 650 };
const CANNON = { x: 640, y: 348 };
const FIRE_CONTROL = { x: 720, y: 650 };
const POWER_CONTROL = { left: 850, center: 960, y: 650 };
const CANNON_RADIUS = 58;
const CANNON_MUZZLE_DISTANCE = CANNON_RADIUS + CARE_ITEM_RADIUS + 5;
const CANNON_CHARGE_MS = 1700;
const PHYSICS_RESTITUTION = 0.9;
const PHYSICS_FRICTION = 0.4;
const PHYSICS_STOP_SPEED = 34;
const COLLISION_SKIN = 4;
const DINO_TINTS = [0x63c7d3, 0xf2a65a, 0x9bcf6b, 0xc89fe7, 0xe77f8f];

type InventoryItemKind = 'ball' | 'drink' | 'food-a' | 'food-b' | 'speaker';

interface CannonShot {
  kind: InventoryItemKind;
  item: Phaser.GameObjects.Image;
  power: number;
  vx: number;
  vy: number;
  age: number;
}

interface FieldMotion {
  item: Phaser.GameObjects.Image;
  radius: number;
  vx: number;
  vy: number;
  age: number;
}

interface DinoEntity {
  index: number;
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Graphics;
  reacting: boolean;
  bouncing: boolean;
  bounceVx: number;
  bounceVy: number;
  bounceAge: number;
  pausedForTest?: boolean;
  needTimer?: Phaser.Time.TimerEvent;
  roamTimer?: Phaser.Time.TimerEvent;
}

export class NurseryScene extends Phaser.Scene {
  private model!: GameModel;
  private sounds = new SoundGarden();
  private egg!: Phaser.GameObjects.Image;
  private rewardEgg!: Phaser.GameObjects.Image;
  private ball!: Phaser.GameObjects.Image;
  private drink!: Phaser.GameObjects.Image;
  private foodA!: Phaser.GameObjects.Image;
  private foodB!: Phaser.GameObjects.Image;
  private speaker!: Phaser.GameObjects.Image;
  private crack!: Phaser.GameObjects.Graphics;
  private rewardCrack!: Phaser.GameObjects.Graphics;
  private heartLabel!: Phaser.GameObjects.Text;
  private muteButton!: Phaser.GameObjects.Container;
  private dinos: DinoEntity[] = [];
  private eggBusy = false;
  private rewardEggBusy = false;
  private pendingEggTap = false;
  private pendingRewardEggTap = false;
  private eggMoved = false;
  private rewardEggMoved = false;
  private eggPress = { x: 0, y: 0 };
  private rewardEggPress = { x: 0, y: 0 };
  private lastEggTap = -Infinity;
  private lastRewardEggTap = -Infinity;
  private ballPlaced = false;
  private draggingBall = false;
  private lastBallBump = 0;
  private drinkPlaced = false;
  private draggingDrink = false;
  private lastDrinkBump = 0;
  private foodAPlaced = false;
  private draggingFoodA = false;
  private foodBPlaced = false;
  private draggingFoodB = false;
  private lastFoodBump = 0;
  private speakerPlaced = false;
  private draggingSpeaker = false;
  private lastMusicBump = 0;
  private collisionDebug!: Phaser.GameObjects.Graphics;
  private cannonAimGuide!: Phaser.GameObjects.Graphics;
  private cannonBarrel!: Phaser.GameObjects.Rectangle;
  private cannonPowerFill!: Phaser.GameObjects.Rectangle;
  private cannonFireButton!: Phaser.GameObjects.Rectangle;
  private cannonFireLabel!: Phaser.GameObjects.Text;
  private cannonAngle = -Math.PI / 2;
  private cannonLoadedKind?: InventoryItemKind;
  private cannonLoadedItem?: Phaser.GameObjects.Image;
  private cannonShot?: CannonShot;
  private cannonAiming = false;
  private cannonCharging = false;
  private cannonChargeStartedAt = 0;
  private cannonPower = 0;
  private lastCannonPower = 0;
  private lastCannonSpeed = 0;
  private lastShotWallBounces = 0;
  private lastShotHitDino = false;
  private lastDinoImpactSpeed = 0;
  private guideEnd = { x: CANNON.x, y: CANNON.y };
  private movingFieldObjects = new Map<Phaser.GameObjects.Image, FieldMotion>();
  private cannonDinoCollisions = 0;

  constructor() {
    super('NurseryScene');
  }

  create(): void {
    this.model = new GameModel(loadProgress(localStorage));
    this.createPlaceholderTextures();
    this.createMap();
    this.createCannon();
    this.createItemTray();
    this.createEggs();
    this.createProgress();
    this.createControls();
    this.input.on('pointerdown', () => this.sounds.unlock());

    if (this.model.mode === 'field') {
      this.egg.setVisible(false);
      for (let index = 0; index < this.model.dinoCount; index += 1) {
        const dino = this.spawnDino(index, this.spawnPointFor(index), false);
        this.scheduleRoam(dino, 900 + index * 350);
        if (!this.model.newEggUnlocked) this.scheduleNeed(dino, 600 + index * 350);
      }
      this.refreshRewardEgg();
    } else {
      this.rewardEgg.setVisible(false);
      this.ball.setAlpha(0.45);
      this.drink.setAlpha(0.45);
      this.foodA.setAlpha(0.45);
      this.foodB.setAlpha(0.45);
      this.speaker.setAlpha(0.45);
    }

    window.__DINOLAND__ = {
      getState: () => this.debugState(),
      forceNeed: (dinoIndex, need) => {
        const result = this.model.requestNeed(dinoIndex, need);
        const dino = this.dinos[dinoIndex];
        if (result && dino) this.showNeed(dino, result);
        return result;
      },
      pauseDino: (dinoIndex) => {
        const dino = this.dinos[dinoIndex];
        if (!dino) return;
        dino.pausedForTest = true;
        this.tweens.killTweensOf(dino.sprite);
        dino.roamTimer?.remove(false);
        dino.roamTimer = undefined;
        dino.bouncing = false;
        dino.bounceVx = 0;
        dino.bounceVy = 0;
        dino.bounceAge = 0;
        dino.sprite.setScale(DINO_SCALE).setAlpha(1).setAngle(0);
      },
      fulfillActiveNeed: (dinoIndex) => {
        const dino = this.dinos[dinoIndex];
        const need = this.model.needFor(dinoIndex);
        if (!dino || !need || !this.model.fulfillNeed(dinoIndex, need)) return false;
        this.completeNeed(dino);
        return true;
      },
      placeDino: (dinoIndex, x, y) => {
        const dino = this.dinos[dinoIndex];
        if (!dino) return false;
        dino.pausedForTest = true;
        dino.reacting = false;
        dino.bouncing = false;
        dino.bounceVx = 0;
        dino.bounceVy = 0;
        dino.bounceAge = 0;
        this.tweens.killTweensOf(dino.sprite);
        dino.roamTimer?.remove(false);
        dino.sprite.setPosition(
          Phaser.Math.Clamp(x, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS),
          Phaser.Math.Clamp(y, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS),
        );
        this.resolveDinoSeparation(dino);
        this.resolveEggCollision(dino);
        this.resolveWorldCollisions();
        return true;
      },
      launchDino: (dinoIndex, vx, vy) => {
        const dino = this.dinos[dinoIndex];
        if (!dino) return false;
        dino.pausedForTest = true;
        this.prepareDinoForBounce(dino);
        dino.bounceVx = vx;
        dino.bounceVy = vy;
        dino.bounceAge = 0;
        return true;
      },
      resumeDino: (dinoIndex) => {
        const dino = this.dinos[dinoIndex];
        if (!dino) return false;
        dino.pausedForTest = false;
        this.tweens.killTweensOf(dino.sprite);
        dino.roamTimer?.remove(false);
        this.scheduleRoam(dino, 0);
        return true;
      },
      placeCareItem: (kind, x, y) => this.placeCareItemForTest(kind, x, y),
    };
  }

  update(_time: number, delta: number): void {
    this.updateCannon(delta);
    this.updateDinoBounces(delta);
    for (const dino of this.dinos) {
      dino.sprite.setDepth(20 + Math.round(dino.sprite.y));
      this.positionNeedBubble(dino);
      const activeNeed = this.model.needFor(dino.index);
      if (activeNeed && (!dino.bubble.visible || dino.bubble.alpha < 0.99)) {
        this.showNeed(dino, activeNeed, true);
      }
    }
    if (this.ballPlaced) this.ball.setDepth(20 + Math.round(this.ball.y));
    if (this.drinkPlaced) this.drink.setDepth(20 + Math.round(this.drink.y));
    if (this.foodAPlaced) this.foodA.setDepth(20 + Math.round(this.foodA.y));
    if (this.foodBPlaced) this.foodB.setDepth(20 + Math.round(this.foodB.y));
    if (this.speakerPlaced) this.speaker.setDepth(20 + Math.round(this.speaker.y));
    this.resolveDinoSeparation();
    this.resolveWorldCollisions();
    this.drawCollisionDebug();
  }

  private debugState() {
    const first = this.dinos[0];
    const second = this.dinos[1];
    return {
      mode: this.model.mode,
      eggTaps: this.model.eggTaps,
      eggBusy: this.eggBusy,
      need: this.model.needFor(0),
      secondNeed: this.model.needFor(1),
      needs: this.dinos.map((dino) => this.model.needFor(dino.index)),
      hearts: this.model.hearts,
      heartTarget: this.model.heartTarget,
      scoreText: this.heartLabel.text,
      cannonLoaded: this.cannonLoadedKind ?? null,
      cannonPower: Number(this.cannonPower.toFixed(2)),
      lastCannonPower: Number(this.lastCannonPower.toFixed(2)),
      lastCannonSpeed: Math.round(this.lastCannonSpeed),
      lastShotWallBounces: this.lastShotWallBounces,
      lastShotHitDino: this.lastShotHitDino,
      lastDinoImpactSpeed: Math.round(this.lastDinoImpactSpeed),
      cannonShotActive: Boolean(this.cannonShot),
      cannonAngle: Number(this.cannonAngle.toFixed(2)),
      cannonGuideEndX: Math.round(this.guideEnd.x),
      cannonGuideEndY: Math.round(this.guideEnd.y),
      movingObjectCount: this.movingFieldObjects.size + (this.cannonShot ? 1 : 0),
      firstDinoBouncing: first?.bouncing ?? false,
      secondDinoBouncing: second?.bouncing ?? false,
      bouncingDinoCount: this.dinos.filter((dino) => dino.bouncing).length,
      firstBounceSpeed: first ? Math.round(Math.hypot(first.bounceVx, first.bounceVy)) : 0,
      cannonDinoCollisions: this.cannonDinoCollisions,
      firstCannonDistance: first
        ? Math.round(Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, CANNON.x, CANNON.y))
        : 0,
      dinoCount: this.model.dinoCount,
      newEggUnlocked: this.model.newEggUnlocked,
      secondEggVisible: this.rewardEgg.visible,
      secondEggTaps: this.model.rewardEggTaps,
      secondEggBusy: this.rewardEggBusy,
      secondDinoVisible: Boolean(second?.sprite.visible),
      secondDinoAlpha: second?.sprite.alpha ?? 0,
      firstBubbleVisible: first?.bubble.visible ?? false,
      secondBubbleVisible: second?.bubble.visible ?? false,
      secondBubbleAlpha: second?.bubble.alpha ?? 0,
      secondBubbleX: Math.round(second?.bubble.x ?? 0),
      secondBubbleY: Math.round(second?.bubble.y ?? 0),
      firstBubbleAlpha: first?.bubble.alpha ?? 0,
      firstBubbleX: Math.round(first?.bubble.x ?? 0),
      firstBubbleY: Math.round(first?.bubble.y ?? 0),
      ballPlaced: this.ballPlaced,
      ballX: Math.round(this.ball.x),
      ballY: Math.round(this.ball.y),
      drinkPlaced: this.drinkPlaced,
      drinkX: Math.round(this.drink.x),
      drinkY: Math.round(this.drink.y),
      foodAPlaced: this.foodAPlaced,
      foodAX: Math.round(this.foodA.x),
      foodAY: Math.round(this.foodA.y),
      foodBPlaced: this.foodBPlaced,
      foodBX: Math.round(this.foodB.x),
      foodBY: Math.round(this.foodB.y),
      speakerPlaced: this.speakerPlaced,
      speakerX: Math.round(this.speaker.x),
      speakerY: Math.round(this.speaker.y),
      eggX: Math.round(this.egg.x),
      eggY: Math.round(this.egg.y),
      secondEggX: Math.round(this.rewardEgg.x),
      secondEggY: Math.round(this.rewardEgg.y),
      dinoX: Math.round(first?.sprite.x ?? 0),
      dinoY: Math.round(first?.sprite.y ?? 0),
      secondDinoX: Math.round(second?.sprite.x ?? 0),
      secondDinoY: Math.round(second?.sprite.y ?? 0),
      dinoDistance: first && second
        ? Math.round(Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, second.sprite.x, second.sprite.y))
        : 0,
      firstRewardEggDistance: first && this.rewardEgg.visible
        ? Math.round(Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, this.rewardEgg.x, this.rewardEgg.y))
        : 0,
    };
  }

  private createPlaceholderTextures(): void {
    if (this.textures.exists('dino')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(0xffffff, 1).fillRect(4, 4, 72, 72);
    graphics.lineStyle(5, 0x182027, 1).strokeRect(4, 4, 72, 72);
    graphics.lineStyle(3, 0x182027, 0.75).lineBetween(4, 4, 76, 76).lineBetween(76, 4, 4, 76);
    graphics.generateTexture('dino', 80, 80);
    graphics.clear();

    graphics.fillStyle(0xe3aa55, 1).fillEllipse(40, 52, 72, 96);
    graphics.lineStyle(5, 0x182027, 1).strokeEllipse(40, 52, 72, 96);
    graphics.lineStyle(2, 0x182027, 0.55).lineBetween(40, 7, 40, 97);
    graphics.generateTexture('egg', 80, 104);
    graphics.clear();

    graphics.fillStyle(0xe06c75, 1).fillCircle(30, 30, 27);
    graphics.lineStyle(5, 0x182027, 1).strokeCircle(30, 30, 27);
    graphics.lineStyle(3, 0x182027, 0.7).lineBetween(11, 11, 49, 49).lineBetween(49, 11, 11, 49);
    graphics.generateTexture('ball', 60, 60);
    graphics.clear();

    graphics.fillStyle(0x55c2e8, 1).fillRect(5, 12, 50, 40);
    graphics.lineStyle(5, 0x182027, 1).strokeRect(5, 12, 50, 40);
    graphics.fillStyle(0xd8f5ff, 1).fillRect(11, 18, 38, 10);
    graphics.lineStyle(3, 0x182027, 0.75).lineBetween(30, 2, 19, 18).lineBetween(30, 2, 41, 18);
    graphics.generateTexture('drink', 60, 60);
    graphics.clear();

    graphics.fillStyle(0x9bcf6b, 1).fillTriangle(30, 4, 56, 52, 4, 52);
    graphics.lineStyle(5, 0x182027, 1).strokeTriangle(30, 4, 56, 52, 4, 52);
    graphics.lineStyle(3, 0xf4f6f8, 0.75).lineBetween(18, 40, 42, 40);
    graphics.generateTexture('food-a', 60, 60);
    graphics.clear();

    graphics.fillStyle(0xc89fe7, 1).fillCircle(30, 30, 26);
    graphics.lineStyle(5, 0x182027, 1).strokeCircle(30, 30, 26);
    graphics.fillStyle(0xf4f6f8, 0.8).fillCircle(22, 22, 6).fillCircle(39, 35, 5);
    graphics.generateTexture('food-b', 60, 60);
    graphics.clear();

    graphics.fillStyle(0x59636e, 1).fillRect(4, 7, 52, 46);
    graphics.lineStyle(5, 0x182027, 1).strokeRect(4, 7, 52, 46);
    graphics.fillStyle(0xf4f6f8, 1).fillRect(13, 13, 34, 8);
    graphics.fillStyle(0xe06c75, 1).fillCircle(19, 37, 9);
    graphics.fillStyle(0x55c2e8, 1).fillCircle(41, 37, 9);
    graphics.generateTexture('speaker', 60, 60);
    graphics.destroy();
  }

  private drawCollisionDebug(): void {
    this.collisionDebug.clear();
    this.collisionDebug.lineStyle(4, 0x9aaab4, 1).strokeRect(
      FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top,
    );
    this.collisionDebug.lineStyle(3, 0xffdc6e, 0.9).strokeCircle(CANNON.x, CANNON.y, CANNON_RADIUS);
    for (const dino of this.dinos) {
      if (!dino.sprite.visible) continue;
      this.collisionDebug.lineStyle(3, 0xffffff, 0.85).strokeCircle(dino.sprite.x, dino.sprite.y, DINO_RADIUS);
    }
    if (this.ballPlaced) {
      this.collisionDebug.lineStyle(3, 0xff7882, 0.9).strokeCircle(this.ball.x, this.ball.y, CARE_ITEM_RADIUS);
    }
    if (this.drinkPlaced) {
      this.collisionDebug.lineStyle(3, 0x55c2e8, 0.9).strokeCircle(this.drink.x, this.drink.y, CARE_ITEM_RADIUS);
    }
    if (this.foodAPlaced) {
      this.collisionDebug.lineStyle(3, 0x9bcf6b, 0.9).strokeCircle(this.foodA.x, this.foodA.y, CARE_ITEM_RADIUS);
    }
    if (this.foodBPlaced) {
      this.collisionDebug.lineStyle(3, 0xc89fe7, 0.9).strokeCircle(this.foodB.x, this.foodB.y, CARE_ITEM_RADIUS);
    }
    if (this.speakerPlaced) {
      this.collisionDebug.lineStyle(2, 0xc89fe7, 0.6).strokeCircle(this.speaker.x, this.speaker.y, MUSIC_PROXIMITY_RADIUS);
      this.collisionDebug.lineStyle(3, 0x93a4af, 0.9).strokeCircle(this.speaker.x, this.speaker.y, CARE_ITEM_RADIUS);
    }
    for (const { egg, radius } of this.visibleEggObstacles()) {
      this.collisionDebug.lineStyle(3, 0xe3aa55, 0.95).strokeCircle(egg.x, egg.y, radius);
    }
  }

  private createMap(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x161b22).setDepth(-3);
    this.add.rectangle(
      (FIELD.left + FIELD.right) / 2,
      (FIELD.top + FIELD.bottom) / 2,
      FIELD.right - FIELD.left,
      FIELD.bottom - FIELD.top,
      0x26323a,
    ).setDepth(-2);
    const grid = this.add.graphics().setDepth(-1).lineStyle(1, 0x5f6f7a, 0.24);
    for (let x = FIELD.left + 50; x < FIELD.right; x += 50) {
      grid.lineBetween(x, FIELD.top, x, FIELD.bottom);
    }
    for (let y = FIELD.top + 50; y < FIELD.bottom; y += 50) {
      grid.lineBetween(FIELD.left, y, FIELD.right, y);
    }
    this.add.text(FIELD.left + 255, FIELD.top - 30, 'PLAY FIELD / COLLISION DEBUG', {
      color: '#93a4af', fontFamily: 'monospace', fontSize: '18px',
    }).setDepth(5);
    this.collisionDebug = this.add.graphics().setDepth(610);
  }

  private createCannon(): void {
    this.cannonAimGuide = this.add.graphics().setDepth(620);
    this.add.circle(CANNON.x, CANNON.y, 46, 0x59636e, 1)
      .setStrokeStyle(5, 0x182027, 1).setDepth(625);
    this.add.circle(CANNON.x, CANNON.y, 25, 0x202830, 1)
      .setStrokeStyle(4, 0x93a4af, 1).setDepth(627);
    this.cannonBarrel = this.add.rectangle(CANNON.x, CANNON.y, 100, 32, 0x93a4af, 1)
      .setStrokeStyle(5, 0x182027, 1).setOrigin(0.12, 0.5).setRotation(this.cannonAngle).setDepth(626)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.cannonBarrel);
    this.cannonBarrel.on('dragstart', () => { this.cannonAiming = true; });
    this.cannonBarrel.on('drag', (pointer: Phaser.Input.Pointer) => {
      this.aimCannon(pointer.worldX, pointer.worldY);
      this.cannonBarrel.setPosition(CANNON.x, CANNON.y);
    });
    this.cannonBarrel.on('dragend', () => {
      this.cannonAiming = false;
      this.cannonBarrel.setPosition(CANNON.x, CANNON.y);
    });

    this.add.text(CANNON.x - 58, CANNON.y + 53, 'CANNON', {
      color: '#93a4af', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
    }).setDepth(630);
    this.add.rectangle(925, FIRE_CONTROL.y, 560, 92, 0x202830, 1)
      .setStrokeStyle(3, 0x93a4af, 1).setDepth(701);
    this.cannonFireButton = this.add.rectangle(FIRE_CONTROL.x, FIRE_CONTROL.y, 116, 58, 0x33404a, 1)
      .setStrokeStyle(4, 0xffdc6e, 1).setDepth(704).setInteractive({ useHandCursor: true });
    this.cannonFireLabel = this.add.text(FIRE_CONTROL.x, FIRE_CONTROL.y, 'HOLD FIRE', {
      color: '#ffdc6e', fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(705);
    this.add.rectangle(POWER_CONTROL.center, POWER_CONTROL.y, 224, 20, 0x161b22, 1)
      .setStrokeStyle(3, 0x93a4af, 1).setDepth(704);
    this.cannonPowerFill = this.add.rectangle(POWER_CONTROL.left, POWER_CONTROL.y, 0, 14, 0xe06c75, 1)
      .setOrigin(0, 0.5).setDepth(705);
    this.add.text(POWER_CONTROL.left, POWER_CONTROL.y - 33, 'POWER', {
      color: '#93a4af', fontFamily: 'monospace', fontSize: '14px',
    }).setDepth(704);
    this.cannonFireButton.on('pointerdown', () => this.startCannonCharge());
    this.input.on('pointerup', () => this.releaseCannonCharge());
    this.drawCannonAimGuide();
  }

  private createItemTray(): void {
    this.add.rectangle(254, 650, 452, 92, 0x202830, 1).setStrokeStyle(3, 0x93a4af, 1).setDepth(701);
    const slotColors = [0xe06c75, 0x55c2e8, 0x9bcf6b, 0xc89fe7, 0x93a4af];
    [BALL_HOME.x, DRINK_HOME.x, FOOD_A_HOME.x, FOOD_B_HOME.x, SPEAKER_HOME.x].forEach((x, index) => {
      this.add.rectangle(x, 650, 64, 64, 0x161b22, 0.7)
        .setStrokeStyle(2, slotColors[index], 1).setDepth(702);
    });
    this.ball = this.add.image(BALL_HOME.x, BALL_HOME.y, 'ball').setScale(BALL_TRAY_SCALE).setDepth(704);
    this.drink = this.add.image(DRINK_HOME.x, DRINK_HOME.y, 'drink').setScale(BALL_TRAY_SCALE).setDepth(704);
    this.foodA = this.add.image(FOOD_A_HOME.x, FOOD_A_HOME.y, 'food-a').setScale(BALL_TRAY_SCALE).setDepth(704);
    this.foodB = this.add.image(FOOD_B_HOME.x, FOOD_B_HOME.y, 'food-b').setScale(BALL_TRAY_SCALE).setDepth(704);
    this.speaker = this.add.image(SPEAKER_HOME.x, SPEAKER_HOME.y, 'speaker').setScale(BALL_TRAY_SCALE).setDepth(704);
    this.setupInventoryItem(this.ball, 'ball', () => this.ballPlaced,
      (value) => { this.draggingBall = value; }, () => this.returnBallToTray());
    this.setupInventoryItem(this.drink, 'drink', () => this.drinkPlaced,
      (value) => { this.draggingDrink = value; }, () => this.returnDrinkToTray());
    this.setupInventoryItem(this.foodA, 'food-a', () => this.foodAPlaced,
      (value) => { this.draggingFoodA = value; }, () => this.returnFoodToTray('a'));
    this.setupInventoryItem(this.foodB, 'food-b', () => this.foodBPlaced,
      (value) => { this.draggingFoodB = value; }, () => this.returnFoodToTray('b'));
    this.setupInventoryItem(this.speaker, 'speaker', () => this.speakerPlaced,
      (value) => { this.draggingSpeaker = value; }, () => this.returnSpeakerToTray());
  }

  private setupInventoryItem(
    sprite: Phaser.GameObjects.Image,
    kind: InventoryItemKind,
    isPlaced: () => boolean,
    setDragging: (value: boolean) => void,
    recall: () => void,
  ): void {
    sprite.setInteractive({ useHandCursor: true });
    this.input.setDraggable(sprite, false);
    sprite.on('pointerup', () => {
      if (this.cannonLoadedItem === sprite) {
        this.unloadCannon();
        return;
      }
      if (isPlaced()) {
        recall();
        return;
      }
      if (this.model.mode !== 'field' || this.cannonShot?.item === sprite) return;
      if (this.cannonShot) {
        this.cannonFireLabel.setText('WAIT').setColor('#e06c75');
        return;
      }
      if (this.cannonLoadedItem) this.unloadCannon();
      this.loadCannon(kind, sprite, setDragging);
    });
  }

  private loadCannon(
    kind: InventoryItemKind,
    item: Phaser.GameObjects.Image,
    setDragging: (value: boolean) => void,
  ): void {
    setDragging(false);
    this.cannonLoadedKind = kind;
    this.cannonLoadedItem = item;
    this.cannonPower = 0;
    item.disableInteractive();
    item.setScale(0.58).setAngle(0).setDepth(635);
    this.positionLoadedItem();
    this.cannonFireLabel.setText('HOLD FIRE').setColor('#ffdc6e');
    this.showSparkles(CANNON.x, CANNON.y, 0xffdc6e);
    this.sounds.bounce();
    this.drawCannonAimGuide();
  }

  private unloadCannon(): void {
    const kind = this.cannonLoadedKind;
    this.cannonLoadedKind = undefined;
    this.cannonLoadedItem = undefined;
    this.cannonCharging = false;
    this.cannonPower = 0;
    this.cannonFireLabel.setText('HOLD FIRE').setColor('#ffdc6e');
    this.drawCannonAimGuide();
    if (kind === 'ball') this.returnBallToTray();
    else if (kind === 'drink') this.returnDrinkToTray();
    else if (kind === 'food-a') this.returnFoodToTray('a');
    else if (kind === 'food-b') this.returnFoodToTray('b');
    else if (kind === 'speaker') this.returnSpeakerToTray();
  }

  private aimCannon(x: number, y: number): void {
    this.cannonAngle = Phaser.Math.Angle.Between(CANNON.x, CANNON.y, x, y);
    this.cannonBarrel.setRotation(this.cannonAngle);
    this.positionLoadedItem();
    this.drawCannonAimGuide();
  }

  private positionLoadedItem(): void {
    if (!this.cannonLoadedItem) return;
    this.cannonLoadedItem.setPosition(
      CANNON.x + Math.cos(this.cannonAngle) * CANNON_MUZZLE_DISTANCE,
      CANNON.y + Math.sin(this.cannonAngle) * CANNON_MUZZLE_DISTANCE,
    );
  }

  private startCannonCharge(): void {
    if (!this.cannonLoadedItem || this.cannonShot || this.model.mode !== 'field') {
      this.cannonFireLabel.setText('LOAD ITEM').setColor('#e06c75');
      this.tweens.add({ targets: this.cannonFireButton, scale: 1.08, duration: 90, yoyo: true });
      return;
    }
    this.cannonCharging = true;
    this.cannonChargeStartedAt = this.time.now;
    this.cannonPower = 0;
    this.cannonFireLabel.setText('CHARGING').setColor('#ffffff');
    this.sounds.chirp(0.7);
  }

  private releaseCannonCharge(): void {
    if (!this.cannonCharging) return;
    this.cannonPower = Phaser.Math.Clamp((this.time.now - this.cannonChargeStartedAt) / CANNON_CHARGE_MS, 0.12, 1);
    this.cannonCharging = false;
    this.fireCannon();
  }

  private fireCannon(): void {
    const item = this.cannonLoadedItem;
    const kind = this.cannonLoadedKind;
    if (!item || !kind) return;
    const speed = 140 + this.cannonPower * 760;
    this.lastCannonPower = this.cannonPower;
    this.lastCannonSpeed = speed;
    this.lastShotWallBounces = 0;
    this.lastShotHitDino = false;
    this.lastDinoImpactSpeed = 0;
    this.cannonLoadedItem = undefined;
    this.cannonLoadedKind = undefined;
    item.setScale(BALL_FIELD_SCALE).setAngle(0).setDepth(950);
    this.cannonShot = {
      kind,
      item,
      power: this.cannonPower,
      vx: Math.cos(this.cannonAngle) * speed,
      vy: Math.sin(this.cannonAngle) * speed,
      age: 0,
    };
    this.cannonFireLabel.setText('FLY!').setColor('#ffffff');
    this.sounds.stomp();
    this.showSparkles(CANNON.x, CANNON.y, 0xffdc6e);
    this.drawCannonAimGuide();
  }

  private updateCannon(delta: number): void {
    if (this.cannonCharging) {
      this.cannonPower = Phaser.Math.Clamp((this.time.now - this.cannonChargeStartedAt) / CANNON_CHARGE_MS, 0, 1);
      this.cannonFireLabel.setText(this.cannonPower >= 1 ? 'MAX!' : 'CHARGING');
    }
    this.cannonPowerFill.width = 220 * this.cannonPower;
    this.cannonPowerFill.setFillStyle(this.cannonPower > 0.72 ? 0x9bcf6b : this.cannonPower > 0.38 ? 0xffdc6e : 0xe06c75);
    if (this.cannonLoadedItem) this.positionLoadedItem();
    const seconds = Math.min(delta, 40) / 1000;
    this.updateMovingFieldObjects(seconds);
    if (!this.cannonShot) {
      if (this.cannonCharging || this.cannonAiming) this.drawCannonAimGuide();
      return;
    }

    const shot = this.cannonShot;
    const steps = Math.max(1, Math.ceil(seconds / 0.012));
    const stepSeconds = seconds / steps;
    for (let step = 0; step < steps; step += 1) {
      shot.age += stepSeconds;
      this.resolveCannonShotImpacts(shot);
      this.integrateMotion(shot, CARE_ITEM_RADIUS, stepSeconds);
      this.reflectMotionOffCircle(shot, CARE_ITEM_RADIUS, CANNON.x, CANNON.y, CANNON_RADIUS);
      this.resolveCannonShotImpacts(shot);
      const friction = Math.pow(PHYSICS_FRICTION, stepSeconds);
      shot.vx *= friction;
      shot.vy *= friction;
      shot.item.angle += (shot.vx >= 0 ? 1 : -1) * stepSeconds * (180 + Math.hypot(shot.vx, shot.vy) * 0.16);
    }

    if (Math.hypot(shot.vx, shot.vy) < PHYSICS_STOP_SPEED || shot.age >= 8) this.landCannonShot(shot);
  }

  private resolveCannonShotImpacts(shot: CannonShot): void {
    for (const dino of this.dinos) {
      if (!dino.sprite.visible) continue;
      if (!this.collideMotionWithDino(shot, CARE_ITEM_RADIUS, dino)) continue;
      this.lastShotHitDino = true;
      this.sounds.stomp();
      this.showSparkles(dino.sprite.x, dino.sprite.y, 0xffffff);
    }

    for (const target of this.activeFieldObjects()) {
      if (target.item === shot.item) continue;
      const targetMotion = this.motionFor(target.item, target.radius);
      if (!this.collideMotions(shot, CARE_ITEM_RADIUS, targetMotion, target.radius)) {
        if (targetMotion.age === 0 && targetMotion.vx === 0 && targetMotion.vy === 0) {
          this.movingFieldObjects.delete(target.item);
        }
        continue;
      }
      this.markInventoryItemMoving(target.item, true);
      this.sounds.bounce();
      this.showSparkles(target.item.x, target.item.y, 0xffdc6e);
    }
  }

  private updateMovingFieldObjects(seconds: number): void {
    if (this.movingFieldObjects.size === 0) return;
    const steps = Math.max(1, Math.ceil(seconds / 0.012));
    const stepSeconds = seconds / steps;
    for (let step = 0; step < steps; step += 1) {
      const motions = [...this.movingFieldObjects.values()]
        .filter((motion) => this.isActiveFieldObject(motion.item));
      for (const motion of motions) {
        motion.age += stepSeconds;
        this.integrateMotion(motion, motion.radius, stepSeconds);
        this.reflectMotionOffCircle(motion, motion.radius, CANNON.x, CANNON.y, CANNON_RADIUS);
        for (const dino of this.dinos) {
          if (!dino.sprite.visible) continue;
          if (this.collideMotionWithDino(motion, motion.radius, dino)) {
            this.sounds.stomp();
          }
        }
      }

      const objects = this.activeFieldObjects();
      for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
          const first = objects[firstIndex];
          const second = objects[secondIndex];
          const firstMotion = this.movingFieldObjects.get(first.item);
          const secondMotion = this.movingFieldObjects.get(second.item);
          if (!firstMotion && !secondMotion) continue;
          const movingFirst = firstMotion ?? this.motionFor(first.item, first.radius);
          const movingSecond = secondMotion ?? this.motionFor(second.item, second.radius);
          if (this.collideMotions(movingFirst, first.radius, movingSecond, second.radius)) {
            this.markInventoryItemMoving(first.item, true);
            this.markInventoryItemMoving(second.item, true);
            this.sounds.bounce();
          } else {
            if (!firstMotion) this.movingFieldObjects.delete(first.item);
            if (!secondMotion) this.movingFieldObjects.delete(second.item);
          }
        }
      }

      const friction = Math.pow(PHYSICS_FRICTION, stepSeconds);
      for (const motion of this.movingFieldObjects.values()) {
        motion.vx *= friction;
        motion.vy *= friction;
        motion.item.angle += (motion.vx >= 0 ? 1 : -1) * stepSeconds * 150;
      }
    }

    for (const [item, motion] of this.movingFieldObjects) {
      if (!this.isActiveFieldObject(item) || Math.hypot(motion.vx, motion.vy) < PHYSICS_STOP_SPEED || motion.age >= 8) {
        this.stopFieldObject(item);
      }
    }
    this.redrawMovingEggCracks();
  }

  private integrateMotion(
    motion: { item: Phaser.GameObjects.Image; vx: number; vy: number },
    radius: number,
    seconds: number,
  ): void {
    motion.item.x += motion.vx * seconds;
    motion.item.y += motion.vy * seconds;
    let bounced = false;
    const minX = FIELD.left + radius;
    const maxX = FIELD.right - radius;
    const minY = FIELD.top + radius;
    const maxY = FIELD.bottom - radius;
    if (motion.item.x < minX || motion.item.x > maxX) {
      motion.item.x = Phaser.Math.Clamp(motion.item.x, minX, maxX);
      motion.vx *= -PHYSICS_RESTITUTION;
      bounced = true;
    }
    if (motion.item.y < minY || motion.item.y > maxY) {
      motion.item.y = Phaser.Math.Clamp(motion.item.y, minY, maxY);
      motion.vy *= -PHYSICS_RESTITUTION;
      bounced = true;
    }
    if (!bounced) return;
    if (motion === this.cannonShot) this.lastShotWallBounces += 1;
    this.sounds.bounce();
  }

  private reflectMotionOffCircle(
    motion: { item: Phaser.GameObjects.Image; vx: number; vy: number },
    radius: number,
    obstacleX: number,
    obstacleY: number,
    obstacleRadius: number,
  ): boolean {
    const dx = motion.item.x - obstacleX;
    const dy = motion.item.y - obstacleY;
    const minimum = radius + obstacleRadius;
    const distance = Math.hypot(dx, dy);
    if (distance >= minimum) return false;
    const nx = distance > 0.1 ? dx / distance : 1;
    const ny = distance > 0.1 ? dy / distance : 0;
    motion.item.setPosition(obstacleX + nx * minimum, obstacleY + ny * minimum);
    const normalVelocity = motion.vx * nx + motion.vy * ny;
    if (normalVelocity < 0) {
      motion.vx -= (1 + PHYSICS_RESTITUTION) * normalVelocity * nx;
      motion.vy -= (1 + PHYSICS_RESTITUTION) * normalVelocity * ny;
    }
    return true;
  }

  private collideMotionWithDino(
    motion: { item: Phaser.GameObjects.Image; vx: number; vy: number },
    radius: number,
    dino: DinoEntity,
  ): boolean {
    const dx = dino.sprite.x - motion.item.x;
    const dy = dino.sprite.y - motion.item.y;
    const minimum = radius + DINO_RADIUS;
    const distance = Math.hypot(dx, dy);
    if (distance >= minimum) return false;
    const nx = distance > 0.1 ? dx / distance : 1;
    const ny = distance > 0.1 ? dy / distance : 0;
    const overlap = minimum - distance + 0.5;
    motion.item.x -= nx * overlap * 0.58;
    motion.item.y -= ny * overlap * 0.58;
    dino.sprite.x += nx * overlap * 0.42;
    dino.sprite.y += ny * overlap * 0.42;
    this.clampDino(dino.sprite);

    this.prepareDinoForBounce(dino);
    const relativeNormal = (motion.vx - dino.bounceVx) * nx + (motion.vy - dino.bounceVy) * ny;
    if (relativeNormal <= 0) return false;
    const dinoMass = 1.35;
    const impulse = (1 + PHYSICS_RESTITUTION) * relativeNormal / (1 + 1 / dinoMass);
    motion.vx -= impulse * nx;
    motion.vy -= impulse * ny;
    dino.bounceVx += (impulse / dinoMass) * nx;
    dino.bounceVy += (impulse / dinoMass) * ny;
    this.lastDinoImpactSpeed = Math.max(this.lastDinoImpactSpeed, Math.hypot(dino.bounceVx, dino.bounceVy));
    dino.bounceAge = 0;
    return true;
  }

  private collideMotions(
    first: { item: Phaser.GameObjects.Image; vx: number; vy: number },
    firstRadius: number,
    second: { item: Phaser.GameObjects.Image; vx: number; vy: number },
    secondRadius: number,
  ): boolean {
    const dx = second.item.x - first.item.x;
    const dy = second.item.y - first.item.y;
    const minimum = firstRadius + secondRadius;
    const distance = Math.hypot(dx, dy);
    if (distance >= minimum) return false;
    const nx = distance > 0.1 ? dx / distance : 1;
    const ny = distance > 0.1 ? dy / distance : 0;
    const overlap = (minimum - distance) / 2 + 0.25;
    first.item.x -= nx * overlap;
    first.item.y -= ny * overlap;
    second.item.x += nx * overlap;
    second.item.y += ny * overlap;
    const relativeNormal = (first.vx - second.vx) * nx + (first.vy - second.vy) * ny;
    if (relativeNormal <= 0) return false;
    const impulse = (1 + PHYSICS_RESTITUTION) * relativeNormal / 2;
    first.vx -= impulse * nx;
    first.vy -= impulse * ny;
    second.vx += impulse * nx;
    second.vy += impulse * ny;
    return true;
  }

  private motionFor(item: Phaser.GameObjects.Image, radius: number): FieldMotion {
    const existing = this.movingFieldObjects.get(item);
    if (existing) return existing;
    const motion = { item, radius, vx: 0, vy: 0, age: 0 };
    this.movingFieldObjects.set(item, motion);
    return motion;
  }

  private activeFieldObjects(): Array<{ item: Phaser.GameObjects.Image; radius: number }> {
    const objects: Array<{ item: Phaser.GameObjects.Image; radius: number }> = [];
    if (this.ballPlaced) objects.push({ item: this.ball, radius: CARE_ITEM_RADIUS });
    if (this.drinkPlaced) objects.push({ item: this.drink, radius: CARE_ITEM_RADIUS });
    if (this.foodAPlaced) objects.push({ item: this.foodA, radius: CARE_ITEM_RADIUS });
    if (this.foodBPlaced) objects.push({ item: this.foodB, radius: CARE_ITEM_RADIUS });
    if (this.speakerPlaced) objects.push({ item: this.speaker, radius: CARE_ITEM_RADIUS });
    if (this.egg?.visible) objects.push({ item: this.egg, radius: EGG_COLLISION_RADIUS });
    if (this.rewardEgg?.visible) objects.push({ item: this.rewardEgg, radius: EGG_COLLISION_RADIUS * REWARD_EGG_SCALE });
    return objects;
  }

  private isActiveFieldObject(item: Phaser.GameObjects.Image): boolean {
    return this.activeFieldObjects().some((object) => object.item === item);
  }

  private prepareDinoForBounce(dino: DinoEntity): void {
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    dino.roamTimer = undefined;
    dino.reacting = false;
    if (!dino.bouncing) {
      dino.bouncing = true;
      dino.bounceVx = 0;
      dino.bounceVy = 0;
      dino.bounceAge = 0;
    }
    dino.sprite.setScale(DINO_SCALE).setAlpha(1);
  }

  private updateDinoBounces(delta: number): void {
    const seconds = Math.min(delta, 40) / 1000;
    const placedItems: Array<{ item: Phaser.GameObjects.Image; placed: boolean }> = [
      { item: this.ball, placed: this.ballPlaced },
      { item: this.drink, placed: this.drinkPlaced },
      { item: this.foodA, placed: this.foodAPlaced },
      { item: this.foodB, placed: this.foodBPlaced },
      { item: this.speaker, placed: this.speakerPlaced },
    ];

    for (const dino of this.dinos) {
      if (!dino.bouncing) continue;
      dino.bounceAge += seconds;
      dino.sprite.x += dino.bounceVx * seconds;
      dino.sprite.y += dino.bounceVy * seconds;

      const minX = FIELD.left + DINO_RADIUS;
      const maxX = FIELD.right - DINO_RADIUS;
      const minY = FIELD.top + DINO_RADIUS;
      const maxY = FIELD.bottom - DINO_RADIUS;
      if (dino.sprite.x <= minX || dino.sprite.x >= maxX) {
        dino.sprite.x = Phaser.Math.Clamp(dino.sprite.x, minX, maxX);
        dino.bounceVx *= -PHYSICS_RESTITUTION;
        this.sounds.bounce();
      }
      if (dino.sprite.y <= minY || dino.sprite.y >= maxY) {
        dino.sprite.y = Phaser.Math.Clamp(dino.sprite.y, minY, maxY);
        dino.bounceVy *= -PHYSICS_RESTITUTION;
        this.sounds.bounce();
      }

      if (this.bounceDinoOffCircle(dino, CANNON.x, CANNON.y, CANNON_RADIUS)) {
        this.cannonDinoCollisions += 1;
      }
      for (const { egg, radius } of this.visibleEggObstacles()) {
        const incomingAngle = Math.atan2(dino.bounceVy, dino.bounceVx);
        if (this.bounceDinoOffCircle(dino, egg.x, egg.y, radius)) {
          const normalizedPower = Phaser.Math.Clamp(Math.hypot(dino.bounceVx, dino.bounceVy) / 900, 0.15, 1);
          this.kickFieldObject(egg, normalizedPower, radius, incomingAngle);
        }
      }
      for (const target of placedItems) {
        if (!target.placed) continue;
        const incomingAngle = Math.atan2(dino.bounceVy, dino.bounceVx);
        if (this.bounceDinoOffCircle(dino, target.item.x, target.item.y, CARE_ITEM_RADIUS)) {
          const normalizedPower = Phaser.Math.Clamp(Math.hypot(dino.bounceVx, dino.bounceVy) / 940, 0.15, 1);
          this.kickFieldObject(target.item, normalizedPower, CARE_ITEM_RADIUS, incomingAngle);
        }
      }

      const drag = Math.pow(PHYSICS_FRICTION, seconds);
      dino.bounceVx *= drag;
      dino.bounceVy *= drag;
      dino.sprite.angle += (dino.bounceVx >= 0 ? 1 : -1) * seconds * 190;
    }

    this.resolveDinoBounceCollisions();

    for (const dino of this.dinos) {
      if (!dino.bouncing) continue;
      const speed = Math.hypot(dino.bounceVx, dino.bounceVy);
      if (speed >= PHYSICS_STOP_SPEED && dino.bounceAge < 8) continue;
      dino.bouncing = false;
      dino.bounceVx = 0;
      dino.bounceVy = 0;
      dino.bounceAge = 0;
      dino.sprite.setAngle(0).setScale(DINO_SCALE).setAlpha(1).setFlipX(false);
      this.clampDino(dino.sprite);
      this.resolveCannonCollision(dino);
      this.resolveEggCollision(dino);
      this.scheduleRoam(dino, 950);
    }
  }

  private bounceDinoOffCircle(
    dino: DinoEntity,
    obstacleX: number,
    obstacleY: number,
    obstacleRadius: number,
  ): boolean {
    const minimum = DINO_RADIUS + obstacleRadius;
    const dx = dino.sprite.x - obstacleX;
    const dy = dino.sprite.y - obstacleY;
    const distance = Math.hypot(dx, dy);
    if (distance >= minimum) return false;
    const nx = distance > 0.1 ? dx / distance : Math.cos(dino.index * 2.17);
    const ny = distance > 0.1 ? dy / distance : Math.sin(dino.index * 2.17);
    const separation = minimum + COLLISION_SKIN;
    dino.sprite.setPosition(obstacleX + nx * separation, obstacleY + ny * separation);
    const normalVelocity = dino.bounceVx * nx + dino.bounceVy * ny;
    if (normalVelocity < 0) {
      dino.bounceVx -= (1 + PHYSICS_RESTITUTION) * normalVelocity * nx;
      dino.bounceVy -= (1 + PHYSICS_RESTITUTION) * normalVelocity * ny;
    }
    this.sounds.bounce();
    return true;
  }

  private resolveDinoBounceCollisions(): void {
    for (let firstIndex = 0; firstIndex < this.dinos.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < this.dinos.length; secondIndex += 1) {
        const first = this.dinos[firstIndex];
        const second = this.dinos[secondIndex];
        if (!first.bouncing && !second.bouncing) continue;
        const dx = second.sprite.x - first.sprite.x;
        const dy = second.sprite.y - first.sprite.y;
        const distance = Math.hypot(dx, dy);
        const minimum = DINO_RADIUS * 2;
        if (distance >= minimum) continue;
        const nx = distance > 0.1 ? dx / distance : Math.cos(firstIndex * 1.9);
        const ny = distance > 0.1 ? dy / distance : Math.sin(firstIndex * 1.9);
        const overlap = (minimum - distance) / 2 + 0.5;
        first.sprite.x -= nx * overlap;
        first.sprite.y -= ny * overlap;
        second.sprite.x += nx * overlap;
        second.sprite.y += ny * overlap;
        this.clampDino(first.sprite);
        this.clampDino(second.sprite);

        const firstNormal = first.bounceVx * nx + first.bounceVy * ny;
        const secondNormal = second.bounceVx * nx + second.bounceVy * ny;
        if (!first.bouncing) this.prepareDinoForBounce(first);
        if (!second.bouncing) this.prepareDinoForBounce(second);
        first.bounceVx += (secondNormal - firstNormal) * nx * PHYSICS_RESTITUTION;
        first.bounceVy += (secondNormal - firstNormal) * ny * PHYSICS_RESTITUTION;
        second.bounceVx += (firstNormal - secondNormal) * nx * PHYSICS_RESTITUTION;
        second.bounceVy += (firstNormal - secondNormal) * ny * PHYSICS_RESTITUTION;
        this.sounds.stomp();
        this.showSparkles((first.sprite.x + second.sprite.x) / 2, (first.sprite.y + second.sprite.y) / 2, 0xffffff);
      }
    }
  }

  private kickFieldObject(
    item: Phaser.GameObjects.Image,
    power: number,
    margin = CARE_ITEM_RADIUS,
    angle = this.cannonAngle,
  ): void {
    const impulse = 120 + power * 360;
    const motion = this.motionFor(item, margin);
    motion.vx += Math.cos(angle) * impulse;
    motion.vy += Math.sin(angle) * impulse;
    motion.age = 0;
    this.markInventoryItemMoving(item, true);
    this.sounds.bounce();
    this.showSparkles(item.x, item.y, 0xffdc6e);
  }

  private markInventoryItemMoving(item: Phaser.GameObjects.Image, moving: boolean): void {
    if (item === this.ball) this.draggingBall = moving;
    else if (item === this.drink) this.draggingDrink = moving;
    else if (item === this.foodA) this.draggingFoodA = moving;
    else if (item === this.foodB) this.draggingFoodB = moving;
    else if (item === this.speaker) this.draggingSpeaker = moving;
  }

  private stopFieldObject(item: Phaser.GameObjects.Image): void {
    this.movingFieldObjects.delete(item);
    this.markInventoryItemMoving(item, false);
    item.setAngle(0);
  }

  private redrawMovingEggCracks(): void {
    if (this.egg?.visible && this.model.eggTaps >= 2) {
      this.drawCracks(this.egg, this.crack, this.model.eggTaps >= 3, false);
    }
    if (this.rewardEgg?.visible && this.model.rewardEggTaps >= 2) {
      this.drawCracks(this.rewardEgg, this.rewardCrack, this.model.rewardEggTaps >= 3, true);
    }
  }

  private landCannonShot(shot: CannonShot): void {
    if (this.cannonShot !== shot) return;
    this.cannonShot = undefined;
    shot.item.setPosition(
      Phaser.Math.Clamp(shot.item.x, FIELD.left + CARE_ITEM_RADIUS, FIELD.right - CARE_ITEM_RADIUS),
      Phaser.Math.Clamp(shot.item.y, FIELD.top + CARE_ITEM_RADIUS, FIELD.bottom - CARE_ITEM_RADIUS),
    ).setScale(BALL_FIELD_SCALE).setAngle(0).setAlpha(1);

    if (shot.kind === 'ball') {
      this.draggingBall = false;
      this.ballPlaced = true;
    } else if (shot.kind === 'drink') {
      this.draggingDrink = false;
      this.drinkPlaced = true;
    } else if (shot.kind === 'food-a') {
      this.draggingFoodA = false;
      this.foodAPlaced = true;
    } else if (shot.kind === 'food-b') {
      this.draggingFoodB = false;
      this.foodBPlaced = true;
    } else {
      this.draggingSpeaker = false;
      this.speakerPlaced = true;
      this.sounds.music();
      this.tweens.add({ targets: this.speaker, scale: BALL_FIELD_SCALE * 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    this.lockPlacedItem(shot.item);
    this.cannonPower = 0;
    this.cannonFireLabel.setText('HOLD FIRE').setColor('#ffdc6e');
    this.sounds.bounce();
    this.showSparkles(shot.item.x, shot.item.y, 0xffdc6e);
    this.resolveWorldCollisions();
    this.redirectDinosToNearbyCare();
    this.drawCannonAimGuide();
  }

  private drawCannonAimGuide(): void {
    this.cannonAimGuide.clear();
    if (!this.cannonLoadedItem && !this.cannonCharging) return;
    const previewPower = this.cannonCharging ? this.cannonPower : Math.max(0.38, this.cannonPower);
    const muzzleX = CANNON.x + Math.cos(this.cannonAngle) * CANNON_MUZZLE_DISTANCE;
    const muzzleY = CANNON.y + Math.sin(this.cannonAngle) * CANNON_MUZZLE_DISTANCE;
    const previewDistance = 150 + previewPower * 650;
    const boundaryDistance = this.distanceToFieldBoundary(muzzleX, muzzleY, this.cannonAngle, 28);
    const distance = Math.min(previewDistance, boundaryDistance);
    const targetX = muzzleX + Math.cos(this.cannonAngle) * distance;
    const targetY = muzzleY + Math.sin(this.cannonAngle) * distance;
    this.guideEnd = { x: targetX, y: targetY };
    for (let index = 1; index <= 10; index += 1) {
      const progress = index / 10;
      this.cannonAimGuide.fillStyle(0xffdc6e, 0.25 + progress * 0.65)
        .fillCircle(Phaser.Math.Linear(muzzleX, targetX, progress), Phaser.Math.Linear(muzzleY, targetY, progress), 3 + progress * 2);
    }
    this.cannonAimGuide.lineStyle(3, 0xffdc6e, 0.8).strokeCircle(targetX, targetY, 22);
  }

  private distanceToFieldBoundary(x: number, y: number, angle: number, margin: number): number {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const distances: number[] = [];
    if (dx > 0.0001) distances.push((FIELD.right - margin - x) / dx);
    else if (dx < -0.0001) distances.push((FIELD.left + margin - x) / dx);
    if (dy > 0.0001) distances.push((FIELD.bottom - margin - y) / dy);
    else if (dy < -0.0001) distances.push((FIELD.top + margin - y) / dy);
    return Math.max(0, Math.min(...distances.filter((distance) => distance >= 0)));
  }

  private createEggs(): void {
    this.egg = this.add.image(EGG_HOME.x, EGG_HOME.y, 'egg').setScale(EGG_SCALE).setDepth(360);
    this.crack = this.add.graphics().setDepth(365);
    this.setupEggDrag(this.egg, false);

    this.rewardEgg = this.add.image(REWARD_EGG_HOME.x, REWARD_EGG_HOME.y, 'egg')
      .setScale(REWARD_EGG_SCALE).setDepth(REWARD_EGG_DEPTH).setVisible(false);
    this.rewardCrack = this.add.graphics().setDepth(REWARD_EGG_DEPTH + 5);
    this.setupEggDrag(this.rewardEgg, true);
  }

  private setupEggDrag(egg: Phaser.GameObjects.Image, reward: boolean): void {
    egg.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(egg);
    egg.on('pointerdown', () => {
      if (reward ? this.rewardEggBusy || !egg.visible : this.eggBusy || this.model.mode !== 'egg') return;
      if (reward) {
        this.rewardEggMoved = false;
        this.rewardEggPress = { x: egg.x, y: egg.y };
      } else {
        this.eggMoved = false;
        this.eggPress = { x: egg.x, y: egg.y };
      }
    });
    egg.on('pointerup', () => {
      const start = reward ? this.rewardEggPress : this.eggPress;
      const moved = Phaser.Math.Distance.Between(start.x, start.y, egg.x, egg.y) > 6;
      if (!moved && !(reward ? this.rewardEggMoved : this.eggMoved)) {
        if (reward) this.tapRewardEgg(); else this.tapEgg();
      }
    });
    egg.on('dragstart', () => {
      const canDrag = reward ? egg.visible && !this.rewardEggBusy : this.model.mode === 'egg' && !this.eggBusy;
      egg.setData('dragActive', canDrag);
      if (canDrag) this.stopFieldObject(egg);
      if (reward) this.rewardEggMoved = canDrag; else this.eggMoved = canDrag;
    });
    egg.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!egg.getData('dragActive')) return;
      egg.setPosition(
        Phaser.Math.Clamp(dragX, FIELD.left + 42, FIELD.right - 42),
        Phaser.Math.Clamp(dragY, FIELD.top + 54, FIELD.bottom - 54),
      );
      for (const dino of this.dinos) this.resolveEggCollision(dino);
      if (reward && this.model.rewardEggTaps >= 2) this.drawCracks(egg, this.rewardCrack, this.model.rewardEggTaps >= 3, true);
      if (!reward && this.model.eggTaps >= 2) this.drawCracks(egg, this.crack, this.model.eggTaps >= 3, false);
    });
    egg.on('dragend', () => egg.setData('dragActive', false));
  }

  private createProgress(): void {
    this.add.rectangle(148, 61, 248, 76, 0x202830, 1).setStrokeStyle(3, 0x93a4af, 1).setDepth(801);
    this.add.text(40, 34, 'NEXT EGG', { color: '#93a4af', fontSize: '16px', fontFamily: 'monospace' }).setDepth(802);
    this.heartLabel = this.add.text(40, 54, '', {
      color: '#ffffff', fontSize: '25px', fontStyle: 'bold', fontFamily: 'monospace',
    }).setDepth(802);
    this.updateProgress(false);
  }

  private createControls(): void {
    this.muteButton = this.makeRoundButton(1120, 60, 34, '♪', () => {
      this.sounds.setMuted(!this.sounds.isMuted);
      (this.muteButton.getByName('label') as Phaser.GameObjects.Text).setText(this.sounds.isMuted ? '×' : '♪');
    });
    this.makeRoundButton(1202, 60, 34, '↻', () => this.resetGame());
  }

  private makeRoundButton(x: number, y: number, radius: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const circle = this.add.rectangle(0, 0, radius * 2, radius * 2, 0x202830, 1).setStrokeStyle(3, 0x93a4af, 1)
      .setInteractive({ useHandCursor: true }).setName('hit');
    const text = this.add.text(0, -2, label, { color: '#ffffff', fontSize: `${Math.round(radius * 1.15)}px`, fontStyle: 'bold' })
      .setOrigin(0.5).setName('label');
    const button = this.add.container(x, y, [circle, text]).setDepth(850);
    circle.on('pointerdown', onClick);
    return button;
  }

  private tapEgg(): void {
    if (this.model.mode !== 'egg') return;
    if (this.eggBusy) {
      this.pendingEggTap = true;
      return;
    }
    if (this.time.now - this.lastEggTap < 180) return;
    this.lastEggTap = this.time.now;
    this.eggBusy = true;
    const stage = this.model.tapEgg();
    this.animateEggTap(this.egg, this.crack, stage, false, () => this.beginFirstHatch());
  }

  private tapRewardEgg(): void {
    if (!this.rewardEgg.visible || this.model.rewardEggHatching) return;
    if (this.rewardEggBusy) {
      this.pendingRewardEggTap = true;
      return;
    }
    if (this.time.now - this.lastRewardEggTap < 180) return;
    this.lastRewardEggTap = this.time.now;
    this.rewardEggBusy = true;
    const stage = this.model.tapRewardEgg();
    this.animateEggTap(this.rewardEgg, this.rewardCrack, stage, true, () => this.beginRewardHatch());
  }

  private animateEggTap(
    egg: Phaser.GameObjects.Image,
    crack: Phaser.GameObjects.Graphics,
    stage: number,
    reward: boolean,
    hatch: () => void,
  ): void {
    this.tweens.killTweensOf(egg);
    if (stage < 4) this.sounds.egg(stage);
    const release = (delay: number) => this.time.delayedCall(delay, () => {
      if (reward) this.rewardEggBusy = false; else this.eggBusy = false;
      egg.setAngle(0).setScale(reward ? REWARD_EGG_SCALE : EGG_SCALE);
      if (reward && this.pendingRewardEggTap) {
        this.pendingRewardEggTap = false;
        this.lastRewardEggTap = -Infinity;
        this.tapRewardEgg();
      } else if (!reward && this.pendingEggTap) {
        this.pendingEggTap = false;
        this.lastEggTap = -Infinity;
        this.tapEgg();
      }
    });
    if (stage === 1) {
      this.tweens.add({ targets: egg, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 2 });
      release(400);
    } else if (stage === 2) {
      this.drawCracks(egg, crack, false, reward);
      const baseScale = reward ? REWARD_EGG_SCALE : EGG_SCALE;
      this.tweens.add({ targets: egg, scaleX: baseScale * 1.1, scaleY: baseScale * 0.9, duration: 110, yoyo: true });
      release(460);
    } else if (stage === 3) {
      this.drawCracks(egg, crack, true, reward);
      this.tweens.add({ targets: egg, y: egg.y - 38, duration: 210, yoyo: true, ease: 'Quad.Out' });
      release(560);
    } else if (stage === 4) {
      hatch();
    } else {
      if (reward) this.rewardEggBusy = false; else this.eggBusy = false;
    }
  }

  private drawCracks(egg: Phaser.GameObjects.Image, crack: Phaser.GameObjects.Graphics, big: boolean, small: boolean): void {
    const x = egg.x;
    const y = egg.y - (small ? 27 : 35);
    crack.clear().lineStyle(big ? 5 : 3, 0x644d43, 0.9).beginPath();
    crack.moveTo(x, y).lineTo(x - 9, y + 17).lineTo(x + 7, y + 30).lineTo(x - 6, y + (small ? 44 : 54));
    if (big) crack.moveTo(x + 7, y + 30).lineTo(x + 25, y + 43);
    crack.strokePath();
  }

  private beginFirstHatch(): void {
    const point = { x: this.egg.x, y: this.egg.y };
    this.egg.disableInteractive();
    this.pendingEggTap = false;
    this.sounds.hatch();
    this.tweens.add({
      targets: this.egg, angle: { from: -10, to: 10 }, scale: EGG_SCALE * 1.12, duration: 80, yoyo: true, repeat: 4,
      onComplete: () => {
        this.burstShell(point.x, point.y);
        this.egg.setVisible(false);
        this.crack.clear();
        this.model.finishHatching();
        const dino = this.spawnDino(0, point, true);
        this.showFirstNeed(dino, 'thirst');
        saveProgress(localStorage, this.model.serialize());
        this.tweens.add({
          targets: dino.sprite, scale: DINO_SCALE, y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
          onComplete: () => {
            dino.sprite.setAlpha(1);
            dino.reacting = false;
            this.eggBusy = false;
            this.scheduleRoam(dino, 1200);
            this.ball.setAlpha(1);
            this.drink.setAlpha(1);
            this.foodA.setAlpha(1);
            this.foodB.setAlpha(1);
            this.speaker.setAlpha(1);
          },
        });
      },
    });
  }

  private beginRewardHatch(): void {
    const point = { x: this.rewardEgg.x, y: this.rewardEgg.y };
    this.rewardEgg.disableInteractive();
    this.pendingRewardEggTap = false;
    this.sounds.hatch();
    this.tweens.add({
      targets: this.rewardEgg, angle: { from: -10, to: 10 }, scale: REWARD_EGG_SCALE * 1.16, duration: 80, yoyo: true, repeat: 4,
      onComplete: () => {
        this.burstShell(point.x, point.y);
        this.rewardEgg.setVisible(false);
        this.rewardCrack.clear();
        const index = this.model.dinoCount;
        this.model.finishRewardHatching();
        for (const existingDino of this.dinos) {
          this.scheduleNeed(existingDino, 900 + existingDino.index * 300);
        }
        const dino = this.spawnDino(index, point, true);
        this.showFirstNeed(dino);
        saveProgress(localStorage, this.model.serialize());
        this.resetRewardEgg();
        this.updateProgress(true);
        this.tweens.add({
          targets: dino.sprite, scale: DINO_SCALE, y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
          onComplete: () => {
            dino.sprite.setAlpha(1);
            dino.reacting = false;
            this.rewardEggBusy = false;
            this.scheduleRoam(dino, 1200);
            this.showSparkles(point.x, point.y, 0xc8f2ff);
          },
        });
      },
    });
  }

  private resetRewardEgg(): void {
    this.rewardEgg.setPosition(REWARD_EGG_HOME.x, REWARD_EGG_HOME.y)
      .setScale(REWARD_EGG_SCALE).setAlpha(1).setAngle(0).setDepth(REWARD_EGG_DEPTH).setVisible(false);
  }

  private armRewardEgg(): void {
    this.rewardEgg.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.rewardEgg);
  }

  private refreshRewardEgg(): void {
    if (!this.model.newEggUnlocked || this.model.rewardEggHatching) return;
    this.armRewardEgg();
    this.rewardEgg.setVisible(true).setAlpha(1).setScale(REWARD_EGG_SCALE).setDepth(REWARD_EGG_DEPTH);
  }

  private spawnPointFor(index: number): Phaser.Math.Vector2 {
    const points = [
      new Phaser.Math.Vector2(350, 265),
      new Phaser.Math.Vector2(650, 245),
      new Phaser.Math.Vector2(955, 285),
      new Phaser.Math.Vector2(430, 475),
      new Phaser.Math.Vector2(760, 465),
      new Phaser.Math.Vector2(1070, 470),
      new Phaser.Math.Vector2(205, 430),
      new Phaser.Math.Vector2(1080, 190),
    ];
    const cycle = Math.floor(index / points.length);
    const angle = Phaser.Math.DegToRad((cycle * 137.5 + (index % points.length) * 47) % 360);
    const radius = 10 + (cycle % 5) * 10;
    const point = points[index % points.length].clone().add(new Phaser.Math.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ));
    point.x = Phaser.Math.Clamp(point.x, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS);
    point.y = Phaser.Math.Clamp(point.y, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS);
    return point;
  }

  private spawnDino(index: number, position: { x: number; y: number }, animate: boolean): DinoEntity {
    const sprite = this.add.image(position.x, position.y + (animate ? 14 : 0), 'dino')
      .setScale(animate ? DINO_SCALE * 0.27 : DINO_SCALE)
      .setAlpha(animate ? 0 : 1)
      .setTint(DINO_TINTS[index % DINO_TINTS.length]);
    const { bubble, icon } = this.createNeedBubble();
    const dino: DinoEntity = {
      index,
      sprite,
      bubble,
      icon,
      reacting: animate,
      bouncing: false,
      bounceVx: 0,
      bounceVy: 0,
      bounceAge: 0,
    };
    this.dinos.push(dino);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerup', () => {
      if (!dino.reacting && !dino.bouncing && this.model.needFor(dino.index) === 'affection') {
        this.receiveAffection(dino);
      }
    });
    return dino;
  }

  private createNeedBubble(): { bubble: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Graphics } {
    const shape = this.add.graphics();
    shape.fillStyle(0xf4f6f8, 1).fillRect(-56, -39, 112, 78);
    shape.lineStyle(4, 0x182027, 1).strokeRect(-56, -39, 112, 78);
    shape.fillStyle(0xf4f6f8, 1).fillTriangle(-14, 39, 8, 39, -4, 54);
    shape.lineStyle(3, 0x182027, 1).lineBetween(-14, 39, -4, 54).lineBetween(-4, 54, 8, 39);
    const icon = this.add.graphics();
    const bubble = this.add.container(0, 0, [shape, icon]).setDepth(NEED_BUBBLE_DEPTH).setVisible(false);
    return { bubble, icon };
  }

  private scheduleNeed(
    dino: DinoEntity,
    delay = Phaser.Math.Between(6500, 9000),
    forced?: DinoNeed,
  ): void {
    dino.needTimer?.remove(false);
    dino.needTimer = undefined;
    if (this.model.newEggUnlocked || this.model.rewardEggHatching) return;
    dino.needTimer = this.time.delayedCall(delay, () => {
      dino.needTimer = undefined;
      const need = this.model.requestNeed(dino.index, forced);
      if (need) this.showNeed(dino, need);
    });
  }

  private showFirstNeed(dino: DinoEntity, forced?: DinoNeed): void {
    const need = this.model.requestNeed(dino.index, forced);
    if (need) this.showNeed(dino, need, true);
  }

  private showNeed(dino: DinoEntity, need: DinoNeed, immediate = false): void {
    dino.icon.clear();
    if (need === 'thirst') {
      dino.icon.fillStyle(0x55c2e8, 1).fillCircle(0, 9, 17);
      dino.icon.fillTriangle(0, -27, -17, 9, 17, 9);
      dino.icon.lineStyle(3, 0x182027, 0.65).strokeCircle(0, 9, 17);
    } else if (need === 'play') {
      dino.icon.fillStyle(0xffd36d, 1).fillCircle(0, 0, 23);
      dino.icon.lineStyle(5, 0xf28d83, 1).arc(0, 0, 22, -1.1, 1.1).strokePath();
      dino.icon.lineStyle(5, 0x70b9c6, 1).arc(0, 0, 22, 2.05, 4.2).strokePath();
    } else if (need === 'hunger') {
      dino.icon.fillStyle(0x9bcf6b, 1).fillTriangle(-23, -16, -2, 18, -30, 18);
      dino.icon.fillStyle(0xc89fe7, 1).fillCircle(15, 2, 17);
      dino.icon.lineStyle(3, 0x182027, 0.7).strokeCircle(15, 2, 17);
    } else if (need === 'affection') {
      dino.icon.fillStyle(0xe77f8f, 1).fillCircle(-11, -6, 14).fillCircle(11, -6, 14);
      dino.icon.fillTriangle(-24, 0, 24, 0, 0, 27);
    } else {
      dino.icon.lineStyle(7, 0xc89fe7, 1).lineBetween(5, -25, 5, 15).lineBetween(5, -25, 25, -31);
      dino.icon.fillStyle(0xc89fe7, 1).fillCircle(-5, 18, 12).fillCircle(18, 10, 10);
    }
    this.tweens.killTweensOf(dino.bubble);
    this.positionNeedBubble(dino);
    dino.bubble.setVisible(true).setScale(immediate ? 1 : 0.2).setAlpha(immediate ? 1 : 0);
    if (!immediate) {
      this.tweens.add({ targets: dino.bubble, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    }
    this.sounds.chirp(1.3);
    this.redirectDinoToNearbyCare(dino);
  }

  private positionNeedBubble(dino: DinoEntity): void {
    dino.bubble.setPosition(dino.sprite.x, dino.sprite.y - NEED_BUBBLE_OFFSET_Y).setDepth(NEED_BUBBLE_DEPTH);
  }

  private resolveWorldCollisions(): void {
    if (this.model.mode !== 'field') return;
    for (const dino of this.dinos) {
      if (!dino.sprite.visible || dino.reacting || dino.bouncing) continue;
      if (this.resolveCannonCollision(dino)) continue;
      if (this.resolveEggCollision(dino)) continue;
      if (this.ballPlaced && !this.draggingBall
        && Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.ball.x, this.ball.y) < CARE_COLLISION_RADIUS) {
        this.playBall(dino);
        break;
      }
      if (this.drinkPlaced && !this.draggingDrink
        && Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.drink.x, this.drink.y) < CARE_COLLISION_RADIUS) {
        this.drinkWater(dino);
        break;
      }
      if (this.foodAPlaced && !this.draggingFoodA
        && Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.foodA.x, this.foodA.y) < CARE_COLLISION_RADIUS) {
        this.eatFood(dino, 'a');
        break;
      }
      if (this.foodBPlaced && !this.draggingFoodB
        && Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.foodB.x, this.foodB.y) < CARE_COLLISION_RADIUS) {
        this.eatFood(dino, 'b');
        break;
      }
      if (this.speakerPlaced && !this.draggingSpeaker) {
        const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.speaker.x, this.speaker.y);
        if (this.model.needFor(dino.index) === 'music' && distance < MUSIC_PROXIMITY_RADIUS) {
          this.enjoyMusic(dino);
          break;
        }
        if (distance < CARE_COLLISION_RADIUS) {
          this.pushAway(dino.sprite, this.speaker.x, this.speaker.y, CARE_COLLISION_RADIUS);
          this.tweens.killTweensOf(dino.sprite);
          this.scheduleRoam(dino, 700);
        }
      }
    }
  }

  private visibleEggObstacles(): Array<{ egg: Phaser.GameObjects.Image; radius: number }> {
    const obstacles: Array<{ egg: Phaser.GameObjects.Image; radius: number }> = [];
    if (this.egg?.visible) obstacles.push({ egg: this.egg, radius: EGG_COLLISION_RADIUS });
    if (this.rewardEgg?.visible) {
      obstacles.push({ egg: this.rewardEgg, radius: EGG_COLLISION_RADIUS * REWARD_EGG_SCALE });
    }
    return obstacles;
  }

  private resolveCannonCollision(dino: DinoEntity): boolean {
    const minimum = DINO_RADIUS + CANNON_RADIUS;
    if (Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, CANNON.x, CANNON.y) >= minimum) return false;
    this.pushAway(dino.sprite, CANNON.x, CANNON.y, minimum + COLLISION_SKIN);
    this.tweens.killTweensOf(dino.sprite);
    this.scheduleRoam(dino, 700);
    this.cannonDinoCollisions += 1;
    return true;
  }

  private resolveEggCollision(dino: DinoEntity): boolean {
    for (const { egg, radius } of this.visibleEggObstacles()) {
      const minimum = DINO_RADIUS + radius;
      const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, egg.x, egg.y);
      if (distance >= minimum) continue;
      this.pushAway(dino.sprite, egg.x, egg.y, minimum);
      this.tweens.killTweensOf(dino.sprite);
      this.scheduleRoam(dino, 700);
      return true;
    }
    return false;
  }

  private resolveDinoSeparation(focused?: DinoEntity): void {
    for (let firstIndex = 0; firstIndex < this.dinos.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < this.dinos.length; secondIndex += 1) {
        const first = this.dinos[firstIndex];
        const second = this.dinos[secondIndex];
        if (first.bouncing || second.bouncing) continue;
        const distance = Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, second.sprite.x, second.sprite.y);
        const minimum = DINO_RADIUS * 2;
        if (distance >= minimum) continue;
        if (focused === first) this.pushAway(first.sprite, second.sprite.x, second.sprite.y, minimum);
        else if (focused === second) this.pushAway(second.sprite, first.sprite.x, first.sprite.y, minimum);
        else {
          const angle = distance > 0.1
            ? Phaser.Math.Angle.Between(second.sprite.x, second.sprite.y, first.sprite.x, first.sprite.y)
            : firstIndex * 2.1;
          const overlap = (minimum - distance) / 2 + 1;
          first.sprite.x += Math.cos(angle) * overlap;
          first.sprite.y += Math.sin(angle) * overlap;
          second.sprite.x -= Math.cos(angle) * overlap;
          second.sprite.y -= Math.sin(angle) * overlap;
          this.clampDino(first.sprite);
          this.clampDino(second.sprite);
        }
      }
    }
  }

  private pushAway(sprite: Phaser.GameObjects.Image, obstacleX: number, obstacleY: number, minimum: number): void {
    const originalX = sprite.x;
    const originalY = sprite.y;
    const distance = Phaser.Math.Distance.Between(originalX, originalY, obstacleX, obstacleY);
    const preferredAngle = distance > 0.1
      ? Phaser.Math.Angle.Between(obstacleX, obstacleY, originalX, originalY)
      : Phaser.Math.Angle.Between(obstacleX, obstacleY, WIDTH / 2, HEIGHT / 2);
    const candidates = [
      preferredAngle,
      Phaser.Math.Angle.Between(obstacleX, obstacleY, WIDTH / 2, HEIGHT / 2),
      Math.PI,
      -Math.PI / 2,
      Math.PI / 2,
      0,
      -Math.PI * 0.75,
      Math.PI * 0.75,
    ];
    let bestX = originalX;
    let bestY = originalY;
    let bestDistance = -Infinity;

    for (const angle of candidates) {
      const x = Phaser.Math.Clamp(
        obstacleX + Math.cos(angle) * minimum,
        FIELD.left + DINO_RADIUS,
        FIELD.right - DINO_RADIUS,
      );
      const y = Phaser.Math.Clamp(
        obstacleY + Math.sin(angle) * minimum,
        FIELD.top + DINO_RADIUS,
        FIELD.bottom - DINO_RADIUS,
      );
      const candidateDistance = Phaser.Math.Distance.Between(x, y, obstacleX, obstacleY);
      if (candidateDistance > bestDistance) {
        bestX = x;
        bestY = y;
        bestDistance = candidateDistance;
      }
      if (candidateDistance >= minimum - 0.5) break;
    }

    sprite.setPosition(bestX, bestY);
  }

  private clampDino(sprite: Phaser.GameObjects.Image): void {
    sprite.setPosition(
      Phaser.Math.Clamp(sprite.x, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS),
      Phaser.Math.Clamp(sprite.y, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS),
    );
  }

  private playBall(dino: DinoEntity): void {
    if (this.time.now - this.lastBallBump < 500) return;
    this.lastBallBump = this.time.now;
    this.ballPlaced = false;
    this.draggingBall = true;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.bounce();
    if (this.model.fulfillNeed(dino.index, 'play')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, y: dino.sprite.y - 7, angle: 6, duration: 210, yoyo: true });
    this.tweens.add({
      targets: this.ball, x: BALL_HOME.x, y: BALL_HOME.y, scale: BALL_TRAY_SCALE, angle: '+=420', alpha: 1,
      duration: 380, ease: 'Back.In',
      onComplete: () => {
        this.ball.setPosition(BALL_HOME.x, BALL_HOME.y).setDepth(704).setAlpha(1);
        this.draggingBall = false;
      },
    });
    this.time.delayedCall(520, () => {
      dino.reacting = false;
      dino.sprite.setAngle(0).setScale(DINO_SCALE).setAlpha(1);
      this.resumeRoaming(dino);
    });
  }

  private drinkWater(dino: DinoEntity): void {
    if (this.time.now - this.lastDrinkBump < 500) return;
    this.lastDrinkBump = this.time.now;
    this.drinkPlaced = false;
    this.draggingDrink = true;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.drink();
    if (this.model.fulfillNeed(dino.index, 'thirst')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, scale: DINO_SCALE * 1.06, duration: 180, yoyo: true });
    this.tweens.add({
      targets: this.drink, x: DRINK_HOME.x, y: DRINK_HOME.y, scale: BALL_TRAY_SCALE, alpha: 1,
      duration: 380, ease: 'Back.In',
      onComplete: () => {
        this.drink.setPosition(DRINK_HOME.x, DRINK_HOME.y).setDepth(704).setAlpha(1);
        this.draggingDrink = false;
      },
    });
    this.time.delayedCall(520, () => {
      dino.reacting = false;
      dino.sprite.setScale(DINO_SCALE).setAlpha(1);
      this.resumeRoaming(dino);
    });
  }

  private eatFood(dino: DinoEntity, kind: 'a' | 'b'): void {
    if (this.time.now - this.lastFoodBump < 500) return;
    this.lastFoodBump = this.time.now;
    const food = kind === 'a' ? this.foodA : this.foodB;
    const home = kind === 'a' ? FOOD_A_HOME : FOOD_B_HOME;
    if (kind === 'a') {
      this.foodAPlaced = false;
      this.draggingFoodA = true;
    } else {
      this.foodBPlaced = false;
      this.draggingFoodB = true;
    }
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.eat();
    if (this.model.fulfillNeed(dino.index, 'hunger')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, scaleX: DINO_SCALE * 1.08, scaleY: DINO_SCALE * 0.94, duration: 180, yoyo: true });
    this.tweens.add({
      targets: food, x: home.x, y: home.y, scale: BALL_TRAY_SCALE, alpha: 1,
      duration: 380, ease: 'Back.In',
      onComplete: () => {
        food.setPosition(home.x, home.y).setDepth(704).setAlpha(1);
        if (kind === 'a') this.draggingFoodA = false; else this.draggingFoodB = false;
      },
    });
    this.time.delayedCall(520, () => {
      dino.reacting = false;
      dino.sprite.setScale(DINO_SCALE).setAlpha(1);
      this.resumeRoaming(dino);
    });
  }

  private receiveAffection(dino: DinoEntity): void {
    if (dino.reacting || dino.bouncing || this.model.needFor(dino.index) !== 'affection') return;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.affection();
    if (this.model.fulfillNeed(dino.index, 'affection')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, angle: { from: -7, to: 7 }, scale: DINO_SCALE * 1.08, duration: 120, yoyo: true, repeat: 2 });
    this.time.delayedCall(650, () => {
      dino.reacting = false;
      dino.sprite.setAngle(0).setScale(DINO_SCALE).setAlpha(1);
      this.resumeRoaming(dino);
    });
  }

  private enjoyMusic(dino: DinoEntity): void {
    if (dino.reacting || this.model.needFor(dino.index) !== 'music' || this.time.now - this.lastMusicBump < 500) return;
    this.lastMusicBump = this.time.now;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.music();
    if (this.model.fulfillNeed(dino.index, 'music')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, y: dino.sprite.y - 8, angle: { from: -8, to: 8 }, duration: 150, yoyo: true, repeat: 3 });
    this.time.delayedCall(1050, () => {
      dino.reacting = false;
      dino.sprite.setAngle(0).setScale(DINO_SCALE).setAlpha(1);
      this.resumeRoaming(dino);
    });
  }

  private completeNeed(dino: DinoEntity): void {
    dino.bubble.setVisible(false);
    saveProgress(localStorage, this.model.serialize());
    this.flyHeartToScore(dino);
    this.updateProgress(true);
    this.celebrate(dino);
    if (this.model.newEggUnlocked) this.pauseCareForReward();
    else this.scheduleNeed(dino, 4200);
  }

  private pauseCareForReward(): void {
    for (const dino of this.dinos) {
      dino.needTimer?.remove(false);
      dino.needTimer = undefined;
      dino.bubble.setVisible(false);
    }
  }

  private flyHeartToScore(dino: DinoEntity): void {
    const heart = this.add.text(dino.sprite.x, dino.sprite.y - 45, '♥', {
      color: '#ff7f96', fontSize: '38px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({
      targets: heart,
      x: 94,
      y: 64,
      scale: 0.55,
      duration: 620,
      ease: 'Cubic.In',
      onComplete: () => heart.destroy(),
    });
  }

  private returnBallToTray(): void {
    this.stopFieldObject(this.ball);
    this.ballPlaced = false;
    this.draggingBall = false;
    this.tweens.killTweensOf(this.ball);
    this.ball.setPosition(BALL_HOME.x, BALL_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1).setAngle(0);
    this.armInventoryItem(this.ball);
  }

  private returnDrinkToTray(): void {
    this.stopFieldObject(this.drink);
    this.drinkPlaced = false;
    this.draggingDrink = false;
    this.tweens.killTweensOf(this.drink);
    this.drink.setPosition(DRINK_HOME.x, DRINK_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1).setAngle(0);
    this.armInventoryItem(this.drink);
  }

  private returnFoodToTray(kind: 'a' | 'b'): void {
    const food = kind === 'a' ? this.foodA : this.foodB;
    const home = kind === 'a' ? FOOD_A_HOME : FOOD_B_HOME;
    this.stopFieldObject(food);
    if (kind === 'a') {
      this.foodAPlaced = false;
      this.draggingFoodA = false;
    } else {
      this.foodBPlaced = false;
      this.draggingFoodB = false;
    }
    this.tweens.killTweensOf(food);
    food.setPosition(home.x, home.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1).setAngle(0);
    this.armInventoryItem(food);
  }

  private returnSpeakerToTray(): void {
    this.stopFieldObject(this.speaker);
    this.speakerPlaced = false;
    this.draggingSpeaker = false;
    this.tweens.killTweensOf(this.speaker);
    this.speaker.setPosition(SPEAKER_HOME.x, SPEAKER_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1).setAngle(0);
    this.armInventoryItem(this.speaker);
  }

  private lockPlacedItem(item: Phaser.GameObjects.Image): void {
    this.input.setDraggable(item, false);
    item.setInteractive({ useHandCursor: true });
  }

  private armInventoryItem(item: Phaser.GameObjects.Image): void {
    item.setInteractive({ useHandCursor: true });
    this.input.setDraggable(item, false);
  }

  private scheduleRoam(dino: DinoEntity, delay: number): void {
    if (dino.pausedForTest || dino.bouncing) return;
    dino.roamTimer?.remove(false);
    dino.roamTimer = this.time.delayedCall(delay, () => this.roam(dino));
  }

  private roam(dino: DinoEntity): void {
    if (dino.reacting || dino.bouncing) return this.scheduleRoam(dino, 800);
    const { x: targetX, y: targetY } = this.chooseRoamTarget(dino);
    dino.sprite.setFlipX(targetX < dino.sprite.x);
    const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, targetX, targetY);
    this.tweens.add({
      targets: dino.sprite, x: targetX, y: targetY, duration: Phaser.Math.Clamp(distance * 8, 650, 3600), ease: 'Sine.InOut',
      onComplete: () => {
        dino.sprite.setScale(DINO_SCALE).setFlipX(false).setAlpha(1);
        this.scheduleRoam(dino, Phaser.Math.Between(80, 220));
      },
    });
  }

  private chooseRoamTarget(dino: DinoEntity): Phaser.Math.Vector2 {
    const minX = FIELD.left + DINO_RADIUS;
    const maxX = FIELD.right - DINO_RADIUS;
    const minY = FIELD.top + DINO_RADIUS;
    const maxY = FIELD.bottom - DINO_RADIUS;
    const cannonClearance = DINO_RADIUS + CANNON_RADIUS + COLLISION_SKIN;
    const careTarget = this.nearbyCareDestination(dino);
    if (careTarget && !this.segmentIntersectsCircle(
      dino.sprite.x,
      dino.sprite.y,
      careTarget.x,
      careTarget.y,
      CANNON.x,
      CANNON.y,
      cannonClearance,
    )) return careTarget;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const direction = dino.sprite.x < minX + 150
        ? 1
        : dino.sprite.x > maxX - 150
          ? -1
          : Phaser.Math.RND.sign();
      let targetX = Phaser.Math.Clamp(
        dino.sprite.x + direction * Phaser.Math.Between(180, 420),
        minX,
        maxX,
      );
      let targetY = Phaser.Math.Clamp(dino.sprite.y + Phaser.Math.Between(-120, 120), minY, maxY);

      for (const { egg, radius } of this.visibleEggObstacles()) {
        const minimum = DINO_RADIUS + radius;
        if (Phaser.Math.Distance.Between(targetX, targetY, egg.x, egg.y) < minimum) {
          const angle = Phaser.Math.Angle.Between(egg.x, egg.y, targetX, targetY);
          targetX = egg.x + Math.cos(angle) * minimum;
          targetY = egg.y + Math.sin(angle) * minimum;
        }
      }
      for (const other of this.dinos) {
        if (other === dino) continue;
        if (Phaser.Math.Distance.Between(targetX, targetY, other.sprite.x, other.sprite.y) < DINO_RADIUS * 2) {
          const angle = Phaser.Math.Angle.Between(other.sprite.x, other.sprite.y, targetX, targetY);
          targetX = other.sprite.x + Math.cos(angle) * DINO_RADIUS * 2;
          targetY = other.sprite.y + Math.sin(angle) * DINO_RADIUS * 2;
        }
      }

      targetX = Phaser.Math.Clamp(targetX, minX, maxX);
      targetY = Phaser.Math.Clamp(targetY, minY, maxY);
      if (!this.segmentIntersectsCircle(
        dino.sprite.x,
        dino.sprite.y,
        targetX,
        targetY,
        CANNON.x,
        CANNON.y,
        cannonClearance,
      )) return new Phaser.Math.Vector2(targetX, targetY);
    }

    const awayAngle = Phaser.Math.Angle.Between(CANNON.x, CANNON.y, dino.sprite.x, dino.sprite.y);
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(dino.sprite.x + Math.cos(awayAngle) * 160, minX, maxX),
      Phaser.Math.Clamp(dino.sprite.y + Math.sin(awayAngle) * 160, minY, maxY),
    );
  }

  private nearbyCareDestination(dino: DinoEntity): Phaser.Math.Vector2 | undefined {
    const need = this.model.needFor(dino.index);
    const candidates: Phaser.GameObjects.Image[] = [];
    if (need === 'play' && this.ballPlaced && !this.draggingBall) candidates.push(this.ball);
    if (need === 'thirst' && this.drinkPlaced && !this.draggingDrink) candidates.push(this.drink);
    if (need === 'hunger') {
      if (this.foodAPlaced && !this.draggingFoodA) candidates.push(this.foodA);
      if (this.foodBPlaced && !this.draggingFoodB) candidates.push(this.foodB);
    }
    if (need === 'music' && this.speakerPlaced && !this.draggingSpeaker) candidates.push(this.speaker);

    const target = candidates
      .filter((item) => !this.movingFieldObjects.has(item))
      .map((item) => ({
        item,
        distance: Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, item.x, item.y),
      }))
      .filter(({ distance }) => distance <= CARE_ATTRACTION_RADIUS)
      .sort((first, second) => first.distance - second.distance)[0];
    if (!target) return undefined;

    const triggerDistance = need === 'music' ? MUSIC_PROXIMITY_RADIUS - 8 : CARE_COLLISION_RADIUS - 4;
    if (target.distance <= triggerDistance) return new Phaser.Math.Vector2(dino.sprite.x, dino.sprite.y);
    const travelRatio = (target.distance - triggerDistance) / target.distance;
    return new Phaser.Math.Vector2(
      dino.sprite.x + (target.item.x - dino.sprite.x) * travelRatio,
      dino.sprite.y + (target.item.y - dino.sprite.y) * travelRatio,
    );
  }

  private redirectDinosToNearbyCare(): void {
    for (const dino of this.dinos) this.redirectDinoToNearbyCare(dino);
  }

  private redirectDinoToNearbyCare(dino: DinoEntity): boolean {
    if (dino.pausedForTest || dino.reacting || dino.bouncing || !this.nearbyCareDestination(dino)) return false;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    dino.roamTimer = undefined;
    this.roam(dino);
    return true;
  }

  private resumeRoaming(dino: DinoEntity): void {
    if (!this.redirectDinoToNearbyCare(dino)) this.scheduleRoam(dino, 120);
  }

  private placeCareItemForTest(kind: InventoryItemKind, x: number, y: number): boolean {
    const item = kind === 'ball'
      ? this.ball
      : kind === 'drink'
        ? this.drink
        : kind === 'food-a'
          ? this.foodA
          : kind === 'food-b'
            ? this.foodB
            : this.speaker;
    this.stopFieldObject(item);
    item.setPosition(
      Phaser.Math.Clamp(x, FIELD.left + CARE_ITEM_RADIUS, FIELD.right - CARE_ITEM_RADIUS),
      Phaser.Math.Clamp(y, FIELD.top + CARE_ITEM_RADIUS, FIELD.bottom - CARE_ITEM_RADIUS),
    ).setScale(BALL_FIELD_SCALE).setAlpha(1).setAngle(0);
    if (kind === 'ball') this.ballPlaced = true;
    else if (kind === 'drink') this.drinkPlaced = true;
    else if (kind === 'food-a') this.foodAPlaced = true;
    else if (kind === 'food-b') this.foodBPlaced = true;
    else this.speakerPlaced = true;
    this.lockPlacedItem(item);
    this.resolveWorldCollisions();
    this.redirectDinosToNearbyCare();
    return true;
  }

  private segmentIntersectsCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    circleX: number,
    circleY: number,
    radius: number,
  ): boolean {
    const dx = endX - startX;
    const dy = endY - startY;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 0.001) {
      return Phaser.Math.Distance.Between(startX, startY, circleX, circleY) < radius;
    }
    const projection = Phaser.Math.Clamp(
      ((circleX - startX) * dx + (circleY - startY) * dy) / lengthSquared,
      0,
      1,
    );
    const closestX = startX + dx * projection;
    const closestY = startY + dy * projection;
    return Phaser.Math.Distance.Between(closestX, closestY, circleX, circleY) < radius;
  }

  private updateProgress(animate: boolean): void {
    const rewardReady = this.model.newEggUnlocked;
    this.heartLabel
      .setText(rewardReady ? 'OPEN YOUR EGG!' : `${this.model.hearts}  /  ${this.model.heartTarget}`)
      .setColor(rewardReady ? '#ffdc6e' : '#ffffff');
    if (animate) this.tweens.add({ targets: this.heartLabel, scale: 1.3, duration: 150, yoyo: true, ease: 'Back.Out' });
    if (animate && !rewardReady && this.model.hearts === Math.ceil(this.model.heartTarget / 2)) {
      this.showSparkles(148, 61, 0xffdc6e);
    }
    if (rewardReady && !this.rewardEgg.visible && !this.model.rewardEggHatching) {
      this.armRewardEgg();
      this.rewardEgg.setVisible(true).setAlpha(0).setScale(0).setDepth(REWARD_EGG_DEPTH);
      this.tweens.add({ targets: this.rewardEgg, scale: REWARD_EGG_SCALE, alpha: 1, duration: 700, ease: 'Back.Out' });
      this.showSparkles(this.rewardEgg.x, this.rewardEgg.y, 0xffdc6e);
    }
  }

  private celebrate(dino: DinoEntity): void {
    this.sounds.giggle();
    for (let index = 0; index < 5; index += 1) {
      const heart = this.add.text(dino.sprite.x + Phaser.Math.Between(-45, 45), dino.sprite.y - 70, '♥', {
        color: '#ef6d82', fontSize: `${Phaser.Math.Between(22, 34)}px`,
      }).setDepth(900);
      this.tweens.add({ targets: heart, y: heart.y - 95, alpha: 0, duration: 700 + index * 80, onComplete: () => heart.destroy() });
    }
  }

  private burstShell(x: number, y: number): void {
    for (let index = 0; index < 16; index += 1) {
      const piece = this.add.polygon(x, y, [0, 0, 9, 3, 6, 14, -4, 10], Phaser.Utils.Array.GetRandom([0xf8e5b7, 0xe9b99d, 0xc9786e])).setDepth(600);
      const angle = Phaser.Math.FloatBetween(Math.PI, Math.PI * 2);
      this.tweens.add({
        targets: piece, x: x + Math.cos(angle) * Phaser.Math.Between(60, 145),
        y: y + Math.sin(angle) * Phaser.Math.Between(60, 145) + 100,
        rotation: Phaser.Math.FloatBetween(-4, 4), alpha: 0, duration: Phaser.Math.Between(550, 850),
        onComplete: () => piece.destroy(),
      });
    }
  }

  private showSparkles(x: number, y: number, color: number): void {
    for (let index = 0; index < 10; index += 1) {
      const sparkle = this.add.star(x, y, 4, 3, 9, color, 0.95).setDepth(900);
      this.tweens.add({ targets: sparkle, x: x + Phaser.Math.Between(-90, 90), y: y + Phaser.Math.Between(-90, 50), scale: 0, alpha: 0, duration: 650, onComplete: () => sparkle.destroy() });
    }
  }

  private resetGame(): void {
    localStorage.removeItem(SAVE_KEY);
    this.model.reset();
    this.scene.restart();
  }
}
