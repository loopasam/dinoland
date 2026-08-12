import Phaser from 'phaser';
import { SoundGarden } from '../audio/SoundGarden';
import { GameModel, loadProgress, saveProgress, SAVE_KEY } from '../game/GameModel';

const WIDTH = 1280;
const HEIGHT = 720;

export class NurseryScene extends Phaser.Scene {
  private model!: GameModel;
  private sounds = new SoundGarden();
  private egg!: Phaser.GameObjects.Image;
  private dino!: Phaser.GameObjects.Image;
  private ball!: Phaser.GameObjects.Image;
  private bath!: Phaser.GameObjects.Image;
  private crack!: Phaser.GameObjects.Graphics;
  private shade!: Phaser.GameObjects.Rectangle;
  private backButton!: Phaser.GameObjects.Container;
  private resetButton!: Phaser.GameObjects.Container;
  private muteButton!: Phaser.GameObjects.Container;
  private bubbles: Phaser.GameObjects.Container[] = [];
  private reacting = false;
  private eggBusy = false;
  private pendingEggTap = false;
  private recentDinoClicks: number[] = [];
  private poppedBubbles = 0;
  private idleEvent?: Phaser.Time.TimerEvent;
  private resetTimer?: Phaser.Time.TimerEvent;
  private resetRing?: Phaser.GameObjects.Arc;

  constructor() {
    super('NurseryScene');
  }

  preload(): void {
    this.load.image('nursery', `${import.meta.env.BASE_URL}assets/nursery-background.jpg`);
    this.load.image('egg', `${import.meta.env.BASE_URL}assets/egg.webp`);
    this.load.image('dino', `${import.meta.env.BASE_URL}assets/baby-triceratops.webp`);
    this.load.image('ball', `${import.meta.env.BASE_URL}assets/ball.webp`);
    this.load.image('bath', `${import.meta.env.BASE_URL}assets/bath.webp`);
  }

  create(): void {
    const progress = loadProgress(localStorage);
    this.model = new GameModel(progress.hatched);
    this.add.image(WIDTH / 2, HEIGHT / 2, 'nursery').setDisplaySize(WIDTH, HEIGHT);

    this.createAmbientSurprises();
    this.createMainObjects();
    this.createControls();
    this.bindGlobalInput();
    this.refreshMode(false);
    this.scheduleIdle();

    window.__DINOLAND__ = {
      getState: () => ({ mode: this.model.mode, eggTaps: this.model.eggTaps, poppedBubbles: this.poppedBubbles }),
    };
  }

