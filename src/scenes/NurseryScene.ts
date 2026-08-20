import Phaser from 'phaser';
import { DinoMotion, DinoRig } from '../art/DinoRig';
import { createDinoRig } from '../art/createDinoRig';
import { SoundGarden } from '../audio/SoundGarden';
import { DINO_PROFILES, DinoProfile } from '../game/DinoSpecies';
import {
  DinoNeed,
  GameModel,
  growthScaleForCareCount,
  INVENTORY_NEEDS,
  loadProgress,
  saveProgress,
  SAVE_KEY,
} from '../game/GameModel';

const WIDTH = 1280;
const HEIGHT = 720;
const FIELD = { left: 26, right: 1254, top: 70, bottom: 630 };
const EGG_SCALE = 0.78;
const REWARD_EGG_SCALE = 0.58;
const ITEM_TRAY_SCALE = 0.56;
const ITEM_FIELD_SCALE = 0.9;
const DINO_RADIUS = 30;
const CARE_ITEM_RADIUS = 27;
const CARE_COLLISION_RADIUS = DINO_RADIUS + CARE_ITEM_RADIUS;
const EGG_COLLISION_RADIUS = 40;
const NEED_BUBBLE_OFFSET_Y = 62;
const NEED_BUBBLE_SCALE = 0.78;
const NEXT_NEED_DELAY_MS = 900;
const NEED_BUBBLE_DEPTH = 680;
const REWARD_EGG_DEPTH = 640;
const EGG_HOME = { x: 490, y: 360 };
const REWARD_EGG_HOME = { x: 760, y: 285 };
type CareItemName = 'apple' | 'ball' | 'water' | 'music' | 'heart';
interface ItemDefinition {
  name: CareItemName;
  label: string;
  color: number;
  home: { x: number; y: number };
}
const ITEM_DEFINITIONS: Record<DinoNeed, ItemDefinition> = {
  hunger: { name: 'apple', label: 'APPLE', color: 0xe06c75, home: { x: 44, y: 675 } },
  play: { name: 'ball', label: 'BALL', color: 0x6aa9e9, home: { x: 103, y: 675 } },
  thirst: { name: 'water', label: 'WATER', color: 0x63c7d3, home: { x: 162, y: 675 } },
  music: { name: 'music', label: 'MUSIC', color: 0xc89fe7, home: { x: 221, y: 675 } },
  affection: { name: 'heart', label: 'HEART', color: 0xe77f8f, home: { x: 280, y: 675 } },
};
const LOOT_HOME = { x: 945, y: 470 };
const LOOT_RADIUS = 34;
const CANNON = { x: 640, y: 348 };
const FIRE_CONTROL = { x: 700, y: 675 };
const POWER_CONTROL = { left: 800, center: 895, y: 675 };
const CANNON_RADIUS = 44;
const CANNON_MUZZLE_DISTANCE = CANNON_RADIUS + CARE_ITEM_RADIUS + 5;
const CANNON_CHARGE_MS = 1700;
const KEYBOARD_AIM_SPEED = Math.PI * 0.9;
const PHYSICS_RESTITUTION = 0.9;
const PHYSICS_FRICTION = 0.4;
const PHYSICS_STOP_SPEED = 34;
const MAX_PHYSICS_FRAME_MS = 160;
const COLLISION_SKIN = 4;
interface CannonShot {
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
  profile: DinoProfile;
  sprite: Phaser.GameObjects.Image;
  rig: DinoRig;
  bubble: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  reacting: boolean;
  bouncing: boolean;
  bounceVx: number;
  bounceVy: number;
  bounceAge: number;
  pausedForTest?: boolean;
  needDueAt?: number;
  roamTimer?: Phaser.Time.TimerEvent;
}

export class NurseryScene extends Phaser.Scene {
  private model!: GameModel;
  private sounds = new SoundGarden();
  private egg!: Phaser.GameObjects.Image;
  private rewardEgg!: Phaser.GameObjects.Image;
  private inventoryItems = new Map<DinoNeed, Phaser.GameObjects.Image>();
  private inventoryLocks = new Map<DinoNeed, Phaser.GameObjects.Container>();
  private inventoryLabels = new Map<DinoNeed, Phaser.GameObjects.Text>();
  private careItemNeeds = new Map<Phaser.GameObjects.Image, DinoNeed>();
  private fieldCareItems = new Set<Phaser.GameObjects.Image>();
  private lootBox!: Phaser.GameObjects.Image;
  private boostLabel!: Phaser.GameObjects.Text;
  private crack!: Phaser.GameObjects.Graphics;
  private rewardCrack!: Phaser.GameObjects.Graphics;
  private heartLabel!: Phaser.GameObjects.Text;
  private heartIcons: Phaser.GameObjects.Image[] = [];
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
  private lastCareBump = 0;
  private cannonAimGuide!: Phaser.GameObjects.Graphics;
  private cannonBarrel!: Phaser.GameObjects.Container;
  private flowerHead!: Phaser.GameObjects.Container;
  private flowerBoostOrbit!: Phaser.GameObjects.Container;
  private cannonPowerFill!: Phaser.GameObjects.Rectangle;
  private cannonFireButton!: Phaser.GameObjects.Container;
  private cannonFireLabel!: Phaser.GameObjects.Text;
  private cannonBoostGlow!: Phaser.GameObjects.Arc;
  private boostPulse?: Phaser.Tweens.Tween;
  private boostOrbitTween?: Phaser.Tweens.Tween;
  private lootAnnouncement?: Phaser.GameObjects.Container;
  private cannonAngle = -Math.PI / 2;
  private cannonLoadedItem?: Phaser.GameObjects.Image;
  private cannonShot?: CannonShot;
  private cannonAiming = false;
  private keyboardAiming = false;
  private keyboardControls?: Phaser.Types.Input.Keyboard.CursorKeys;
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
  private lastPhysicsAt = 0;

  constructor() {
    super('NurseryScene');
  }

  create(): void {
    const savedProgress = loadProgress(localStorage);
    this.model = new GameModel(savedProgress);
    if (this.model.mode === 'field' && savedProgress.dinoSpecies.length < this.model.dinoCount) {
      saveProgress(localStorage, this.model.serialize());
    }
    this.inventoryItems.clear();
    this.inventoryLocks.clear();
    this.inventoryLabels.clear();
    this.careItemNeeds.clear();
    this.fieldCareItems.clear();
    this.movingFieldObjects.clear();
    this.dinos = [];
    this.cannonLoadedItem = undefined;
    this.cannonShot = undefined;
    this.lastPhysicsAt = performance.now();
    this.boostPulse = undefined;
    this.boostOrbitTween = undefined;
    this.lootAnnouncement = undefined;
    this.createGameTextures();
    this.createMap();
    this.createCannon();
    this.createItemTray();
    this.createEggs();
    this.createLootBox();
    this.createProgress();
    this.createControls();
    this.createKeyboardControls();
    this.input.on('pointerdown', () => this.sounds.unlock());

    if (this.model.mode === 'field') {
      this.egg.setVisible(false);
      for (let index = 0; index < this.model.dinoCount; index += 1) {
        const dino = this.spawnDino(index, this.spawnPointFor(index), false);
        this.scheduleRoam(dino, 900 + index * 350);
        if (!this.model.newEggUnlocked) this.scheduleNeed(dino, 600 + index * 350);
      }
      this.refreshRewardEgg();
      this.refreshLootBox();
    } else {
      this.rewardEgg.setVisible(false);
      this.lootBox.setVisible(false);
      this.updateInventory();
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
        dino.sprite.setScale(this.dinoScale(dino)).setAlpha(1).setAngle(0);
      },
      fulfillActiveNeed: (dinoIndex) => {
        const dino = this.dinos[dinoIndex];
        const need = this.model.needFor(dinoIndex);
        if (!dino || !need || !this.model.fulfillNeed(dinoIndex, need)) return false;
        this.completeNeed(dino, need);
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
      placeCareItem: (need, x, y) => this.placeCareItemForTest(need, x, y),
    };
  }

