import Phaser from 'phaser';
import { SoundGarden } from '../audio/SoundGarden';
import { DinoNeed, GameModel, loadProgress, saveProgress, SAVE_KEY } from '../game/GameModel';

const WIDTH = 1280;
const HEIGHT = 720;
const FIELD = { left: 155, right: 1125, top: 145, bottom: 545 };
const DINO_SCALE = 0.112;
const DINO_DRAG_SCALE = 0.12;
const DINO_RADIUS = 55;
const PLAY_COLLISION_RADIUS = 88;
const POND_COLLISION_RADIUS = 132;
const NEED_BUBBLE_DEPTH = 680;
const EGG_HOME = { x: 490, y: 360 };
const REWARD_EGG_HOME = { x: 760, y: 285 };
const POND = { x: 1015, y: 485 };
const BALL_HOME = { x: 86, y: 650 };
const DINO_TINTS = [0xffffff, 0xe5f7ff, 0xffedcf, 0xf1e2ff, 0xe3f4d5];

interface DinoEntity {
  index: number;
  sprite: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Graphics;
  dragging: boolean;
  reacting: boolean;
  touchingPond: boolean;
  needTimer?: Phaser.Time.TimerEvent;
  roamTimer?: Phaser.Time.TimerEvent;
}

export class NurseryScene extends Phaser.Scene {
  private model!: GameModel;
  private sounds = new SoundGarden();
  private egg!: Phaser.GameObjects.Image;
  private rewardEgg!: Phaser.GameObjects.Image;
  private ball!: Phaser.GameObjects.Image;
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

  constructor() {
    super('NurseryScene');
  }

  preload(): void {
    this.load.image('field', `${import.meta.env.BASE_URL}assets/field-background.png`);
    this.load.image('egg', `${import.meta.env.BASE_URL}assets/egg.webp`);
    this.load.image('dino', `${import.meta.env.BASE_URL}assets/baby-triceratops.webp`);
    this.load.image('ball', `${import.meta.env.BASE_URL}assets/ball.webp`);
    this.load.image('pond', `${import.meta.env.BASE_URL}assets/bath.webp`);
  }

