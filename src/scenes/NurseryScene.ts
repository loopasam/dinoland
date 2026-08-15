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
const DINO_TINTS = [0x63c7d3, 0xf2a65a, 0x9bcf6b, 0xc89fe7, 0xe77f8f];

interface DinoEntity {
  index: number;
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Graphics;
  reacting: boolean;
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

  constructor() {
    super('NurseryScene');
  }

  create(): void {
    this.model = new GameModel(loadProgress(localStorage));
    this.createPlaceholderTextures();
    this.createMap();
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
        this.scheduleNeed(dino, 600 + index * 350);
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
    };
  }

  update(): void {
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

    this.setupItemDrag(this.ball, () => this.ballPlaced, () => this.draggingBall, (value) => { this.draggingBall = value; }, () => this.finishBallDrag());
    this.setupItemDrag(this.drink, () => this.drinkPlaced, () => this.draggingDrink, (value) => { this.draggingDrink = value; }, () => this.finishDrinkDrag());
    this.setupItemDrag(this.foodA, () => this.foodAPlaced, () => this.draggingFoodA, (value) => { this.draggingFoodA = value; }, () => this.finishFoodDrag('a'));
    this.setupItemDrag(this.foodB, () => this.foodBPlaced, () => this.draggingFoodB, (value) => { this.draggingFoodB = value; }, () => this.finishFoodDrag('b'));
    this.setupItemDrag(this.speaker, () => this.speakerPlaced, () => this.draggingSpeaker, (value) => { this.draggingSpeaker = value; }, () => this.finishSpeakerDrag());
  }

  private setupItemDrag(
    sprite: Phaser.GameObjects.Image,
    isPlaced: () => boolean,
    isDragging: () => boolean,
    setDragging: (value: boolean) => void,
    finish: () => void,
  ): void {
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(sprite);
    sprite.on('dragstart', () => {
      if (this.model.mode !== 'field') return;
      setDragging(true);
      sprite.setDepth(950);
      this.tweens.killTweensOf(sprite);
    });
    sprite.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!isDragging()) return;
      const fromTray = !isPlaced() && dragY >= FIELD.bottom + 20;
      sprite.setPosition(
        fromTray ? dragX : Phaser.Math.Clamp(dragX, FIELD.left + 28, FIELD.right - 28),
        fromTray ? dragY : Phaser.Math.Clamp(dragY, FIELD.top + 28, FIELD.bottom - 28),
      );
    });
    sprite.on('dragend', finish);
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
    this.add.text(40, 34, 'SCORE', { color: '#93a4af', fontSize: '16px', fontFamily: 'monospace' }).setDepth(802);
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
        const dino = this.spawnDino(index, point, true);
        this.showFirstNeed(dino);
        saveProgress(localStorage, this.model.serialize());
        this.resetRewardEgg();
        this.updateProgress(true);
        this.tweens.add({
          targets: dino.sprite, scale: DINO_SCALE, y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
          onComplete: () => {
            dino.sprite.setAlpha(1);
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
    const dino: DinoEntity = { index, sprite, bubble, icon, reacting: false };
    this.dinos.push(dino);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerup', () => {
      if (!dino.reacting && this.model.needFor(dino.index) === 'affection') {
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
  }

  private positionNeedBubble(dino: DinoEntity): void {
    dino.bubble.setPosition(dino.sprite.x, dino.sprite.y - NEED_BUBBLE_OFFSET_Y).setDepth(NEED_BUBBLE_DEPTH);
  }

  private resolveWorldCollisions(): void {
    if (this.model.mode !== 'field') return;
    for (const dino of this.dinos) {
      if (!dino.sprite.visible || dino.reacting) continue;
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
      this.scheduleRoam(dino, 900);
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
      this.scheduleRoam(dino, 900);
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
      this.scheduleRoam(dino, 900);
    });
  }

  private receiveAffection(dino: DinoEntity): void {
    if (dino.reacting || this.model.needFor(dino.index) !== 'affection') return;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.sounds.affection();
    if (this.model.fulfillNeed(dino.index, 'affection')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, angle: { from: -7, to: 7 }, scale: DINO_SCALE * 1.08, duration: 120, yoyo: true, repeat: 2 });
    this.time.delayedCall(650, () => {
      dino.reacting = false;
      dino.sprite.setAngle(0).setScale(DINO_SCALE).setAlpha(1);
      this.scheduleRoam(dino, 900);
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
      this.scheduleRoam(dino, 900);
    });
  }

  private completeNeed(dino: DinoEntity): void {
    dino.bubble.setVisible(false);
    saveProgress(localStorage, this.model.serialize());
    this.updateProgress(true);
    this.celebrate(dino);
    this.scheduleNeed(dino, 4200);
  }

  private finishBallDrag(): void {
    this.draggingBall = false;
    if (this.model.mode !== 'field') return this.returnBallToTray();
    const inside = this.ball.x >= FIELD.left && this.ball.x <= FIELD.right
      && this.ball.y >= FIELD.top && this.ball.y <= FIELD.bottom;
    if (!inside) return this.returnBallToTray();
    this.ballPlaced = true;
    this.ball.setScale(BALL_FIELD_SCALE).setAlpha(1);
    this.resolveWorldCollisions();
  }

  private returnBallToTray(): void {
    this.ballPlaced = false;
    this.ball.setPosition(BALL_HOME.x, BALL_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1);
  }

  private finishDrinkDrag(): void {
    this.draggingDrink = false;
    if (this.model.mode !== 'field') return this.returnDrinkToTray();
    const inside = this.drink.x >= FIELD.left && this.drink.x <= FIELD.right
      && this.drink.y >= FIELD.top && this.drink.y <= FIELD.bottom;
    if (!inside) return this.returnDrinkToTray();
    this.drinkPlaced = true;
    this.drink.setScale(BALL_FIELD_SCALE).setAlpha(1);
    this.resolveWorldCollisions();
  }

  private returnDrinkToTray(): void {
    this.drinkPlaced = false;
    this.drink.setPosition(DRINK_HOME.x, DRINK_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1);
  }

  private finishFoodDrag(kind: 'a' | 'b'): void {
    const food = kind === 'a' ? this.foodA : this.foodB;
    if (kind === 'a') this.draggingFoodA = false; else this.draggingFoodB = false;
    if (this.model.mode !== 'field') return this.returnFoodToTray(kind);
    const inside = food.x >= FIELD.left && food.x <= FIELD.right
      && food.y >= FIELD.top && food.y <= FIELD.bottom;
    if (!inside) return this.returnFoodToTray(kind);
    if (kind === 'a') this.foodAPlaced = true; else this.foodBPlaced = true;
    food.setScale(BALL_FIELD_SCALE).setAlpha(1);
    this.resolveWorldCollisions();
  }

  private returnFoodToTray(kind: 'a' | 'b'): void {
    const food = kind === 'a' ? this.foodA : this.foodB;
    const home = kind === 'a' ? FOOD_A_HOME : FOOD_B_HOME;
    if (kind === 'a') this.foodAPlaced = false; else this.foodBPlaced = false;
    food.setPosition(home.x, home.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1);
  }

  private finishSpeakerDrag(): void {
    this.draggingSpeaker = false;
    if (this.model.mode !== 'field') return this.returnSpeakerToTray();
    const inside = this.speaker.x >= FIELD.left && this.speaker.x <= FIELD.right
      && this.speaker.y >= FIELD.top && this.speaker.y <= FIELD.bottom;
    if (!inside) return this.returnSpeakerToTray();
    this.speakerPlaced = true;
    this.speaker.setScale(BALL_FIELD_SCALE).setAlpha(1);
    this.sounds.music();
    this.tweens.add({ targets: this.speaker, scale: BALL_FIELD_SCALE * 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.resolveWorldCollisions();
  }

  private returnSpeakerToTray(): void {
    this.speakerPlaced = false;
    this.tweens.killTweensOf(this.speaker);
    this.speaker.setPosition(SPEAKER_HOME.x, SPEAKER_HOME.y).setScale(BALL_TRAY_SCALE).setDepth(704).setAlpha(1);
  }

  private scheduleRoam(dino: DinoEntity, delay: number): void {
    if (dino.pausedForTest) return;
    dino.roamTimer?.remove(false);
    dino.roamTimer = this.time.delayedCall(delay, () => this.roam(dino));
  }

  private roam(dino: DinoEntity): void {
    if (dino.reacting) return this.scheduleRoam(dino, 800);
    const rawX = dino.sprite.x + Phaser.Math.Between(-380, 380);
    const rawY = dino.sprite.y + Phaser.Math.Between(-210, 210);
    let targetX = Phaser.Math.Clamp(rawX, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS);
    let targetY = Phaser.Math.Clamp(rawY, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS);
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
    targetX = Phaser.Math.Clamp(targetX, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS);
    targetY = Phaser.Math.Clamp(targetY, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS);
    dino.sprite.setFlipX(targetX < dino.sprite.x);
    const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, targetX, targetY);
    this.tweens.add({
      targets: dino.sprite, x: targetX, y: targetY, duration: Phaser.Math.Clamp(distance * 14, 2800, 6800), ease: 'Sine.InOut',
      onComplete: () => {
        dino.sprite.setScale(DINO_SCALE).setFlipX(false).setAlpha(1);
        this.scheduleRoam(dino, Phaser.Math.Between(1500, 3000));
      },
    });
  }

  private updateProgress(animate: boolean): void {
    this.heartLabel.setText(`${this.model.hearts}  /  ${this.model.heartTarget}`);
    if (animate) this.tweens.add({ targets: this.heartLabel, scale: 1.3, duration: 150, yoyo: true, ease: 'Back.Out' });
    if (this.model.newEggUnlocked && !this.rewardEgg.visible && !this.model.rewardEggHatching) {
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