  update(_time: number, delta: number): void {
    const physicsSeconds = this.physicsSeconds(delta);
    this.updateKeyboardControls(physicsSeconds);
    this.updateCannon(physicsSeconds);
    this.updateDinoBounces(physicsSeconds);
    for (const dino of this.dinos) {
      dino.sprite.setDepth(20 + Math.round(dino.sprite.y));
      this.syncDinoVisual(dino);
      this.positionNeedBubble(dino);
      let activeNeed = this.model.needFor(dino.index);
      if (!activeNeed && dino.needDueAt !== undefined && performance.now() >= dino.needDueAt) {
        dino.needDueAt = undefined;
        activeNeed = this.model.requestNeed(dino.index);
        if (activeNeed) this.showNeed(dino, activeNeed);
      }
      if (activeNeed && (!dino.bubble.visible || dino.bubble.alpha < 0.99)) {
        this.showNeed(dino, activeNeed, true);
      }
    }
    for (const item of this.fieldCareItems) item.setDepth(20 + Math.round(item.y));
    this.resolveDinoSeparation();
    this.resolveWorldCollisions();
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
      fireControlSymbol: this.cannonFireLabel.text,
      cannonLoaded: this.cannonLoadedItem ? this.itemName(this.needForItem(this.cannonLoadedItem)) : null,
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
      dinoTypes: this.dinos.map((dino) => dino.profile.species),
      dinoPersonalities: this.dinos.map((dino) => dino.profile.kind),
      riggedDinoCount: this.dinos.length,
      firstDinoMotion: first?.rig.currentMotion ?? null,
      dinoScales: this.dinos.map((dino) => Number(this.dinoScale(dino).toFixed(3))),
      dinoCareCounts: this.dinos.map((dino) => this.model.careCountFor(dino.index)),
      newEggUnlocked: this.model.newEggUnlocked,
      secondEggVisible: this.rewardEgg.visible,
      secondEggTaps: this.model.rewardEggTaps,
      secondEggBusy: this.rewardEggBusy,
      secondDinoVisible: Boolean(second?.sprite.visible),
      secondDinoAlpha: second?.sprite.alpha ?? 0,
      firstBubbleVisible: first?.bubble.visible ?? false,
      firstBubbleItem: first?.icon.texture.key ?? null,
      secondBubbleVisible: second?.bubble.visible ?? false,
      secondBubbleAlpha: second?.bubble.alpha ?? 0,
      secondBubbleX: Math.round(second?.bubble.x ?? 0),
      secondBubbleY: Math.round(second?.bubble.y ?? 0),
      firstBubbleAlpha: first?.bubble.alpha ?? 0,
      firstBubbleX: Math.round(first?.bubble.x ?? 0),
      firstBubbleY: Math.round(first?.bubble.y ?? 0),
      fieldItemCount: this.fieldCareItems.size,
      fieldItems: [...this.fieldCareItems].map((item) => ({
        type: this.itemName(this.needForItem(item)),
        x: Math.round(item.x),
        y: Math.round(item.y),
      })),
      unlockedSlots: this.model.unlockedSlots,
      lootReady: this.model.lootReady,
      lootVisible: this.lootBox.visible,
      cannonBoostReady: this.model.cannonBoostReady,
      magicSlotSymbol: this.boostLabel.text,
      soundMuted: this.sounds.isMuted,
      heartTextures: this.heartIcons.map((heart) => heart.texture.key),
      lootCelebrationVisible: this.lootAnnouncement?.visible ?? false,
      lootX: Math.round(this.lootBox.x),
      lootY: Math.round(this.lootBox.y),
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

  private createGameTextures(): void {
    if (this.textures.exists('dino')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const ink = 0x2f453f;
    const deepInk = 0x20332e;
    const cream = 0xfff2cf;
    const highlight = 0xfff9e8;
    const peach = 0xee8f79;
    const rose = 0xec7188;
    const leaf = 0x74ad68;
    const deepLeaf = 0x44785a;
    const sky = 0x72cad7;
    const honey = 0xe0a65e;
    const purple = 0xa77ac7;

    const drawObjectShadow = (x = 30, y = 53, width = 44): void => {
      graphics.fillStyle(deepInk, 0.18).fillEllipse(x, y, width, 10);
    };

    const drawHeart = (x: number, y: number, scale: number, fill: number, stroke: number): void => {
      const points = Array.from({ length: 72 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2;
        return new Phaser.Math.Vector2(
          x + Math.pow(Math.sin(angle), 3) * 21 * scale,
          y - (14 * Math.cos(angle) - 5 * Math.cos(angle * 2) - 2 * Math.cos(angle * 3) - Math.cos(angle * 4)) * scale,
        );
      });
      graphics.fillStyle(fill, 1).fillPoints(points, true);
      graphics.lineStyle(3.5 * scale, stroke, 1).strokePoints(points, true);
    };

    graphics.fillStyle(0xffffff, 1).fillRect(4, 4, 72, 72);
    graphics.lineStyle(5, 0x182027, 1).strokeRect(4, 4, 72, 72);
    graphics.lineStyle(3, 0x182027, 0.75).lineBetween(4, 4, 76, 76).lineBetween(76, 4, 4, 76);
    graphics.generateTexture('dino', 80, 80);
    graphics.clear();

    graphics.fillStyle(0xffffff, 0.001).fillRect(0, 0, 110, 110);
    graphics.generateTexture('dino-hitbox', 110, 110);
    graphics.clear();

    graphics.fillStyle(deepInk, 0.2).fillEllipse(40, 96, 62, 12);
    graphics.fillStyle(0xd99c73, 1).fillEllipse(42, 54, 68, 94);
    graphics.fillStyle(cream, 1).fillEllipse(39, 50, 68, 94);
    graphics.lineStyle(5, ink, 1).strokeEllipse(39, 50, 68, 94);
    graphics.fillStyle(peach, 0.95)
      .fillEllipse(24, 37, 20, 25)
      .fillEllipse(52, 63, 23, 19)
      .fillEllipse(28, 76, 14, 11);
    graphics.lineStyle(3, ink, 0.72)
      .strokeEllipse(24, 37, 20, 25)
      .strokeEllipse(52, 63, 23, 19)
      .strokeEllipse(28, 76, 14, 11);
    graphics.fillStyle(highlight, 0.95).fillEllipse(27, 23, 12, 23);
    graphics.fillStyle(0xffffff, 0.62).fillCircle(51, 30, 4);
    graphics.generateTexture('egg', 80, 104);
    graphics.clear();

    drawObjectShadow();
    graphics.fillStyle(0xb94f5f, 1).fillCircle(31, 34, 22);
    graphics.fillStyle(rose, 1).fillCircle(29, 31, 22);
    graphics.lineStyle(4, ink, 1).strokeCircle(29, 31, 22);
    graphics.fillStyle(0xffa2ad, 0.95).fillEllipse(20, 22, 8, 13);
    graphics.lineStyle(5, 0x6a4a35, 1).lineBetween(30, 13, 34, 5);
    graphics.fillStyle(leaf, 1).fillEllipse(43, 10, 21, 11);
    graphics.lineStyle(3, ink, 1).strokeEllipse(43, 10, 21, 11);
    graphics.lineStyle(2, deepLeaf, 0.8).lineBetween(34, 11, 49, 9);
    graphics.fillStyle(cream, 0.85).fillCircle(39, 39, 2.5);
    graphics.generateTexture('apple', 60, 60);
    graphics.clear();

    drawObjectShadow(30, 54, 45);
    graphics.fillStyle(0x3f82b5, 1).fillCircle(32, 32, 24);
    graphics.fillStyle(0x69b7df, 1).fillCircle(29, 29, 24);
    graphics.fillStyle(0xf4cd65, 1).fillTriangle(28, 5, 17, 30, 30, 29);
    graphics.fillStyle(peach, 1).fillTriangle(53, 27, 31, 29, 43, 46);
    graphics.fillStyle(purple, 1).fillTriangle(20, 51, 29, 31, 42, 47);
    graphics.lineStyle(3, cream, 0.9).lineBetween(10, 19, 49, 42).lineBetween(13, 43, 47, 15);
    graphics.lineStyle(4, ink, 1).strokeCircle(29, 29, 24);
    graphics.fillStyle(highlight, 0.9).fillCircle(19, 17, 4);
    graphics.generateTexture('ball', 60, 60);
    graphics.clear();

    drawObjectShadow(30, 54, 42);
    graphics.fillStyle(0x398fa8, 1).fillRoundedRect(13, 17, 38, 36, 13);
    graphics.fillStyle(sky, 1).fillRoundedRect(10, 14, 38, 36, 13);
    graphics.lineStyle(4, ink, 1).strokeRoundedRect(10, 14, 38, 36, 13);
    graphics.fillStyle(cream, 1).fillRoundedRect(20, 7, 20, 10, 4);
    graphics.lineStyle(3, ink, 1).strokeRoundedRect(20, 7, 20, 10, 4);
    graphics.fillStyle(0xdaf7f4, 0.9).fillEllipse(19, 27, 7, 15);
    graphics.lineStyle(3, 0xffffff, 0.75).lineBetween(18, 43, 40, 43);
    graphics.fillStyle(deepLeaf, 0.9).fillEllipse(36, 32, 12, 8);
    graphics.lineStyle(2, ink, 0.75).strokeEllipse(36, 32, 12, 8);
    graphics.generateTexture('water', 60, 60);
    graphics.clear();

    drawObjectShadow(30, 54, 48);
    graphics.fillStyle(0x755494, 1).fillRoundedRect(8, 18, 47, 35, 9);
    graphics.fillStyle(purple, 1).fillRoundedRect(6, 14, 47, 35, 9);
    graphics.lineStyle(4, ink, 1).strokeRoundedRect(6, 14, 47, 35, 9);
    graphics.lineStyle(4, ink, 1).lineBetween(18, 14, 23, 7).lineBetween(23, 7, 39, 7).lineBetween(39, 7, 45, 14);
    graphics.fillStyle(deepInk, 1).fillCircle(19, 33, 9).fillCircle(40, 33, 9);
    graphics.lineStyle(2, cream, 0.8).strokeCircle(19, 33, 7).strokeCircle(40, 33, 7);
    graphics.fillStyle(sky, 1).fillCircle(19, 33, 3.5);
    graphics.fillStyle(honey, 1).fillCircle(40, 33, 3.5);
    graphics.fillStyle(highlight, 0.9).fillCircle(14, 21, 2.5).fillCircle(21, 21, 2.5);
    graphics.lineStyle(3, cream, 0.95).lineBetween(47, 7, 47, 0).lineBetween(47, 1, 54, 0).lineBetween(54, 0, 54, 7);
    graphics.fillStyle(cream, 1).fillCircle(47, 8, 3).fillCircle(54, 8, 3);
    graphics.generateTexture('music', 60, 60);
    graphics.clear();

    drawObjectShadow(30, 55, 43);
    drawHeart(30, 27, 1, rose, ink);
    graphics.fillStyle(0xffafbc, 0.95).fillEllipse(19, 18, 7, 11);
    graphics.fillStyle(highlight, 0.85).fillCircle(40, 20, 3);
    graphics.generateTexture('heart', 60, 60);
    graphics.clear();

    drawHeart(30, 27, 1, 0x475853, 0x718d83);
    graphics.fillStyle(0x81928b, 0.3).fillEllipse(19, 18, 7, 11);
    graphics.generateTexture('heart-empty', 60, 60);
    graphics.clear();

    graphics.fillStyle(deepInk, 0.18).fillEllipse(25, 43, 34, 7);
    drawHeart(25, 22, 0.72, 0xf8e9cc, 0xb99b79);
    graphics.fillStyle(0xffffff, 0.4).fillEllipse(18, 16, 4, 7);
    graphics.generateTexture('score-heart-empty', 50, 50);
    graphics.clear();
    graphics.fillStyle(deepInk, 0.18).fillEllipse(25, 43, 34, 7);
    drawHeart(25, 22, 0.72, rose, 0x8d4154);
    graphics.fillStyle(0xffc2ca, 0.95).fillEllipse(18, 16, 4, 7);
    graphics.fillStyle(highlight, 0.75).fillCircle(31, 16, 2);
    graphics.generateTexture('score-heart', 50, 50);
    graphics.clear();

    graphics.fillStyle(deepInk, 0.22).fillEllipse(40, 72, 66, 12);
    graphics.fillStyle(0x765693, 1).fillRoundedRect(8, 22, 66, 49, 9);
    graphics.fillStyle(purple, 1).fillRoundedRect(6, 17, 66, 49, 9);
    graphics.lineStyle(4, ink, 1).strokeRoundedRect(6, 17, 66, 49, 9);
    graphics.fillStyle(honey, 1).fillRoundedRect(34, 17, 12, 49, 3).fillRoundedRect(6, 35, 66, 11, 3);
    graphics.lineStyle(2.5, ink, 0.9).strokeRoundedRect(34, 17, 12, 49, 3);
    graphics.fillStyle(0xf7c96f, 1).fillEllipse(28, 13, 28, 15).fillEllipse(52, 13, 28, 15);
    graphics.lineStyle(3, ink, 1).strokeEllipse(28, 13, 28, 15).strokeEllipse(52, 13, 28, 15);
    graphics.fillStyle(honey, 1).fillCircle(40, 16, 8);
    graphics.lineStyle(3, ink, 1).strokeCircle(40, 16, 8);
    graphics.fillStyle(highlight, 0.8).fillEllipse(18, 27, 12, 5);
    graphics.fillStyle(cream, 1).fillCircle(40, 40, 5);
    graphics.lineStyle(2, ink, 0.85).strokeCircle(40, 40, 5);
    graphics.generateTexture('loot', 80, 80);
    graphics.destroy();
  }

  private createMap(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xc5df8b).setDepth(-4);
    this.add.rectangle(
      (FIELD.left + FIELD.right) / 2,
      (FIELD.top + FIELD.bottom) / 2,
      FIELD.right - FIELD.left,
      FIELD.bottom - FIELD.top,
      0x6d9a69,
    ).setDepth(-3);

    this.drawMeadowDetails();
    this.drawFence();
  }

  private drawMeadowDetails(): void {
    const ground = this.add.graphics().setDepth(-2);
    ground.fillStyle(0x86ae73, 0.42)
      .fillEllipse(240, 190, 420, 210)
      .fillEllipse(1020, 480, 470, 240);
    ground.fillStyle(0x567e5d, 0.25)
      .fillEllipse(1060, 170, 350, 155)
      .fillEllipse(260, 510, 390, 175);

    ground.lineStyle(30, 0xb7a979, 0.19).strokeEllipse(CANNON.x, CANNON.y, 570, 310);
    ground.lineStyle(4, 0xe0d39a, 0.12).strokeEllipse(CANNON.x, CANNON.y, 570, 310);

    const grass = this.add.graphics().setDepth(-1);
    for (let index = 0; index < 58; index += 1) {
      const x = FIELD.left + 54 + ((index * 149) % (FIELD.right - FIELD.left - 108));
      const y = FIELD.top + 45 + ((index * 83) % (FIELD.bottom - FIELD.top - 90));
      if (Phaser.Math.Distance.Between(x, y, CANNON.x, CANNON.y) < 105) continue;
      const shade = index % 3 === 0 ? 0x315f4e : 0x4e7955;
      grass.lineStyle(2, shade, 0.34)
        .lineBetween(x, y + 5, x - 4, y - 3)
        .lineBetween(x, y + 5, x + 1, y - 6)
        .lineBetween(x, y + 5, x + 6, y - 1);
    }

    const flowers = this.add.graphics().setDepth(-1);
    const flowerPatches = [
      { x: 100, y: 135, color: 0xf3d879 },
      { x: 160, y: 560, color: 0xeaa0a7 },
      { x: 1120, y: 125, color: 0xd9b2e7 },
      { x: 1175, y: 540, color: 0xf3d879 },
      { x: 1030, y: 565, color: 0xeaa0a7 },
    ];
    for (const patch of flowerPatches) {
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2;
        flowers.fillStyle(patch.color, 0.72).fillCircle(
          patch.x + Math.cos(angle) * 5,
          patch.y + Math.sin(angle) * 5,
          3,
        );
      }
      flowers.fillStyle(0xf3df8a, 0.9).fillCircle(patch.x, patch.y, 2.5);
    }
  }