  create(): void {
    this.model = new GameModel(loadProgress(localStorage));
    this.createMap();
    this.createPond();
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
        this.tweens.killTweensOf(dino.sprite);
        dino.roamTimer?.remove(false);
        dino.roamTimer = undefined;
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
      firstPondDistance: first
        ? Math.round(Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, POND.x, POND.y))
        : 0,
    };
  }

  private createMap(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x6d9d45).setDepth(-3);
    this.add.rectangle(WIDTH / 2 + 5, HEIGHT / 2 + 8, 1170, 660, 0x345d35, 0.25).setDepth(-2);
    this.add.image(WIDTH / 2, HEIGHT / 2, 'field').setDisplaySize(1160, 650).setDepth(-1);
    this.add.graphics().setDepth(6).lineStyle(4, 0x466f3f, 0.38).strokeRoundedRect(
      FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top, 24,
    );
  }

  private createPond(): void {
    const glow = this.add.ellipse(POND.x, POND.y + 22, 220, 105, 0xbceef1, 0.24).setDepth(8);
    this.tweens.add({ targets: glow, scaleX: 1.08, scaleY: 1.08, alpha: 0.42, duration: 1600, yoyo: true, repeat: -1 });
    this.add.image(POND.x, POND.y, 'pond').setScale(0.18).setDepth(10);
  }

  private createItemTray(): void {
    this.add.rectangle(176, 656, 286, 92, 0x35583d, 0.22).setDepth(700);
    this.add.rectangle(170, 650, 286, 92, 0xfff4cf, 0.96).setStrokeStyle(5, 0xffffff, 0.92).setDepth(701);
    [86, 170, 254].forEach((x, index) => {
      this.add.circle(x, 650, 34, index === 0 ? 0xe7d5a7 : 0xd9d0b5, index === 0 ? 0.5 : 0.28)
        .setStrokeStyle(2, 0xb9aa84, 0.35).setDepth(702);
      if (index > 0) this.add.text(x, 650, '•', { color: '#9c987f', fontSize: '30px' }).setOrigin(0.5).setAlpha(0.45).setDepth(703);
    });
    this.ball = this.add.image(BALL_HOME.x, BALL_HOME.y, 'ball').setScale(0.071).setDepth(704)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.ball);
    this.ball.on('dragstart', () => {
      if (this.model.mode !== 'field') return;
      this.draggingBall = true;
      this.ball.setDepth(950);
      this.tweens.killTweensOf(this.ball);
    });
    this.ball.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.draggingBall) return;
      const fromTray = !this.ballPlaced && dragY >= FIELD.bottom + 20;
      this.ball.setPosition(
        fromTray ? dragX : Phaser.Math.Clamp(dragX, FIELD.left + 28, FIELD.right - 28),
        fromTray ? dragY : Phaser.Math.Clamp(dragY, FIELD.top + 28, FIELD.bottom - 28),
      );
    });
    this.ball.on('dragend', () => this.finishBallDrag());
  }

  private createEggs(): void {
    this.egg = this.add.image(EGG_HOME.x, EGG_HOME.y, 'egg').setScale(0.125).setDepth(360);
    this.crack = this.add.graphics().setDepth(365);
    this.setupEggDrag(this.egg, false);

    this.rewardEgg = this.add.image(REWARD_EGG_HOME.x, REWARD_EGG_HOME.y, 'egg').setScale(0.09).setDepth(320).setVisible(false);
    this.rewardCrack = this.add.graphics().setDepth(325);
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
      if (reward && this.model.rewardEggTaps >= 2) this.drawCracks(egg, this.rewardCrack, this.model.rewardEggTaps >= 3, true);
      if (!reward && this.model.eggTaps >= 2) this.drawCracks(egg, this.crack, this.model.eggTaps >= 3, false);
    });
    egg.on('dragend', () => egg.setData('dragActive', false));
  }

  private createProgress(): void {
    this.add.rectangle(154, 67, 248, 76, 0x35583d, 0.2).setDepth(800);
    this.add.rectangle(148, 61, 248, 76, 0xfff4cf, 0.96).setStrokeStyle(4, 0xffffff, 0.9).setDepth(801);
    this.add.text(48, 40, '♥', { color: '#ef6d82', fontSize: '39px', fontFamily: 'Arial Rounded MT Bold, sans-serif' }).setDepth(802);
    this.heartLabel = this.add.text(96, 43, '', {
      color: '#46624f', fontSize: '29px', fontStyle: 'bold', fontFamily: 'Arial Rounded MT Bold, sans-serif',
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
    const shadow = this.add.circle(4, 6, radius, 0x35583d, 0.22);
    const circle = this.add.circle(0, 0, radius, 0xfff4cf, 0.96).setStrokeStyle(4, 0xffffff, 0.92)
      .setInteractive({ useHandCursor: true }).setName('hit');
    const text = this.add.text(0, -2, label, { color: '#46624f', fontSize: `${Math.round(radius * 1.15)}px`, fontStyle: 'bold' })
      .setOrigin(0.5).setName('label');
    const button = this.add.container(x, y, [shadow, circle, text]).setDepth(850);
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
      egg.setAngle(0).setScale(reward ? 0.09 : 0.125);
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
      this.tweens.add({ targets: egg, scaleX: reward ? 0.1 : 0.137, scaleY: reward ? 0.08 : 0.113, duration: 110, yoyo: true });
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
      targets: this.egg, angle: { from: -10, to: 10 }, scale: 0.14, duration: 80, yoyo: true, repeat: 4,
      onComplete: () => {
        this.burstShell(point.x, point.y);
        this.egg.setVisible(false);
        this.crack.clear();
        this.model.finishHatching();
        const dino = this.spawnDino(0, point, true);
        this.showFirstNeed(dino, 'bath');
        saveProgress(localStorage, this.model.serialize());
        this.tweens.add({
          targets: dino.sprite, scale: DINO_SCALE, y: point.y, alpha: 1, duration: 620, ease: 'Back.Out',
          onComplete: () => {
            dino.sprite.setAlpha(1);
            this.eggBusy = false;
            this.scheduleRoam(dino, 1200);
            this.ball.setAlpha(1);
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
      targets: this.rewardEgg, angle: { from: -10, to: 10 }, scale: 0.105, duration: 80, yoyo: true, repeat: 4,
      onComplete: () => {
        this.burstShell(point.x, point.y);
        this.rewardEgg.setVisible(false);
        this.rewardCrack.clear();
        const index = this.model.dinoCount;
        this.model.finishRewardHatching();
        const dino = this.spawnDino(index, point, true);
        this.showFirstNeed(dino, index % 2 === 0 ? 'bath' : 'play');
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
    this.rewardEgg.setPosition(REWARD_EGG_HOME.x, REWARD_EGG_HOME.y).setScale(0.09).setAlpha(1).setAngle(0).setVisible(false);
    this.rewardEgg.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.rewardEgg);
  }

  private refreshRewardEgg(): void {
    if (!this.model.newEggUnlocked || this.model.rewardEggHatching) return;
    this.rewardEgg.setVisible(true).setAlpha(1).setScale(0.09);
  }

  private spawnPointFor(index: number): Phaser.Math.Vector2 {
    const points = [
      new Phaser.Math.Vector2(480, 360),
      new Phaser.Math.Vector2(720, 330),
      new Phaser.Math.Vector2(550, 470),
      new Phaser.Math.Vector2(825, 445),
      new Phaser.Math.Vector2(355, 275),
    ];
    return points[index % points.length].clone().add(new Phaser.Math.Vector2((index % 3) * 8, Math.floor(index / 5) * 8));
  }

  private spawnDino(index: number, position: { x: number; y: number }, animate: boolean): DinoEntity {
    const sprite = this.add.image(position.x, position.y + (animate ? 14 : 0), 'dino')
      .setScale(animate ? 0.03 : DINO_SCALE)
      .setAlpha(animate ? 0 : 1)
      .setTint(DINO_TINTS[index % DINO_TINTS.length]);
    const { bubble, icon } = this.createNeedBubble();
    const dino: DinoEntity = { index, sprite, bubble, icon, dragging: false, reacting: false, touchingPond: false };
    this.dinos.push(dino);
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(sprite);
    sprite.on('dragstart', () => {
      if (dino.reacting) return;
      dino.dragging = true;
      this.tweens.killTweensOf(sprite);
      dino.roamTimer?.remove(false);
      sprite.setScale(DINO_DRAG_SCALE).setDepth(950);
      this.sounds.chirp(1.15);
    });
    sprite.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!dino.dragging) return;
      sprite.setPosition(
        Phaser.Math.Clamp(dragX, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS),
        Phaser.Math.Clamp(dragY, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS),
      );
      this.resolveDinoSeparation(dino);
      this.resolvePondCollision(dino);
    });
    sprite.on('dragend', () => {
      dino.dragging = false;
      sprite.setScale(DINO_SCALE).setAlpha(1);
      this.resolveDinoSeparation(dino);
      if (dino.touchingPond && this.model.needFor(dino.index) === 'bath') this.bathDino(dino);
      else this.resolveWorldCollisions();
      if (!dino.reacting) this.scheduleRoam(dino, 800);
    });
    return dino;
  }

  private createNeedBubble(): { bubble: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Graphics } {
    const shape = this.add.graphics();
    shape.fillStyle(0x456755, 0.22).fillEllipse(4, 7, 112, 78);
    shape.fillStyle(0xffffff, 0.98).fillEllipse(0, 0, 112, 78);
    shape.lineStyle(4, 0x4e6f5b, 0.92).strokeEllipse(0, 0, 112, 78);
    shape.fillStyle(0xffffff, 0.98).fillTriangle(-14, 30, 8, 30, -4, 52);
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
    if (need === 'bath') {
      dino.icon.fillStyle(0x70cfe1, 1).fillCircle(-13, 5, 12).fillCircle(12, 5, 12);
      dino.icon.fillTriangle(-13, -23, -24, 0, -2, 0).fillTriangle(12, -23, 1, 0, 23, 0);
    } else {
      dino.icon.fillStyle(0xffd36d, 1).fillCircle(0, 0, 23);
      dino.icon.lineStyle(5, 0xf28d83, 1).arc(0, 0, 22, -1.1, 1.1).strokePath();
      dino.icon.lineStyle(5, 0x70b9c6, 1).arc(0, 0, 22, 2.05, 4.2).strokePath();
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
    dino.bubble.setPosition(
      Phaser.Math.Clamp(dino.sprite.x, FIELD.left + 62, FIELD.right - 62),
      Math.max(FIELD.top + 48, dino.sprite.y - 88),
    ).setDepth(NEED_BUBBLE_DEPTH);
  }

  private resolveWorldCollisions(): void {
    if (this.model.mode !== 'field') return;
    for (const dino of this.dinos) {
      if (!dino.sprite.visible || dino.reacting) continue;
      if (this.resolvePondCollision(dino)) continue;
      if (this.ballPlaced && !this.draggingBall
        && Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, this.ball.x, this.ball.y) < PLAY_COLLISION_RADIUS) {
        this.playBall(dino);
        break;
      }
    }
  }

  private resolvePondCollision(dino: DinoEntity): boolean {
    const distance = Phaser.Math.Distance.Between(dino.sprite.x, dino.sprite.y, POND.x, POND.y);
    if (distance > POND_COLLISION_RADIUS + 2) {
      dino.touchingPond = false;
      return false;
    }

    dino.touchingPond = true;
    this.pushAway(dino.sprite, POND.x, POND.y, POND_COLLISION_RADIUS + 4);
    if (dino.dragging) return true;

    this.tweens.killTweensOf(dino.sprite);
    if (this.model.needFor(dino.index) === 'bath') {
      this.bathDino(dino);
      return true;
    }
    this.scheduleRoam(dino, 700);
    return true;
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

  private bathDino(dino: DinoEntity): void {
    if (dino.reacting) return;
    dino.reacting = true;
    this.tweens.killTweensOf(dino.sprite);
    dino.roamTimer?.remove(false);
    dino.sprite.setPosition(POND.x, POND.y - 28).setDepth(505).setScale(0.096).setAlpha(1);
    this.sounds.splash();
    this.makeSplash();
    if (this.model.fulfillNeed(dino.index, 'bath')) this.completeNeed(dino);
    this.tweens.add({ targets: dino.sprite, y: POND.y - 48, angle: { from: -3, to: 3 }, duration: 160, yoyo: true, repeat: 2 });
    this.time.delayedCall(1150, () => {
      dino.reacting = false;
      dino.sprite.setPosition(POND.x - 145 - dino.index * 8, POND.y - dino.index * 12).setScale(DINO_SCALE).setAngle(0).setAlpha(1);
      this.resolveDinoSeparation(dino);
      this.scheduleRoam(dino, 900);
    });
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
      targets: this.ball, x: BALL_HOME.x, y: BALL_HOME.y, scale: 0.071, angle: '+=420', alpha: 1,
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
    this.ball.setScale(0.075).setAlpha(1);
    this.resolveWorldCollisions();
  }

  private returnBallToTray(): void {
    this.ballPlaced = false;
    this.ball.setPosition(BALL_HOME.x, BALL_HOME.y).setScale(0.071).setDepth(704).setAlpha(1);
  }

  private scheduleRoam(dino: DinoEntity, delay: number): void {
    dino.roamTimer?.remove(false);
    dino.roamTimer = this.time.delayedCall(delay, () => this.roam(dino));
  }

  private roam(dino: DinoEntity): void {
    if (dino.dragging || dino.reacting) return this.scheduleRoam(dino, 800);
    const rawX = dino.sprite.x + Phaser.Math.Between(-300, 300);
    const rawY = dino.sprite.y + Phaser.Math.Between(-170, 170);
    let targetX = Phaser.Math.Clamp(rawX, FIELD.left + DINO_RADIUS, FIELD.right - DINO_RADIUS);
    let targetY = Phaser.Math.Clamp(rawY, FIELD.top + DINO_RADIUS, FIELD.bottom - DINO_RADIUS);
    const pondDistance = Phaser.Math.Distance.Between(targetX, targetY, POND.x, POND.y);
    if (pondDistance < POND_COLLISION_RADIUS) {
      const angle = Phaser.Math.Angle.Between(POND.x, POND.y, targetX, targetY);
      targetX = POND.x + Math.cos(angle) * POND_COLLISION_RADIUS;
      targetY = POND.y + Math.sin(angle) * POND_COLLISION_RADIUS;
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
      this.rewardEgg.setVisible(true).setAlpha(0).setScale(0);
      this.tweens.add({ targets: this.rewardEgg, scale: 0.09, alpha: 1, duration: 700, ease: 'Back.Out' });
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

  private makeSplash(): void {
    for (let index = 0; index < 12; index += 1) {
      const drop = this.add.circle(POND.x + Phaser.Math.Between(-55, 55), POND.y, Phaser.Math.Between(5, 10), 0x8be4ea, 0.88).setDepth(700);
      this.tweens.add({ targets: drop, x: drop.x + Phaser.Math.Between(-95, 95), y: drop.y - Phaser.Math.Between(55, 125), alpha: 0, duration: 520, onComplete: () => drop.destroy() });
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
