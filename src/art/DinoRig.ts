import Phaser from 'phaser';

export type DinoMotion = 'idle' | 'walk' | 'happy' | 'eat' | 'impact';
export type RigPart = Phaser.GameObjects.Container | Phaser.GameObjects.Graphics;

export interface RigPoint {
  x: number;
  y: number;
}

export interface DinoRigParts {
  body: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Container;
  tail: RigPart;
  eye: RigPart;
  jaw: RigPart;
  legs: RigPart[];
}

export interface DinoRigConfig {
  artScale: number;
  head: RigPoint;
  tail: RigPoint;
  legs: RigPoint[];
  eatHead?: { x: number; y: number; angle: number };
}

/** Shared animation controller; species files only define their vector anatomy and joint positions. */
export class DinoRig {
  readonly root: Phaser.GameObjects.Container;

  private readonly art: Phaser.GameObjects.Container;
  private readonly motionRoot: Phaser.GameObjects.Container;
  private motion?: DinoMotion;

  get currentMotion(): DinoMotion {
    return this.motion ?? 'idle';
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parts: DinoRigParts,
    private readonly config: DinoRigConfig,
  ) {
    this.root = scene.add.container(0, 0);
    this.art = scene.add.container(0, 0).setScale(config.artScale);
    this.motionRoot = scene.add.container(0, 0);
    this.motionRoot.add([
      parts.tail,
      parts.legs[0],
      parts.legs[1],
      parts.body,
      parts.legs[2],
      parts.legs[3],
      parts.head,
    ]);
    this.art.add(this.motionRoot);
    this.root.add(this.art);
    this.setMotion('idle');
  }

  syncFrom(sprite: Phaser.GameObjects.Image): void {
    this.root
      .setPosition(sprite.x, sprite.y)
      .setScale(Math.abs(sprite.scaleX), Math.abs(sprite.scaleY))
      .setAngle(sprite.angle)
      .setAlpha(sprite.alpha)
      .setVisible(sprite.visible)
      .setDepth(sprite.depth + 1);
    this.art.setScale((sprite.flipX ? -1 : 1) * this.config.artScale, this.config.artScale);
  }

  setMotion(nextMotion: DinoMotion): void {
    if (this.motion === nextMotion) return;
    this.motion = nextMotion;
    this.resetPose();

    if (nextMotion === 'idle') this.playIdle();
    else if (nextMotion === 'walk') this.playWalk();
    else if (nextMotion === 'happy') this.playHappy();
    else if (nextMotion === 'eat') this.playEat();
    else this.playImpact();
  }

  private resetPose(): void {
    const { body, head, tail, eye, jaw, legs } = this.parts;
    this.scene.tweens.killTweensOf([this.motionRoot, body, head, tail, eye, jaw, ...legs]);
    this.motionRoot.setPosition(0, 0).setAngle(0).setScale(1);
    body.setPosition(0, 0).setAngle(0).setScale(1);
    head.setPosition(this.config.head.x, this.config.head.y).setAngle(0).setScale(1);
    tail.setPosition(this.config.tail.x, this.config.tail.y).setAngle(0).setScale(1);
    eye.setScale(1);
    jaw.setPosition(0, 0).setAngle(0).setScale(1);
    legs.forEach((leg, index) => {
      const point = this.config.legs[index];
      leg.setPosition(point.x, point.y).setAngle(0).setScale(1);
    });
  }

  private playIdle(): void {
    const { body, head, tail, eye } = this.parts;
    this.scene.tweens.add({ targets: body, scaleX: 1.018, scaleY: 1.03, y: -2, duration: 1550, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: head, y: this.config.head.y - 4, angle: 3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: tail, angle: 8, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: eye, scaleY: 0.08, duration: 80, yoyo: true, repeat: -1, repeatDelay: 2700 });
  }

  private playWalk(): void {
    const { body, head, tail, legs } = this.parts;
    this.scene.tweens.add({ targets: this.motionRoot, y: -7, duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: body, angle: 1.5, scaleX: 0.985, scaleY: 1.02, duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: head, y: this.config.head.y - 6, angle: -5, duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: tail, angle: 11, duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: [legs[0], legs[3]], angle: -16, y: '+=4', duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: [legs[1], legs[2]], angle: 16, y: '-=4', duration: 290, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private playHappy(): void {
    const { head, tail, legs } = this.parts;
    this.scene.tweens.add({ targets: this.motionRoot, y: -25, angle: -3, duration: 260, yoyo: true, repeat: -1, hold: 80, ease: 'Quad.Out' });
    this.scene.tweens.add({ targets: head, angle: -12, y: this.config.head.y - 8, duration: 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: tail, angle: 20, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: legs, angle: -12, y: '-=7', duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private playEat(): void {
    const { body, head, tail, jaw } = this.parts;
    const target = this.config.eatHead ?? {
      x: this.config.head.x + 10,
      y: this.config.head.y + 19,
      angle: 22,
    };
    this.scene.tweens.add({ targets: head, ...target, duration: 440, yoyo: true, repeat: -1, hold: 240, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: jaw, y: 4, angle: 6, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: body, y: 3, scaleX: 1.015, scaleY: 0.985, duration: 440, yoyo: true, repeat: -1, hold: 240, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: tail, angle: 7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private playImpact(): void {
    const { head, tail, legs } = this.parts;
    this.scene.tweens.add({ targets: head, angle: -18, duration: 190, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.tweens.add({ targets: [legs[0], legs[3]], angle: 22, duration: 135, yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: [legs[1], legs[2]], angle: -22, duration: 135, yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: tail, angle: 16, duration: 170, yoyo: true, repeat: -1 });
  }
}