  private drawFence(): void {
    const fence = this.add.graphics().setDepth(580);
    fence.lineStyle(16, 0x263630, 0.62).strokeRect(
      FIELD.left,
      FIELD.top,
      FIELD.right - FIELD.left,
      FIELD.bottom - FIELD.top,
    );
    fence.lineStyle(8, 0xb88352, 1).strokeRect(
      FIELD.left,
      FIELD.top,
      FIELD.right - FIELD.left,
      FIELD.bottom - FIELD.top,
    );
    fence.lineStyle(2, 0xe1b570, 0.72).strokeRect(
      FIELD.left,
      FIELD.top,
      FIELD.right - FIELD.left,
      FIELD.bottom - FIELD.top,
    );

    for (let x = FIELD.left; x <= FIELD.right; x += 82) {
      fence.fillStyle(0x8f603e, 1).fillRoundedRect(x - 5, FIELD.top - 10, 10, 20, 3);
      fence.fillStyle(0xd19a5d, 1).fillTriangle(x - 5, FIELD.top - 10, x + 5, FIELD.top - 10, x, FIELD.top - 17);
      fence.fillStyle(0x8f603e, 1).fillRoundedRect(x - 5, FIELD.bottom - 10, 10, 20, 3);
      fence.fillStyle(0xd19a5d, 1).fillTriangle(x - 5, FIELD.bottom - 10, x + 5, FIELD.bottom - 10, x, FIELD.bottom - 17);
    }
    for (let y = FIELD.top + 72; y < FIELD.bottom; y += 82) {
      fence.fillStyle(0x8f603e, 1).fillRoundedRect(FIELD.left - 5, y - 10, 10, 20, 3);
      fence.fillStyle(0x8f603e, 1).fillRoundedRect(FIELD.right - 5, y - 10, 10, 20, 3);
    }
  }

