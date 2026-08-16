import Phaser from 'phaser';
import { DinoRig, DinoRigParts } from './DinoRig';

const OUTLINE = 0x20363a;
const BODY = 0xf1a45d;
const BODY_DARK = 0xd36e50;
const BELLY = 0xffd98e;
const CREST = 0xc45c50;

export class TRexRig extends DinoRig {
  constructor(scene: Phaser.Scene) {
    super(scene, createParts(scene), {
      artScale: 0.43,
      head: { x: 74, y: -42 },
      tail: { x: -78, y: -13 },
      legs: [{ x: -35, y: 35 }, { x: 17, y: 37 }, { x: 46, y: -16 }, { x: 72, y: -10 }],
      eatHead: { x: 82, y: -25, angle: 18 },
    });
  }
}

function createParts(scene: Phaser.Scene): DinoRigParts {
  const bodyArt = scene.add.graphics();
  bodyArt.fillStyle(BODY, 1).fillEllipse(-8, 0, 180, 118);
  bodyArt.lineStyle(9, OUTLINE, 1).strokeEllipse(-8, 0, 180, 118);
  bodyArt.fillStyle(BELLY, 0.75).fillEllipse(-15, 29, 135, 55);
  bodyArt.lineStyle(10, CREST, 1).lineBetween(-60, -43, -46, -57).lineBetween(-16, -54, -2, -68).lineBetween(29, -50, 43, -61);
  bodyArt.lineStyle(9, CREST, 0.82).lineBetween(-49, -23, -31, -16).lineBetween(8, -36, 27, -28);
  const body = scene.add.container(0, 0, [bodyArt]);

  const tail = scene.add.graphics();
  tail.fillStyle(BODY, 1).fillTriangle(10, -20, -145, 5, 10, 35);
  tail.lineStyle(9, OUTLINE, 1).lineBetween(10, -20, -145, 5).lineBetween(-145, 5, 10, 35);
  tail.lineStyle(7, BELLY, 0.65).lineBetween(-121, 7, -22, 19);
  tail.lineStyle(8, CREST, 0.8).lineBetween(-73, -2, -61, 15).lineBetween(-38, 6, -26, 25);

  const legs = [createHindLeg(scene, BODY_DARK), createHindLeg(scene, 0xe88955), createArm(scene, BODY_DARK), createArm(scene, 0xef985a)];
  const { head, eye, jaw } = createHead(scene);
  return { body, head, tail, eye, jaw, legs };
}

function createHindLeg(scene: Phaser.Scene, color: number): Phaser.GameObjects.Graphics {
  const leg = scene.add.graphics();
  leg.fillStyle(color, 1).fillRoundedRect(-18, -8, 38, 78, 15);
  leg.lineStyle(9, OUTLINE, 1).strokeRoundedRect(-18, -8, 38, 78, 15);
  leg.fillStyle(color, 1).fillRoundedRect(-18, 55, 58, 27, 12);
  leg.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-18, 55, 58, 27, 12);
  leg.lineStyle(5, 0xfff0c8, 1).lineBetween(9, 72, 20, 80).lineBetween(27, 69, 37, 77);
  return leg;
}

function createArm(scene: Phaser.Scene, color: number): Phaser.GameObjects.Graphics {
  const arm = scene.add.graphics();
  arm.fillStyle(color, 1).fillRoundedRect(-8, -4, 20, 45, 9);
  arm.lineStyle(7, OUTLINE, 1).strokeRoundedRect(-8, -4, 20, 45, 9);
  arm.lineStyle(5, 0xfff0c8, 1).lineBetween(-1, 38, -10, 49).lineBetween(7, 39, 5, 53);
  return arm;
}

function createHead(scene: Phaser.Scene): { head: Phaser.GameObjects.Container; eye: Phaser.GameObjects.Graphics; jaw: Phaser.GameObjects.Graphics } {
  const skull = scene.add.graphics();
  skull.fillStyle(BODY, 1).fillRoundedRect(-35, -49, 118, 81, 30);
  skull.lineStyle(9, OUTLINE, 1).strokeRoundedRect(-35, -49, 118, 81, 30);
  skull.fillStyle(0xe99558, 1).fillTriangle(42, -15, 104, 7, 43, 23);
  skull.lineStyle(8, OUTLINE, 1).lineBetween(42, -15, 104, 7).lineBetween(104, 7, 43, 23);
  skull.fillStyle(CREST, 1).fillTriangle(-11, -45, 2, -77, 14, -43).fillTriangle(28, -47, 44, -72, 53, -39);
  skull.lineStyle(6, OUTLINE, 1).strokeTriangle(-11, -45, 2, -77, 14, -43).strokeTriangle(28, -47, 44, -72, 53, -39);
  skull.fillStyle(OUTLINE, 1).fillCircle(75, 4, 4);

  const eye = scene.add.graphics();
  eye.fillStyle(0xfffaf0, 1).fillCircle(17, -19, 15);
  eye.lineStyle(6, OUTLINE, 1).strokeCircle(17, -19, 15);
  eye.fillStyle(OUTLINE, 1).fillCircle(22, -17, 7);
  eye.fillStyle(0xffffff, 1).fillCircle(25, -21, 2);

  const jaw = scene.add.graphics();
  jaw.fillStyle(BODY_DARK, 1).fillRoundedRect(-8, 17, 102, 40, 18);
  jaw.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-8, 17, 102, 40, 18);
  jaw.fillStyle(0xfff2cf, 1)
    .fillTriangle(14, 20, 23, 36, 31, 20)
    .fillTriangle(37, 20, 46, 37, 54, 20)
    .fillTriangle(60, 19, 70, 35, 78, 17);
  jaw.lineStyle(5, 0xa3484d, 1).lineBetween(20, 47, 70, 47);

  return { head: scene.add.container(0, 0, [skull, eye, jaw]), eye, jaw };
}