  private createMainObjects(): void {
    this.bath = this.add.image(1060, 520, 'bath').setScale(0.3).setInteractive({ useHandCursor: true });
    this.bath.setData('home', { x: 1060, y: 520, scale: 0.3 });
    this.bath.on('pointerdown', () => this.enterBath());

    this.ball = this.add.image(210, 558, 'ball').setScale(0.16).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.ball);
    this.ball.setData('home', { x: 210, y: 558 });
    this.ball.setData('dragged', false);
    this.ball.on('dragstart', () => this.ball.setData('dragged', false));
    this.ball.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.ball.setData('dragged', true);
      this.ball.setPosition(Phaser.Math.Clamp(dragX, 70, WIDTH - 70), Phaser.Math.Clamp(dragY, 100, HEIGHT - 60));
      if (this.model.mode === 'free-play') this.dino.setRotation((this.ball.x - this.dino.x) * 0.00012);
    });
    this.ball.on('dragend', () => this.finishBallDrag());
    this.ball.on('pointerup', () => {
      if (!this.ball.getData('dragged') && this.model.mode === 'free-play') this.bounceBall();
    });

    this.egg = this.add.image(640, 445, 'egg').setScale(0.34).setInteractive({ useHandCursor: true });
    this.egg.on('pointerdown', () => this.tapEgg());
    this.tweens.add({ targets: this.egg, y: 438, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.crack = this.add.graphics().setDepth(4);

    this.dino = this.add.image(640, 446, 'dino').setScale(0.34).setInteractive({ useHandCursor: true });
    this.dino.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleDinoClick(pointer));
    this.dino.setVisible(false);

    this.shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x263b35, 0.52).setVisible(false).setDepth(10);
  }

  private bindGlobalInput(): void {
    this.input.on('pointerdown', () => this.sounds.unlock());
  }

  private tapEgg(): void {
    if (this.model.mode !== 'egg') return;
    if (this.eggBusy) {
      this.pendingEggTap = true;
      return;
    }
    this.eggBusy = true;
    this.tweens.killTweensOf(this.egg);
    const stage = this.model.tapEgg();
    if (stage < 4) this.sounds.egg(stage);

    if (stage === 1) {
      this.tweens.add({ targets: this.egg, angle: { from: -7, to: 7 }, duration: 70, yoyo: true, repeat: 2 });
      this.releaseEgg(stage, 440);
    } else if (stage === 2) {
      this.drawCracks(false);
      this.tweens.add({ targets: this.egg, scaleX: 0.36, scaleY: 0.32, duration: 120, yoyo: true, repeat: 1 });
      this.releaseEgg(stage, 500);
    } else if (stage === 3) {
      this.drawCracks(true);
      this.tweens.add({ targets: this.egg, y: 350, duration: 230, yoyo: true, ease: 'Quad.Out' });
      this.releaseEgg(stage, 650);
    } else {
      this.beginHatch();
    }
  }

  private releaseEgg(stage: number, delay: number): void {
    this.time.delayedCall(delay, () => {
      this.eggBusy = false;
      if (stage === 3) this.showHintSparkles();
      if (this.pendingEggTap) {
        this.pendingEggTap = false;
        this.tapEgg();
      }
    });
  }

  private drawCracks(big: boolean): void {
    this.crack.clear().lineStyle(big ? 7 : 5, 0x6b4b48, 0.9);
    const topY = big ? 300 : 330;
    this.crack.beginPath();
    this.crack.moveTo(640, topY);
    this.crack.lineTo(622, topY + 38);
    this.crack.lineTo(648, topY + 62);
    this.crack.lineTo(626, topY + 94);
    if (big) {
      this.crack.moveTo(648, topY + 62);
      this.crack.lineTo(677, topY + 85);
      this.crack.moveTo(622, topY + 38);
      this.crack.lineTo(594, topY + 58);
    }
    this.crack.strokePath();
  }

  private beginHatch(): void {
    this.sounds.hatch();
    this.drawCracks(true);
    this.tweens.add({
      targets: this.egg,
      scale: 0.4,
      angle: { from: -8, to: 8 },
      duration: 90,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.burstShell();
        this.egg.setVisible(false);
        this.crack.clear();
        this.dino.setVisible(true).setScale(0.05).setY(470).setAlpha(0);
        this.tweens.add({
          targets: this.dino,
          scale: 0.34,
          y: 446,
          alpha: 1,
          duration: 620,
          ease: 'Back.Out',
          onComplete: () => {
            this.model.finishHatching();
            saveProgress(localStorage, this.model.serialize());
            this.eggBusy = false;
            this.happyReaction();
          },
        });
      },
    });
  }

  private burstShell(): void {
    const colors = [0xf8e5b7, 0xe9b99d, 0xc9786e];
    for (let i = 0; i < 18; i += 1) {
      const piece = this.add.polygon(640, 430, [0, 0, 14, 4, 9, 20, -4, 13], Phaser.Utils.Array.GetRandom(colors)).setDepth(6);
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const distance = Phaser.Math.Between(110, 270);
      this.tweens.add({
        targets: piece,
        x: 640 + Math.cos(angle) * distance,
        y: 430 + Math.sin(angle) * distance + 170,
        rotation: Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        duration: Phaser.Math.Between(650, 1000),
        ease: 'Quad.Out',
        onComplete: () => piece.destroy(),
      });
    }
  }

  private handleDinoClick(pointer: Phaser.Input.Pointer): void {
    if (this.model.mode === 'bath') {
      this.splash();
      return;
    }
    if (this.model.mode !== 'free-play' || this.reacting) return;

    const now = this.time.now;
    this.recentDinoClicks = this.recentDinoClicks.filter((value) => now - value < 900);
    this.recentDinoClicks.push(now);
    if (this.recentDinoClicks.length >= 4) {
      this.recentDinoClicks = [];
      this.dizzyReaction();
      return;
    }

    const bounds = this.dino.getBounds();
    const nx = (pointer.worldX - bounds.left) / bounds.width;
    const ny = (pointer.worldY - bounds.top) / bounds.height;
    if (ny > 0.72) this.stompReaction();
    else if (nx < 0.28) this.tailReaction();
    else if (ny < 0.3) this.hornReaction();
    else if (nx > 0.56) this.petReaction();
    else this.giggleReaction();
  }

  private petReaction(): void {
    this.reactFor(540);
    this.sounds.chirp(1.1);
    this.tweens.add({ targets: this.dino, x: 655, angle: 4, scale: 0.36, duration: 190, yoyo: true, repeat: 1 });
    this.makeHearts();
  }

  private giggleReaction(): void {
    this.reactFor(620);
    this.sounds.giggle();
    this.tweens.add({ targets: this.dino, scaleX: 0.37, scaleY: 0.31, angle: { from: -3, to: 3 }, duration: 100, yoyo: true, repeat: 2 });
  }

  private stompReaction(): void {
    this.reactFor(520);
    this.sounds.stomp();
    this.tweens.add({ targets: this.dino, y: 426, duration: 90, yoyo: true, repeat: 2, ease: 'Quad.Out' });
    this.dustPuffs();
  }

  private tailReaction(): void {
    this.reactFor(700);
    this.sounds.chirp(0.85);
    this.tweens.add({ targets: this.dino, angle: -8, x: 615, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
  }

  private hornReaction(): void {
    this.reactFor(620);
    this.sounds.chirp(1.25);
    this.tweens.add({ targets: this.dino, angle: { from: -5, to: 5 }, y: 435, duration: 90, yoyo: true, repeat: 3 });
    this.showSparkles(this.dino.x + 50, this.dino.y - 120, 0xffe37b);
  }

  private dizzyReaction(): void {
    this.reactFor(1050);
    this.sounds.giggle();
    this.tweens.add({ targets: this.dino, angle: 360, duration: 850, ease: 'Cubic.InOut', onComplete: () => this.dino.setAngle(0) });
    for (let i = 0; i < 6; i += 1) {
      this.time.delayedCall(i * 100, () => this.showSparkles(this.dino.x + Phaser.Math.Between(-80, 80), this.dino.y - 120, 0xffd967));
    }
  }

  private happyReaction(): void {
    this.sounds.chirp(1.15);
    this.tweens.add({ targets: this.dino, y: 420, duration: 170, yoyo: true, repeat: 2, ease: 'Quad.Out' });
    this.makeHearts();
  }

  private reactFor(duration: number): void {
    this.reacting = true;
    this.time.delayedCall(duration, () => {
      this.reacting = false;
      this.dino.setPosition(640, 446).setScale(0.34).setAngle(0).setFlipX(false);
    });
  }

  private bounceBall(): void {
    this.sounds.bounce();
    this.tweens.add({ targets: this.ball, y: this.ball.y - 90, angle: this.ball.angle + 120, duration: 220, yoyo: true, ease: 'Quad.Out' });
  }

  private finishBallDrag(): void {
    if (this.model.mode !== 'free-play') return;
    this.dino.setAngle(0);
    const distance = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, this.dino.x, this.dino.y);
    if (distance < 280) {
      this.sounds.bounce();
      this.reactFor(700);
      const targetX = this.ball.x < WIDTH / 2 ? 260 : 1020;
      this.tweens.add({ targets: this.dino, x: this.dino.x + (this.ball.x - this.dino.x) * 0.22, angle: 7, duration: 180, yoyo: true });
      this.tweens.add({ targets: this.ball, x: targetX, y: Phaser.Math.Between(500, 590), angle: this.ball.angle + 480, duration: 650, ease: 'Cubic.Out' });
      this.showSparkles(this.ball.x, this.ball.y, 0x8edfd0);
    }
  }

  private enterBath(): void {
    if (this.model.mode !== 'free-play') return;
    this.model.enterBath();
    this.reacting = false;
    this.shade.setVisible(true);
    this.shade.setInteractive();
    this.bath.setDepth(12).setInteractive().setPosition(640, 530).setScale(0.66);
    this.dino.setDepth(13).setPosition(640, 380).setScale(0.3).setAngle(0).setVisible(true);
    this.ball.setVisible(false);
    this.backButton.setVisible(true).setDepth(20);
    this.resetButton.setVisible(false);
    this.spawnBubbles();
    this.sounds.splash();
    this.tweens.add({ targets: this.dino, y: 355, duration: 220, yoyo: true, ease: 'Quad.Out' });
  }

  private leaveBath(): void {
    if (this.model.mode !== 'bath') return;
    this.model.leaveBath();
    this.clearBubbles();
    this.shade.disableInteractive().setVisible(false);
    const home = this.bath.getData('home') as { x: number; y: number; scale: number };
    this.bath.setPosition(home.x, home.y).setScale(home.scale).setDepth(1);
    this.dino.setPosition(640, 446).setScale(0.34).setDepth(2).setAngle(0);
    this.ball.setVisible(true);
    this.backButton.setVisible(false);
    this.resetButton.setVisible(true);
  }

  private spawnBubbles(): void {
    this.clearBubbles();
    const positions = [
      [470, 470], [545, 545], [615, 460], [690, 540], [770, 465], [820, 540], [510, 610], [660, 610], [780, 610],
    ];
    positions.forEach(([x, y], index) => {
      const radius = 27 + (index % 3) * 8;
      const circle = this.add.circle(0, 0, radius, 0xc7f5f3, 0.46).setStrokeStyle(5, 0xffffff, 0.78);
      const shine = this.add.circle(-radius * 0.28, -radius * 0.32, radius * 0.18, 0xffffff, 0.86);
      const bubble = this.add.container(x, y, [circle, shine]).setDepth(16).setSize(radius * 2.4, radius * 2.4).setInteractive({ useHandCursor: true });
      bubble.on('pointerdown', () => this.popBubble(bubble, index));
      this.tweens.add({ targets: bubble, y: y - 15, duration: 900 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.bubbles.push(bubble);
    });
  }

  private popBubble(bubble: Phaser.GameObjects.Container, index: number): void {
    if (!bubble.active) return;
    this.poppedBubbles += 1;
    this.sounds.bubble(index % 3);
    this.showSparkles(bubble.x, bubble.y, 0xbdf8f4);
    this.tweens.add({ targets: bubble, scale: 1.35, alpha: 0, duration: 110, onComplete: () => bubble.destroy() });
    if (this.poppedBubbles % 6 === 0) this.happyReactionInBath();
  }

  private splash(): void {
    this.sounds.splash();
    this.tweens.add({ targets: this.dino, y: 335, angle: { from: -3, to: 3 }, duration: 100, yoyo: true, repeat: 2 });
    for (let i = 0; i < 8; i += 1) {
      const drop = this.add.circle(this.dino.x + Phaser.Math.Between(-40, 40), this.dino.y + 80, Phaser.Math.Between(5, 10), 0x8be4ea, 0.85).setDepth(17);
      this.tweens.add({ targets: drop, x: drop.x + Phaser.Math.Between(-120, 120), y: drop.y - Phaser.Math.Between(70, 150), alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => drop.destroy() });
    }
  }

  private happyReactionInBath(): void {
    this.sounds.giggle();
    this.tweens.add({ targets: this.dino, angle: { from: -7, to: 7 }, duration: 80, yoyo: true, repeat: 4 });
  }

  private clearBubbles(): void {
    this.bubbles.forEach((bubble) => bubble.destroy());
    this.bubbles = [];
  }

  private refreshMode(animate: boolean): void {
    const hatched = this.model.mode !== 'egg';
    this.egg.setVisible(!hatched);
    this.dino.setVisible(hatched);
    if (hatched && animate) this.happyReaction();
  }

  private createControls(): void {
    this.backButton = this.makeRoundButton(84, 80, 54, 0xfff4d2, '←', () => this.leaveBath()).setVisible(false);
    this.backButton.setName('back-button');

    this.muteButton = this.makeRoundButton(1110, 68, 38, 0xfff4d2, '♪', () => {
      this.sounds.setMuted(!this.sounds.isMuted);
      const label = this.muteButton.getByName('label') as Phaser.GameObjects.Text;
      label.setText(this.sounds.isMuted ? '×' : '♪');
    });

    this.resetButton = this.makeRoundButton(1200, 68, 38, 0xfff4d2, '↻', () => undefined);
    const hit = this.resetButton.getByName('hit') as Phaser.GameObjects.Arc;
    hit.on('pointerdown', () => this.startResetHold());
    hit.on('pointerup', () => this.cancelResetHold());
    hit.on('pointerout', () => this.cancelResetHold());
  }

  private makeRoundButton(x: number, y: number, radius: number, color: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const shadow = this.add.circle(4, 7, radius, 0x5b614e, 0.24);
    const circle = this.add.circle(0, 0, radius, color, 0.96).setStrokeStyle(4, 0xffffff, 0.9).setInteractive({ useHandCursor: true }).setName('hit');
    const text = this.add.text(0, -3, label, { color: '#456458', fontFamily: 'Arial Rounded MT Bold, sans-serif', fontSize: `${Math.round(radius * 1.25)}px`, fontStyle: 'bold' }).setOrigin(0.5).setName('label');
    const container = this.add.container(x, y, [shadow, circle, text]).setDepth(30);
    circle.on('pointerdown', onClick);
    return container;
  }

  private startResetHold(): void {
    if (this.model.mode === 'bath') return;
    this.cancelResetHold();
    this.resetRing = this.add.circle(this.resetButton.x, this.resetButton.y, 45, 0xffffff, 0).setStrokeStyle(6, 0x6d9f82, 1).setDepth(31);
    this.resetRing.setScale(0.2).setAlpha(0.2);
    this.tweens.add({ targets: this.resetRing, scale: 1, alpha: 1, duration: 1100, ease: 'Linear' });
    this.resetTimer = this.time.delayedCall(1100, () => this.performReset());
  }

  private cancelResetHold(): void {
    this.resetTimer?.remove(false);
    this.resetTimer = undefined;
    this.resetRing?.destroy();
    this.resetRing = undefined;
  }

  private performReset(): void {
    localStorage.removeItem(SAVE_KEY);
    this.model.reset();
    this.cancelResetHold();
    this.scene.restart();
  }

  private createAmbientSurprises(): void {
    const flowerZone = this.add.zone(107, 490, 145, 190).setInteractive({ useHandCursor: true });
    flowerZone.on('pointerdown', () => {
      this.sounds.flower();
      for (let i = 0; i < 5; i += 1) this.showSparkles(105 + Phaser.Math.Between(-55, 55), 470 + Phaser.Math.Between(-45, 45), 0xff8faa);
    });

    const cloudZone = this.add.zone(925, 130, 210, 115).setInteractive({ useHandCursor: true });
    cloudZone.on('pointerdown', () => {
      const cloud = this.add.ellipse(925, 130, 170, 70, 0xffffff, 0.72).setDepth(1);
      this.tweens.add({ targets: cloud, scaleX: 1.25, scaleY: 0.75, x: 965, alpha: 0, duration: 900, ease: 'Sine.InOut', onComplete: () => cloud.destroy() });
      this.sounds.bubble(1);
    });

    const cupboardZone = this.add.zone(1170, 325, 120, 180).setInteractive({ useHandCursor: true });
    cupboardZone.on('pointerdown', () => {
      const eyes = this.add.text(1168, 325, '•  •', { color: '#385149', fontSize: '31px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);
      this.time.delayedCall(800, () => eyes.destroy());
      this.sounds.chirp(1.4);
    });
  }

  private scheduleIdle(): void {
    this.idleEvent?.remove(false);
    this.idleEvent = this.time.addEvent({
      delay: 6500,
      loop: true,
      callback: () => {
        if (this.model.mode !== 'free-play' || this.reacting) return;
        if (Math.random() < 0.5) {
          this.sounds.chirp(0.8);
          this.tweens.add({ targets: this.dino, y: 438, scaleY: 0.33, duration: 240, yoyo: true });
        } else {
          this.tweens.add({ targets: this.dino, angle: -3, duration: 300, yoyo: true, repeat: 1 });
        }
      },
    });
  }

  private showHintSparkles(): void {
    for (let i = 0; i < 4; i += 1) this.time.delayedCall(i * 90, () => this.showSparkles(640 + Phaser.Math.Between(-90, 90), 350 + Phaser.Math.Between(-70, 70), 0xffef8d));
  }

  private showSparkles(x: number, y: number, color: number): void {
    for (let i = 0; i < 5; i += 1) {
      const sparkle = this.add.star(x, y, 4, 3, 8, color, 0.92).setDepth(18);
      this.tweens.add({ targets: sparkle, x: x + Phaser.Math.Between(-45, 45), y: y + Phaser.Math.Between(-50, 20), scale: 0, angle: Phaser.Math.Between(-90, 90), alpha: 0, duration: Phaser.Math.Between(350, 600), onComplete: () => sparkle.destroy() });
    }
  }

  private makeHearts(): void {
    for (let i = 0; i < 4; i += 1) {
      const heart = this.add.text(this.dino.x + Phaser.Math.Between(-45, 70), this.dino.y - 90, '♥', { color: '#ff8ca3', fontSize: `${Phaser.Math.Between(24, 40)}px` }).setDepth(18);
      this.tweens.add({ targets: heart, y: heart.y - 100, alpha: 0, angle: Phaser.Math.Between(-20, 20), duration: 800 + i * 100, onComplete: () => heart.destroy() });
    }
  }

  private dustPuffs(): void {
    for (let i = 0; i < 7; i += 1) {
      const dust = this.add.circle(this.dino.x + Phaser.Math.Between(-90, 90), this.dino.y + 105, Phaser.Math.Between(8, 18), 0xe5c991, 0.65).setDepth(1);
      this.tweens.add({ targets: dust, x: dust.x + Phaser.Math.Between(-45, 45), y: dust.y - 30, scale: 1.5, alpha: 0, duration: 500, onComplete: () => dust.destroy() });
    }
  }
}