  private createCannon(): void {
    this.cannonAimGuide = this.add.graphics().setDepth(620);
    this.cannonBoostGlow = this.add.circle(CANNON.x, CANNON.y, 58, 0xf9e66e, 0.14)
      .setStrokeStyle(4, 0xffef84, 0.95).setDepth(622).setVisible(false);

    this.add.circle(CANNON.x, CANNON.y, 35, 0x6f4d38, 1)
      .setStrokeStyle(5, 0x263630, 1).setDepth(623);
    this.add.ellipse(CANNON.x, CANNON.y + 8, 58, 23, 0x3f6b48, 0.58).setDepth(624);

    const orbitPetals: Phaser.GameObjects.Arc[] = [];
    for (let index = 0; index < 7; index += 1) {
      const angle = (index / 7) * Math.PI * 2;
      orbitPetals.push(this.add.circle(
        Math.cos(angle) * 49,
        Math.sin(angle) * 49,
        index % 2 === 0 ? 4 : 3,
        index % 2 === 0 ? 0xffef84 : 0xf3a2cc,
        0.95,
      ));
    }
    this.flowerBoostOrbit = this.add.container(CANNON.x, CANNON.y, orbitPetals)
      .setDepth(624).setVisible(false);

    const stem = this.add.rectangle(28, 0, 62, 13, 0x4f9d62, 1)
      .setStrokeStyle(4, 0x263630, 1);
    const upperLeaf = this.add.ellipse(21, -11, 28, 14, 0x78bd68, 1)
      .setStrokeStyle(3, 0x263630, 1).setRotation(-0.45);
    const lowerLeaf = this.add.ellipse(36, 11, 27, 13, 0x63ab5e, 1)
      .setStrokeStyle(3, 0x263630, 1).setRotation(0.5);

    const petals: Phaser.GameObjects.Ellipse[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      petals.push(this.add.ellipse(
        Math.cos(angle) * 15,
        Math.sin(angle) * 15,
        26,
        17,
        index % 2 === 0 ? 0xf28fbd : 0xf7abc9,
        1,
      ).setStrokeStyle(3, 0x6c4158, 1).setRotation(angle));
    }
    const flowerCenter = this.add.circle(0, 0, 13, 0xffdc6e, 1)
      .setStrokeStyle(4, 0x6c4d2d, 1);
    const centerShine = this.add.circle(-4, -4, 3, 0xfff4b5, 0.95);
    this.flowerHead = this.add.container(62, 0, [...petals, flowerCenter, centerShine]);

    this.cannonBarrel = this.add.container(CANNON.x, CANNON.y, [stem, upperLeaf, lowerLeaf, this.flowerHead])
      .setSize(140, 72).setRotation(this.cannonAngle).setDepth(627)
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

    const controlPanel = this.add.graphics().setDepth(701);
    controlPanel.fillStyle(0x20332e, 0.28).fillRoundedRect(644, 643, 600, 75, 17);
    controlPanel.fillStyle(0x9d6d47, 1).fillRoundedRect(640, 638, 600, 76, 17);
    controlPanel.fillStyle(0xd6a762, 1).fillRoundedRect(640, 634, 600, 76, 17);
    controlPanel.lineStyle(4, 0x2f453f, 1).strokeRoundedRect(640, 634, 600, 76, 17);
    controlPanel.lineStyle(2, 0xffe0a0, 0.8).lineBetween(659, 643, 1220, 643);
    controlPanel.fillStyle(0x6f9c61, 0.95)
      .fillEllipse(657, 649, 18, 9)
      .fillEllipse(1224, 696, 18, 9);
    controlPanel.lineStyle(2, 0x2f453f, 0.85)
      .strokeEllipse(657, 649, 18, 9)
      .strokeEllipse(1224, 696, 18, 9);

    const fireButtonArt = this.add.graphics();
    fireButtonArt.fillStyle(0x20332e, 0.3).fillCircle(2, 4, 29);
    for (let petal = 0; petal < 8; petal += 1) {
      const angle = (petal / 8) * Math.PI * 2;
      fireButtonArt.fillStyle(petal % 2 === 0 ? 0xf4a0b5 : 0xf7ba87, 1)
        .fillCircle(Math.cos(angle) * 18, Math.sin(angle) * 18, 11);
    }
    fireButtonArt.lineStyle(3, 0x6f4b42, 0.9).strokeCircle(0, 0, 28);
    fireButtonArt.fillStyle(0xffd96f, 1).fillCircle(0, 0, 17);
    fireButtonArt.lineStyle(3, 0x6c5131, 1).strokeCircle(0, 0, 17);
    fireButtonArt.fillStyle(0xfff2bd, 0.9).fillEllipse(-6, -7, 9, 6);
    this.cannonFireButton = this.add.container(FIRE_CONTROL.x, FIRE_CONTROL.y, [fireButtonArt])
      .setSize(62, 58).setDepth(704).setInteractive({ useHandCursor: true });
    this.cannonFireLabel = this.add.text(FIRE_CONTROL.x + 1, FIRE_CONTROL.y - 1, '➤', {
      color: '#4a5947', fontFamily: 'sans-serif', fontSize: '27px', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(705);

    const powerTrack = this.add.graphics().setDepth(704);
    powerTrack.fillStyle(0x5e8959, 1)
      .fillTriangle(782, 660, 769, 679, 780, 679)
      .fillTriangle(780, 674, 790, 674, 776, 691);
    powerTrack.fillStyle(0x7d583f, 0.3).fillRoundedRect(POWER_CONTROL.left - 1, POWER_CONTROL.y - 6, 198, 18, 8);
    powerTrack.fillStyle(0xffedc1, 1).fillRoundedRect(POWER_CONTROL.left - 3, POWER_CONTROL.y - 9, 198, 16, 8);
    powerTrack.lineStyle(3, 0x5a4939, 1).strokeRoundedRect(POWER_CONTROL.left - 3, POWER_CONTROL.y - 9, 198, 16, 8);
    this.cannonPowerFill = this.add.rectangle(POWER_CONTROL.left, POWER_CONTROL.y, 0, 10, 0xe06c75, 1)
      .setOrigin(0, 0.5).setDepth(705);
    for (let tick = 1; tick < 5; tick += 1) {
      powerTrack.lineStyle(2, 0xb69369, 0.8).lineBetween(
        POWER_CONTROL.left + tick * 38,
        POWER_CONTROL.y - 5,
        POWER_CONTROL.left + tick * 38,
        POWER_CONTROL.y + 5,
      );
    }

    const magicSlot = this.add.graphics().setDepth(704);
    magicSlot.fillStyle(0x725d45, 0.25).fillRoundedRect(1066, 654, 52, 48, 11);
    magicSlot.fillStyle(0xffedc7, 1).fillRoundedRect(1064, 649, 52, 48, 11);
    magicSlot.lineStyle(3, 0x8d67aa, 1).strokeRoundedRect(1064, 649, 52, 48, 11);
    magicSlot.fillStyle(0xdcb8ef, 0.45).fillCircle(1090, 673, 15);
    magicSlot.lineStyle(2, 0xffffff, 0.72).lineBetween(1073, 657, 1107, 657);
    this.boostLabel = this.add.text(1090, POWER_CONTROL.y, '', {
      color: '#ffdc6e', fontFamily: 'sans-serif', fontSize: '29px', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(705);
    this.cannonFireButton.on('pointerdown', () => this.startCannonCharge());
    this.input.on('pointerup', () => this.releaseCannonCharge());
    this.drawCannonAimGuide();
  }

  private createItemTray(): void {
    const tray = this.add.graphics().setDepth(701);
    tray.fillStyle(0x20332e, 0.28).fillRoundedRect(9, 643, 312, 75, 17);
    tray.fillStyle(0x9d6d47, 1).fillRoundedRect(6, 638, 312, 76, 17);
    tray.fillStyle(0xd6a762, 1).fillRoundedRect(6, 634, 312, 76, 17);
    tray.lineStyle(4, 0x2f453f, 1).strokeRoundedRect(6, 634, 312, 76, 17);
    tray.lineStyle(2, 0xffe0a0, 0.8).lineBetween(22, 643, 302, 643);
    tray.fillStyle(0x6f9c61, 1).fillEllipse(26, 646, 18, 9).fillEllipse(298, 697, 18, 9);
    tray.lineStyle(2, 0x2f453f, 0.8).strokeEllipse(26, 646, 18, 9).strokeEllipse(298, 697, 18, 9);
    for (const need of INVENTORY_NEEDS) this.createInventorySlot(need);
    this.updateInventory();
  }

  private createInventorySlot(need: DinoNeed): void {
    const definition = ITEM_DEFINITIONS[need];
    const { home } = definition;
    const slot = this.add.graphics().setDepth(702);
    slot.fillStyle(0x70543e, 0.24).fillRoundedRect(home.x - 24, home.y - 21, 52, 48, 11);
    slot.fillStyle(0xffedc7, 1).fillRoundedRect(home.x - 26, home.y - 25, 52, 48, 11);
    slot.lineStyle(3, 0x2f453f, 1).strokeRoundedRect(home.x - 26, home.y - 25, 52, 48, 11);
    slot.lineStyle(3, definition.color, 0.9).strokeCircle(home.x, home.y - 2, 19);
    slot.lineStyle(2, 0xffffff, 0.78).lineBetween(home.x - 16, home.y - 17, home.x + 10, home.y - 17);
    const item = this.add.image(home.x, home.y - 2, definition.name)
      .setScale(ITEM_TRAY_SCALE * 1.06).setDepth(704).setInteractive({ useHandCursor: true });
    const label = this.add.text(home.x + 18, 699, '', {
      color: '#4c604f', fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(704);
    item.on('pointerup', () => this.selectInventoryItem(need));

    const lockDrawing = this.add.graphics();
    lockDrawing.fillStyle(0x6f513d, 0.22).fillRoundedRect(-13, -4, 29, 25, 7);
    lockDrawing.lineStyle(5, 0x8c6b4b, 1).beginPath().arc(0, -5, 10, Math.PI, Math.PI * 2).strokePath();
    lockDrawing.fillStyle(0xe4b85f, 1).fillRoundedRect(-14, -7, 28, 23, 6);
    lockDrawing.lineStyle(3, 0x5e4938, 1).strokeRoundedRect(-14, -7, 28, 23, 6);
    lockDrawing.fillStyle(0x5e4938, 1).fillCircle(0, 1, 3).fillRoundedRect(-1.5, 1, 3, 8, 1);
    lockDrawing.fillStyle(0xffe8a5, 0.85).fillEllipse(-6, -1, 5, 9);
    const lock = this.add.container(home.x, home.y, [lockDrawing]).setDepth(705).setSize(52, 46)
      .setInteractive({ useHandCursor: true });
    lock.on('pointerup', () => this.bumpLockedSlot(need));

    this.inventoryItems.set(need, item);
    this.inventoryLocks.set(need, lock);
    this.inventoryLabels.set(need, label);
  }

  private bumpLockedSlot(need: DinoNeed): void {
    if (this.model.isNeedUnlocked(need)) return;
    const lock = this.inventoryLocks.get(need);
    if (!lock) return;
    this.tweens.killTweensOf(lock);
    this.tweens.add({ targets: lock, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2 });
    this.cannonFireLabel.setText('×').setColor('#93a4af');
  }

  private selectInventoryItem(need: DinoNeed): void {
    if (this.model.mode !== 'field' || !this.model.isNeedUnlocked(need)) return;
    if (this.cannonShot) {
      this.cannonFireLabel.setText('…').setColor('#e06c75');
      return;
    }
    if (this.cannonLoadedItem) this.unloadCannon();
    this.loadCannon(need);
  }

  private loadCannon(need: DinoNeed): void {
    if (this.cannonLoadedItem || this.cannonShot) return;
    const item = this.createCareItem(need);
    this.cannonLoadedItem = item;
    this.cannonPower = 0;
    item.setScale(0.48).setAngle(0).setDepth(635);
    this.positionLoadedItem();
    this.updateInventory();
    this.cannonFireLabel.setText('➤').setColor('#4a5947');
    this.showSparkles(CANNON.x, CANNON.y, 0xffdc6e);
    this.sounds.bounce();
    this.drawCannonAimGuide();
  }

  private unloadCannon(): void {
    const item = this.cannonLoadedItem;
    this.cannonLoadedItem = undefined;
    this.cannonCharging = false;
    this.cannonPower = 0;
    this.cannonFireLabel.setText('➤').setColor('#4a5947');
    this.resetFlowerPose();
    this.drawCannonAimGuide();
    if (item) this.destroyCareItem(item);
    this.updateInventory();
  }

  private aimCannon(x: number, y: number): void {
    this.cannonAngle = Phaser.Math.Angle.Between(CANNON.x, CANNON.y, x, y);
    this.cannonBarrel.setRotation(this.cannonAngle);
    this.positionLoadedItem();
    this.drawCannonAimGuide();
  }

  private createKeyboardControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.keyboardControls = keyboard.createCursorKeys();
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
  }

  private updateKeyboardControls(seconds: number): void {
    const controls = this.keyboardControls;
    if (!controls) return;

    const turn = Number(controls.right.isDown) - Number(controls.left.isDown);
    this.keyboardAiming = turn !== 0 && this.model.mode === 'field';
    if (this.keyboardAiming) {
      this.cannonAngle = Phaser.Math.Angle.Wrap(this.cannonAngle + turn * KEYBOARD_AIM_SPEED * seconds);
      this.cannonBarrel.setRotation(this.cannonAngle);
      this.positionLoadedItem();
      this.drawCannonAimGuide();
    }

    if (Phaser.Input.Keyboard.JustDown(controls.space)) {
      this.sounds.unlock();
      this.startCannonCharge();
    }
    if (Phaser.Input.Keyboard.JustUp(controls.space)) this.releaseCannonCharge();
  }

  private positionLoadedItem(): void {
    if (!this.cannonLoadedItem) return;
    const muzzleDistance = this.flowerMuzzleDistance();
    this.cannonLoadedItem.setPosition(
      CANNON.x + Math.cos(this.cannonAngle) * muzzleDistance,
      CANNON.y + Math.sin(this.cannonAngle) * muzzleDistance,
    );
  }

  private flowerMuzzleDistance(): number {
    return CANNON_MUZZLE_DISTANCE - (this.cannonCharging ? this.cannonPower * 11 : 0);
  }

  private startCannonCharge(): void {
    if (!this.cannonLoadedItem || this.cannonShot || this.model.mode !== 'field') {
      this.cannonFireLabel.setText('+').setColor('#e06c75');
      this.tweens.add({ targets: this.cannonFireButton, scale: 1.08, duration: 90, yoyo: true });
      return;
    }
    this.cannonCharging = true;
    this.cannonChargeStartedAt = performance.now();
    this.cannonPower = 0;
    this.cannonFireLabel.setText('●').setColor('#ffffff');
    this.sounds.chirp(0.7);
  }

  private releaseCannonCharge(): void {
    if (!this.cannonCharging) return;
    this.cannonPower = Phaser.Math.Clamp((performance.now() - this.cannonChargeStartedAt) / CANNON_CHARGE_MS, 0.12, 1);
    this.cannonCharging = false;
    this.fireCannon();
  }

  private resetFlowerPose(): void {
    this.tweens.killTweensOf([this.cannonBarrel, this.flowerHead]);
    this.cannonBarrel.setScale(1);
    this.flowerHead.setScale(1).setAngle(0);
  }

  private animateFlowerLaunch(boosted: boolean): void {
    this.tweens.killTweensOf([this.cannonBarrel, this.flowerHead]);
    this.cannonBarrel.setScale(0.8, 1.16);
    this.flowerHead.setScale(boosted ? 1.48 : 1.28).setAngle(-10);
    this.tweens.add({
      targets: this.cannonBarrel,
      scaleX: 1,
      scaleY: 1,
      duration: boosted ? 290 : 210,
      ease: 'Back.Out',
    });
    this.tweens.add({
      targets: this.flowerHead,
      scale: 1,
      angle: 0,
      duration: boosted ? 360 : 250,
      ease: 'Elastic.Out',
    });
    this.showSparkles(CANNON.x, CANNON.y, 0xf3a2cc);
    if (boosted) this.showSparkles(CANNON.x, CANNON.y, 0xffef84);
  }

  private fireCannon(): void {
    const item = this.cannonLoadedItem;
    if (!item) return;
    const boosted = this.model.useCannonBoost();
    const speed = (140 + this.cannonPower * 760) * (boosted ? 1.45 : 1);
    this.lastCannonPower = this.cannonPower;
    this.lastCannonSpeed = speed;
    this.lastShotWallBounces = 0;
    this.lastShotHitDino = false;
    this.lastDinoImpactSpeed = 0;
    this.cannonLoadedItem = undefined;
    item.setScale(ITEM_FIELD_SCALE).setAngle(0).setDepth(950);
    this.cannonShot = {
      item,
      power: this.cannonPower,
      vx: Math.cos(this.cannonAngle) * speed,
      vy: Math.sin(this.cannonAngle) * speed,
      age: 0,
    };
    if (boosted) saveProgress(localStorage, this.model.serialize());
    this.animateFlowerLaunch(boosted);
    this.updateInventory();
    if (boosted) this.celebrateBoostedShot();
    this.cannonFireLabel.setText(boosted ? '✦' : '➤').setColor('#ffffff');
    this.sounds.stomp();
    this.showSparkles(CANNON.x, CANNON.y, 0xffdc6e);
    this.drawCannonAimGuide();
  }

  private physicsSeconds(fallbackDelta: number): number {
    const now = performance.now();
    const elapsed = this.lastPhysicsAt > 0 ? now - this.lastPhysicsAt : fallbackDelta;
    this.lastPhysicsAt = now;
    return Math.min(MAX_PHYSICS_FRAME_MS, Math.max(fallbackDelta, elapsed)) / 1000;
  }

  private updateCannon(seconds: number): void {
    if (this.cannonCharging) {
      this.cannonPower = Phaser.Math.Clamp((performance.now() - this.cannonChargeStartedAt) / CANNON_CHARGE_MS, 0, 1);
      this.cannonFireLabel.setText(this.cannonPower >= 1 ? '✦' : '●');
      this.cannonBarrel.setScale(1 - this.cannonPower * 0.14, 1 + this.cannonPower * 0.08);
      this.flowerHead
        .setScale(1 + this.cannonPower * 0.18)
        .setAngle(Math.sin(this.time.now * 0.035) * this.cannonPower * 4);
    }
    this.cannonPowerFill.width = 190 * this.cannonPower;
    this.cannonPowerFill.setFillStyle(this.cannonPower > 0.72 ? 0x9bcf6b : this.cannonPower > 0.38 ? 0xffdc6e : 0xe06c75);
    if (this.cannonLoadedItem) this.positionLoadedItem();
    this.updateMovingFieldObjects(seconds);
    if (!this.cannonShot) {
      if (this.cannonCharging || this.cannonAiming || this.keyboardAiming) this.drawCannonAimGuide();
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

    this.prepareDinoForBounce(
      dino,
      Phaser.Math.Clamp(Math.hypot(motion.vx, motion.vy) / 850, 0.35, 1),
    );
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
    const objects = [...this.fieldCareItems].map((item) => ({ item, radius: CARE_ITEM_RADIUS }));
    if (this.egg?.visible) objects.push({ item: this.egg, radius: EGG_COLLISION_RADIUS });
    if (this.rewardEgg?.visible) objects.push({ item: this.rewardEgg, radius: EGG_COLLISION_RADIUS * REWARD_EGG_SCALE });
    if (this.lootBox?.visible) objects.push({ item: this.lootBox, radius: LOOT_RADIUS });
    return objects;
  }

  private isActiveFieldObject(item: Phaser.GameObjects.Image): boolean {
    return this.activeFieldObjects().some((object) => object.item === item);
  }

  private prepareDinoForBounce(dino: DinoEntity, soundIntensity = 0.65): void {
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    dino.roamTimer = undefined;
    dino.reacting = false;
    if (!dino.bouncing) {
      this.sounds.dinoHit(dino.profile.species, soundIntensity);
      dino.bouncing = true;
      dino.bounceVx = 0;
      dino.bounceVy = 0;
      dino.bounceAge = 0;
    }
    dino.sprite.setScale(this.dinoScale(dino)).setAlpha(1);
    dino.rig.setMotion('impact');
  }

  private updateDinoBounces(seconds: number): void {

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
      for (const item of this.fieldCareItems) {
        const incomingAngle = Math.atan2(dino.bounceVy, dino.bounceVx);
        if (this.bounceDinoOffCircle(dino, item.x, item.y, CARE_ITEM_RADIUS)) {
          const normalizedPower = Phaser.Math.Clamp(Math.hypot(dino.bounceVx, dino.bounceVy) / 940, 0.15, 1);
          this.kickFieldObject(item, normalizedPower, CARE_ITEM_RADIUS, incomingAngle);
        }
      }
      if (this.lootBox?.visible && this.bounceDinoOffCircle(dino, this.lootBox.x, this.lootBox.y, LOOT_RADIUS)) {
        const power = Phaser.Math.Clamp(Math.hypot(dino.bounceVx, dino.bounceVy) / 940, 0.15, 1);
        this.kickFieldObject(this.lootBox, power, LOOT_RADIUS, Math.atan2(dino.bounceVy, dino.bounceVx));
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
      dino.sprite.setAngle(0).setScale(this.dinoScale(dino)).setAlpha(1).setFlipX(false);
      dino.rig.setMotion('idle');
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
    this.sounds.bounce();
    this.showSparkles(item.x, item.y, 0xffdc6e);
  }

  private stopFieldObject(item: Phaser.GameObjects.Image): void {
    this.movingFieldObjects.delete(item);
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
    ).setScale(ITEM_FIELD_SCALE).setAngle(0).setAlpha(1);
    this.fieldCareItems.add(shot.item);
    this.armFieldCareItem(shot.item);
    this.cannonPower = 0;
    this.cannonFireLabel.setText('➤').setColor('#4a5947');
    this.resetFlowerPose();
    this.sounds.bounce();
    this.showSparkles(shot.item.x, shot.item.y, 0xffdc6e);
    this.updateInventory();
    this.resolveWorldCollisions();
    this.redirectDinosToNearbyCare();
    this.drawCannonAimGuide();
  }

  private drawCannonAimGuide(): void {
    this.cannonAimGuide.clear();
    if (!this.cannonLoadedItem && !this.cannonCharging) return;
    const previewPower = this.cannonCharging ? this.cannonPower : Math.max(0.38, this.cannonPower);
    const muzzleDistance = this.flowerMuzzleDistance();
    const muzzleX = CANNON.x + Math.cos(this.cannonAngle) * muzzleDistance;
    const muzzleY = CANNON.y + Math.sin(this.cannonAngle) * muzzleDistance;
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

  private createLootBox(): void {
    this.lootBox = this.add.image(LOOT_HOME.x, LOOT_HOME.y, 'loot')
      .setDepth(650).setVisible(false).setInteractive({ useHandCursor: true });
    this.lootBox.on('pointerup', () => this.openLootBox());
  }

  private refreshLootBox(): void {
    if (!this.model.lootReady || this.lootBox.visible) return;
    this.stopFieldObject(this.lootBox);
    this.lootBox.setPosition(LOOT_HOME.x, FIELD.top + LOOT_RADIUS)
      .setScale(0.25).setAlpha(0).setAngle(0).setVisible(true).setDepth(650);
    this.tweens.add({
      targets: this.lootBox,
      y: LOOT_HOME.y,
      scale: 1,
      alpha: 1,
      duration: 650,
      ease: 'Bounce.Out',
      onComplete: () => this.resolveWorldCollisions(),
    });
    this.showSparkles(LOOT_HOME.x, LOOT_HOME.y, 0xb67ad9);
  }

  private openLootBox(): void {
    if (!this.lootBox.visible) return;
    const reward = this.model.collectLoot();
    if (!reward) return;
    this.stopFieldObject(this.lootBox);
    saveProgress(localStorage, this.model.serialize());
    this.updateInventory();
    this.celebrateLootOpen(reward.unlockedSlot);
    this.showSparkles(this.lootBox.x, this.lootBox.y, 0xffdc6e);
    this.tweens.add({
      targets: this.lootBox,
      scale: 1.35,
      alpha: 0,
      duration: 260,
      ease: 'Back.In',
      onComplete: () => this.lootBox.setVisible(false).setScale(1).setAlpha(1).setPosition(LOOT_HOME.x, LOOT_HOME.y),
    });
  }

  private resetLootBox(): void {
    this.stopFieldObject(this.lootBox);
    this.tweens.killTweensOf(this.lootBox);
    this.lootBox.setVisible(false).setScale(1).setAlpha(1).setAngle(0).setPosition(LOOT_HOME.x, LOOT_HOME.y);
  }

  private celebrateLootOpen(unlockedSlot: number | null): void {
    this.sounds.hatch();
    this.cameras.main.flash(420, 255, 226, 92, true);
    this.cameras.main.shake(260, 0.007);

    const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffdc6e, 0.58).setDepth(1900);
    this.tweens.add({ targets: flash, alpha: 0, duration: 720, ease: 'Quad.Out', onComplete: () => flash.destroy() });

    this.lootAnnouncement?.destroy();
    const unlockedNeed = unlockedSlot ? INVENTORY_NEEDS[unlockedSlot - 1] : undefined;
    const panelShadow = this.add.rectangle(5, 7, 420, 176, 0x20332e, 0.28).setStrokeStyle(0);
    const panel = this.add.rectangle(0, 0, 420, 176, 0xffedc7, 0.98).setStrokeStyle(6, 0x6e4f3b, 1);
    const innerPanel = this.add.rectangle(0, 0, 397, 153, 0xfff7df, 0.5).setStrokeStyle(3, 0xe0a65e, 0.9);
    const title = this.add.text(0, -61, '✦  NEW!  ✦', {
      color: '#7c536f', fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const rewardIcon = this.add.image(0, -4, unlockedNeed ? ITEM_DEFINITIONS[unlockedNeed].name : 'loot').setScale(1.18);
    const subtitle = this.add.text(0, 58, `✦  ×1.45`, {
      color: '#4f7358', fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    const announcement = this.add.container(WIDTH / 2, HEIGHT / 2 - 25, [panelShadow, panel, innerPanel, title, rewardIcon, subtitle])
      .setDepth(2000).setScale(0.2).setAlpha(0);
    this.lootAnnouncement = announcement;
    this.tweens.add({ targets: announcement, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    this.time.delayedCall(1150, () => {
      if (this.lootAnnouncement !== announcement) return;
      this.tweens.add({
        targets: announcement,
        y: announcement.y - 45,
        alpha: 0,
        duration: 340,
        ease: 'Quad.In',
        onComplete: () => {
          announcement.destroy();
          if (this.lootAnnouncement === announcement) this.lootAnnouncement = undefined;
        },
      });
    });
    if (unlockedNeed) {
      const inventoryItem = this.inventoryItems.get(unlockedNeed);
      if (inventoryItem) {
        inventoryItem.setScale(0.15).setAlpha(0.2);
        this.tweens.add({ targets: inventoryItem, scale: ITEM_TRAY_SCALE, alpha: 1, duration: 520, ease: 'Back.Out' });
        this.showSparkles(ITEM_DEFINITIONS[unlockedNeed].home.x, ITEM_DEFINITIONS[unlockedNeed].home.y, 0xffdc6e);
      }
    }
    this.showSparkles(CANNON.x, CANNON.y, 0xffdc6e);
  }

  private celebrateBoostedShot(): void {
    this.cameras.main.flash(170, 255, 220, 82, true);
    this.cameras.main.shake(180, 0.012);
    const label = this.add.text(CANNON.x, CANNON.y - 105, 'TURBO BLOOM!', {
      color: '#ffdc6e', fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1500);
    this.tweens.add({
      targets: label,
      y: label.y - 50,
      scale: 1.3,
      alpha: 0,
      duration: 650,
      ease: 'Quad.Out',
      onComplete: () => label.destroy(),
    });
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
    const panel = this.add.graphics().setDepth(801);
    panel.fillStyle(0x20332e, 0.24).fillRoundedRect(17, 12, 224, 52, 14);
    panel.fillStyle(0xb98352, 1).fillRoundedRect(14, 8, 224, 52, 14);
    panel.fillStyle(0xffedc7, 1).fillRoundedRect(14, 5, 224, 52, 14);
    panel.lineStyle(3, 0x2f453f, 1).strokeRoundedRect(14, 5, 224, 52, 14);
    panel.lineStyle(2, 0xffffff, 0.72).lineBetween(29, 13, 222, 13);
    this.heartIcons = Array.from({ length: this.model.heartTarget }, (_, index) => this.add.image(
      39 + index * 38,
      32,
      'score-heart-empty',
    ).setScale(0.62).setDepth(803));
    this.add.image(214, 31, 'egg').setScale(0.25).setDepth(803);
    panel.fillStyle(0x7ba16a, 1).fillTriangle(177, 27, 184, 32, 177, 37);
    this.heartLabel = this.add.text(202, 39, '', {
      color: '#ffdc6e', fontSize: '10px', fontStyle: 'bold', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0, 0.5).setDepth(803);
    this.updateProgress(false);
  }

  private createControls(): void {
    this.muteButton = this.makeRoundButton(1170, 35, 23, '♪', () => {
      this.sounds.setMuted(!this.sounds.isMuted);
      (this.muteButton.getByName('label') as Phaser.GameObjects.Text).setText(this.sounds.isMuted ? '×' : '♪');
    });
    this.makeRoundButton(1228, 35, 23, '↻', () => this.resetGame());
  }

  private makeRoundButton(x: number, y: number, radius: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const shadow = this.add.circle(2, 3, radius, 0x20332e, 0.25);
    const circle = this.add.circle(0, 0, radius, 0xffedc7, 1).setStrokeStyle(3, 0x466253, 1)
      .setInteractive({ useHandCursor: true }).setName('hit');
    const shine = this.add.ellipse(-6, -8, radius * 0.75, radius * 0.34, 0xffffff, 0.58);
    const text = this.add.text(0, -2, label, { color: '#4e6757', fontSize: `${Math.round(radius * 1.15)}px`, fontStyle: 'bold' })
      .setOrigin(0.5).setName('label');
    const button = this.add.container(x, y, [shadow, circle, shine, text]).setDepth(850);
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
        this.showFirstNeed(dino, 'hunger');
        saveProgress(localStorage, this.model.serialize());
        this.tweens.add({
          targets: dino.sprite, scale: this.dinoScale(dino), y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
          onComplete: () => {
            dino.sprite.setAlpha(1);
            dino.reacting = false;
            this.eggBusy = false;
            this.scheduleRoam(dino, 1200);
            this.updateInventory();
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
        this.resetLootBox();
        this.updateProgress(true);
        this.tweens.add({
          targets: dino.sprite, scale: this.dinoScale(dino), y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
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

  private dinoScale(dino: Pick<DinoEntity, 'index'>): number {
    return growthScaleForCareCount(this.model.careCountFor(dino.index));
  }

  private spawnDino(index: number, position: { x: number; y: number }, animate: boolean): DinoEntity {
    const profile = DINO_PROFILES[this.model.speciesFor(index)];
    const restingScale = growthScaleForCareCount(this.model.careCountFor(index));
    const sprite = this.add.image(position.x, position.y + (animate ? 14 : 0), 'dino')
      .setScale(animate ? restingScale * 0.27 : restingScale)
      .setAlpha(animate ? 0 : 1)
      .setTexture('dino-hitbox');
    const rig = createDinoRig(this, profile.species);
    const { bubble, icon } = this.createNeedBubble();
    const dino: DinoEntity = {
      index,
      profile,
      sprite,
      rig,
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
    this.syncDinoVisual(dino);
    return dino;
  }

  private syncDinoVisual(dino: DinoEntity): void {
    dino.rig.syncFrom(dino.sprite);
  }

  private setDinoMotion(dino: DinoEntity, motion: DinoMotion): void {
    dino.rig.setMotion(motion);
  }

  private createNeedBubble(): { bubble: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image } {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x20332e, 0.2).fillRoundedRect(-48, -32, 100, 70, 20);
    const shape = this.add.graphics();
    shape.fillStyle(0xfff6dd, 1).fillRoundedRect(-50, -38, 100, 70, 20);
    shape.lineStyle(4, 0x2f453f, 1).strokeRoundedRect(-50, -38, 100, 70, 20);
    shape.fillStyle(0xfff6dd, 1).fillTriangle(-13, 30, 10, 30, -3, 47);
    shape.lineStyle(3, 0x2f453f, 1).lineBetween(-13, 30, -3, 47).lineBetween(-3, 47, 10, 30);
    shape.fillStyle(0xffffff, 0.68).fillEllipse(-22, -27, 30, 8);
    shape.fillStyle(0xeaa0a7, 0.4).fillCircle(-38, 14, 4).fillCircle(38, 14, 4);
    const icon = this.add.image(0, -3, 'apple').setScale(0.82);
    const bubble = this.add.container(0, 0, [shadow, shape, icon]).setDepth(NEED_BUBBLE_DEPTH).setVisible(false);
    return { bubble, icon };
  }

  private scheduleNeed(
    dino: DinoEntity,
    delay = Phaser.Math.Between(6500, 9000),
  ): void {
    dino.needDueAt = undefined;
    if (this.model.newEggUnlocked || this.model.rewardEggHatching) return;
    dino.needDueAt = performance.now() + delay;
  }

  private showFirstNeed(dino: DinoEntity, forced?: DinoNeed): void {
    const need = this.model.requestNeed(dino.index, forced);
    if (need) this.showNeed(dino, need, true);
  }

  private showNeed(dino: DinoEntity, need: DinoNeed, immediate = false): void {
    dino.icon.setTexture(ITEM_DEFINITIONS[need].name).setScale(0.78).setAngle(0).setAlpha(1);
    this.tweens.killTweensOf(dino.bubble);
    this.positionNeedBubble(dino);
    dino.bubble
      .setVisible(true)
      .setScale(immediate ? NEED_BUBBLE_SCALE : NEED_BUBBLE_SCALE * 0.2)
      .setAlpha(immediate ? 1 : 0);
    if (!immediate) {
      this.tweens.add({
        targets: dino.bubble,
        scale: NEED_BUBBLE_SCALE,
        alpha: 1,
        duration: 320,
        ease: 'Back.Out',
      });
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
      if (this.resolveLootCollision(dino)) continue;
      for (const item of this.fieldCareItems) {
        if (this.movingFieldObjects.has(item)) continue;
        const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, item.x, item.y);
        if (distance >= CARE_COLLISION_RADIUS) continue;
        const need = this.needForItem(item);
        if (need && this.model.needFor(dino.index) === need) this.consumeCareItem(dino, item, need);
        else this.bumpCareItem(dino, item);
        break;
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

  private resolveLootCollision(dino: DinoEntity): boolean {
    if (!this.lootBox?.visible) return false;
    const minimum = DINO_RADIUS + LOOT_RADIUS;
    if (Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.lootBox.x, this.lootBox.y) >= minimum) {
      return false;
    }
    this.pushAway(dino.sprite, this.lootBox.x, this.lootBox.y, minimum + COLLISION_SKIN);
    this.tweens.killTweensOf(dino.sprite);
    this.scheduleRoam(dino, 700);
    return true;
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

  private consumeCareItem(dino: DinoEntity, item: Phaser.GameObjects.Image, need: DinoNeed): void {
    if (this.time.now - this.lastCareBump < 400) return;
    this.lastCareBump = this.time.now;
    dino.reacting = true;
    this.setDinoMotion(dino, need === 'hunger' ? 'eat' : 'happy');
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    this.stopFieldObject(item);
    this.fieldCareItems.delete(item);
    this.careItemNeeds.delete(item);
    item.disableInteractive();
    if (this.model.fulfillNeed(dino.index, need)) this.completeNeed(dino, need);
    this.updateInventory();
    const grownScale = this.dinoScale(dino);
    this.tweens.add({
      targets: dino.sprite,
      scaleX: grownScale * 1.08,
      scaleY: grownScale * 0.94,
      duration: 180,
      yoyo: true,
    });
    this.tweens.add({
      targets: item,
      x: dino.sprite.x,
      y: dino.sprite.y - 10,
      scale: 0,
      alpha: 0,
      duration: 260,
      ease: 'Back.In',
      onComplete: () => item.destroy(),
    });
    this.time.delayedCall(520, () => {
      dino.reacting = false;
      dino.sprite.setScale(this.dinoScale(dino)).setAlpha(1);
      this.setDinoMotion(dino, 'idle');
      this.resumeRoaming(dino);
    });
  }

  private bumpCareItem(dino: DinoEntity, item: Phaser.GameObjects.Image): void {
    if (this.time.now - this.lastCareBump < 400) return;
    this.lastCareBump = this.time.now;
    const angle = Phaser.Math.Angle.Between(dino.sprite.x, dino.sprite.y, item.x, item.y);
    this.pushAway(dino.sprite, item.x, item.y, CARE_COLLISION_RADIUS + COLLISION_SKIN);
    this.tweens.killTweensOf(dino.sprite);
    this.kickFieldObject(item, 0.25, CARE_ITEM_RADIUS, angle);
    this.scheduleRoam(dino, 350);
  }

  private completeNeed(dino: DinoEntity, need: DinoNeed): void {
    dino.bubble.setVisible(false);
    this.sounds.dinoCare(dino.profile.species, need);
    saveProgress(localStorage, this.model.serialize());
    this.flyHeartToScore(dino);
    this.updateProgress(true);
    this.celebrate(dino);
    if (this.model.newEggUnlocked) this.pauseCareForReward();
    else this.scheduleNeed(dino, NEXT_NEED_DELAY_MS);
  }

  private pauseCareForReward(): void {
    for (const dino of this.dinos) {
      dino.needDueAt = undefined;
      dino.bubble.setVisible(false);
    }
  }

  private flyHeartToScore(dino: DinoEntity): void {
    const heart = this.add.text(dino.sprite.x, dino.sprite.y - 45, '♥', {
      color: '#ff7f96', fontSize: '38px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({
      targets: heart,
      x: 70,
      y: 36,
      scale: 0.55,
      duration: 620,
      ease: 'Cubic.In',
      onComplete: () => heart.destroy(),
    });
  }

  private updateInventory(): void {
    const enabled = this.model.mode === 'field';
    for (const need of INVENTORY_NEEDS) {
      const unlocked = this.model.isNeedUnlocked(need);
      this.inventoryItems.get(need)?.setVisible(unlocked).setAlpha(enabled ? 1 : 0.45);
      this.inventoryLocks.get(need)?.setVisible(!unlocked);
      this.inventoryLabels.get(need)
        ?.setText(unlocked ? '∞' : '')
        .setColor('#4c604f');
    }
    if (this.boostLabel) {
      this.boostLabel
        .setText(this.model.cannonBoostReady ? '✦' : '')
        .setColor('#ffdc6e');
    }
    if (this.model.cannonBoostReady) {
      this.cannonBoostGlow.setVisible(true).setScale(0.92).setAlpha(0.28);
      this.flowerBoostOrbit.setVisible(true);
      if (!this.boostPulse) {
        this.boostPulse = this.tweens.add({
          targets: this.cannonBoostGlow,
          scale: 1.16,
          alpha: 0.82,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
      if (!this.boostOrbitTween) {
        this.boostOrbitTween = this.tweens.add({
          targets: this.flowerBoostOrbit,
          angle: 360,
          duration: 2300,
          repeat: -1,
          ease: 'Linear',
        });
      }
    } else {
      this.boostPulse?.stop();
      this.boostPulse = undefined;
      this.boostOrbitTween?.stop();
      this.boostOrbitTween = undefined;
      this.cannonBoostGlow.setVisible(false).setScale(1).setAlpha(1);
      this.flowerBoostOrbit.setVisible(false).setAngle(0);
    }
  }

  private createCareItem(need: DinoNeed): Phaser.GameObjects.Image {
    const definition = ITEM_DEFINITIONS[need];
    const item = this.add.image(definition.home.x, definition.home.y, definition.name).setScale(ITEM_FIELD_SCALE);
    this.careItemNeeds.set(item, need);
    return item;
  }

  private destroyCareItem(item: Phaser.GameObjects.Image): void {
    this.stopFieldObject(item);
    this.fieldCareItems.delete(item);
    this.careItemNeeds.delete(item);
    this.tweens.killTweensOf(item);
    item.destroy();
  }

  private armFieldCareItem(item: Phaser.GameObjects.Image): void {
    item.setInteractive({ useHandCursor: true });
    item.on('pointerup', () => this.recallCareItem(item));
  }

  private recallCareItem(item: Phaser.GameObjects.Image): void {
    if (!this.fieldCareItems.has(item)) return;
    this.destroyCareItem(item);
    this.updateInventory();
    this.sounds.bounce();
  }

  private needForItem(item: Phaser.GameObjects.Image): DinoNeed | undefined {
    return this.careItemNeeds.get(item);
  }

  private itemName(need: DinoNeed | undefined): CareItemName | null {
    return need ? ITEM_DEFINITIONS[need].name : null;
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
    this.setDinoMotion(dino, 'walk');
    const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, targetX, targetY);
    this.tweens.add({
      targets: dino.sprite,
      x: targetX,
      y: targetY,
      duration: Phaser.Math.Clamp(distance * dino.profile.travelMsPerPixel, 520, 4600),
      ease: 'Sine.InOut',
      onComplete: () => {
        dino.sprite.setScale(this.dinoScale(dino)).setFlipX(false).setAlpha(1);
        this.setDinoMotion(dino, 'idle');
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
    const activeNeed = this.model.needFor(dino.index);
    if (!activeNeed) return undefined;
    const target = [...this.fieldCareItems]
      .filter((item) => this.needForItem(item) === activeNeed && !this.movingFieldObjects.has(item))
      .map((item) => ({
        item,
        distance: Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, item.x, item.y),
      }))
      .filter(({ distance }) => distance <= dino.profile.attractionRadius)
      .sort((first, second) => first.distance - second.distance)[0];
    if (!target) return undefined;

    const triggerDistance = CARE_COLLISION_RADIUS - 4;
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

  private placeCareItemForTest(need: DinoNeed, x: number, y: number): boolean {
    const item = this.createCareItem(need);
    item.setPosition(
      Phaser.Math.Clamp(x, FIELD.left + CARE_ITEM_RADIUS, FIELD.right - CARE_ITEM_RADIUS),
      Phaser.Math.Clamp(y, FIELD.top + CARE_ITEM_RADIUS, FIELD.bottom - CARE_ITEM_RADIUS),
    ).setScale(ITEM_FIELD_SCALE).setAlpha(1).setAngle(0);
    this.fieldCareItems.add(item);
    this.armFieldCareItem(item);
    this.updateInventory();
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
    this.heartIcons.forEach((heart, index) => {
      heart.setTexture(index < this.model.hearts ? 'score-heart' : 'score-heart-empty').setScale(0.62).setAlpha(1);
    });
    this.heartLabel.setText('');
    if (animate && this.model.hearts > 0) {
      const latestHeart = this.heartIcons[Math.min(this.model.hearts, this.heartIcons.length) - 1];
      this.tweens.killTweensOf(latestHeart);
      this.tweens.add({
        targets: latestHeart,
        scale: 0.82,
        angle: { from: -10, to: 10 },
        duration: 170,
        yoyo: true,
        ease: 'Back.Out',
        onComplete: () => latestHeart.setScale(0.62).setAngle(0),
      });
    }
    if (animate && !rewardReady && this.model.hearts === Math.ceil(this.model.heartTarget / 2)) {
      this.showSparkles(88, 40, 0xffdc6e);
    }
    if (rewardReady && !this.rewardEgg.visible && !this.model.rewardEggHatching) {
      this.armRewardEgg();
      this.rewardEgg.setVisible(true).setAlpha(0).setScale(0).setDepth(REWARD_EGG_DEPTH);
      this.tweens.add({ targets: this.rewardEgg, scale: REWARD_EGG_SCALE, alpha: 1, duration: 700, ease: 'Back.Out' });
      this.showSparkles(this.rewardEgg.x, this.rewardEgg.y, 0xffdc6e);
    }
    this.refreshLootBox();
  }

  private celebrate(dino: DinoEntity): void {
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
