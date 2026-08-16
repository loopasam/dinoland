import Phaser from 'phaser';
import { DinoRig, DinoRigParts } from './DinoRig';

const OUTLINE = 0x20363a;
const BODY = 0x79c4be;
const BODY_DARK = 0x5792ad;
const BELLY = 0xc6e6c3;
const SPOT = 0x7769a7;

export class BrachiosaurusRig extends DinoRig {
  constructor(scene: Phaser.Scene) {
    super(scene, createParts(scene), {
      artScale: 0.38,
      head: { x: 68, y: -8 },
      tail: { x: -95, y: -7 },
      legs: [{ x: -48, y: 37 }, { x: -10, y: 39 }, { x: 46, y: 27 }, { x: 78, y: 24 }],
      eatHead: { x: 77, y: 7, angle: 20 },
    });
  }
}

function createParts(scene: Phaser.Scene): DinoRigParts {
  const bodyArt = scene.add.graphics();
  bodyArt.fillStyle(BODY, 1).fillEllipse(-9, 0, 190, 112);
  bodyArt.lineStyle(9, OUTLINE, 1).strokeEllipse(-9, 0, 190, 112);
  bodyArt.fillStyle(BELLY, 0.74).fillEllipse(-18, 28, 145, 54);
  bodyArt.lineStyle(11, SPOT, 0.82).lineBetween(-58, -34, -42, -25).lineBetween(-7, -47, 10, -36).lineBetween(40, -38, 57, -27);
  bodyArt.fillStyle(SPOT, 0.68).fillCircle(-65, 3, 8).fillCircle(-34, -18, 5);
  const body = scene.add.container(0, 0, [bodyArt]);

  const tail = scene.add.graphics();
  tail.fillStyle(BODY, 1).fillTriangle(8, -19, -132, 10, 8, 28);
  tail.lineStyle(9, OUTLINE, 1).lineBetween(8, -19, -132, 10).lineBetween(-132, 10, 8, 28);
  tail.lineStyle(7, BELLY, 0.65).lineBetween(-107, 12, -18, 18);
  tail.fillStyle(SPOT, 0.72).fillCircle(-61, 7, 7);

  const legs = [
    createLeg(scene, BODY_DARK, 82),
    createLeg(scene, 0x68a7b6, 82),
    createLeg(scene, 0x70b4ba, 98),
    createLeg(scene, 0x86cbc5, 102),
  ];
  const { head, eye, jaw } = createHead(scene);
  return { body, head, tail, eye, jaw, legs };
}

function createLeg(scene: Phaser.Scene, color: number, height: number): Phaser.GameObjects.Graphics {
  const leg = scene.add.graphics();
  leg.fillStyle(color, 1).fillRoundedRect(-15, -5, 32, height, 12);
  leg.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-15, -5, 32, height, 12);
  leg.lineStyle(5, 0xeaf1cf, 1).lineBetween(-7, height - 5, 1, height + 2).lineBetween(6, height - 5, 14, height + 1);
  return leg;
}

function createHead(scene: Phaser.Scene): { head: Phaser.GameObjects.Container; eye: Phaser.GameObjects.Graphics; jaw: Phaser.GameObjects.Graphics } {
  const neck = scene.add.graphics();
  neck.fillStyle(BODY, 1).fillRoundedRect(-22, -183, 54, 205, 24);
  neck.lineStyle(9, OUTLINE, 1).strokeRoundedRect(-22, -183, 54, 205, 24);
  neck.fillStyle(BELLY, 0.68).fillRoundedRect(-8, -170, 22, 180, 10);
  neck.lineStyle(10, SPOT, 0.8).lineBetween(-17, -76, 18, -66).lineBetween(-16, -125, 19, -114);

  const skull = scene.add.graphics();
  skull.fillStyle(0x91d7c7, 1).fillRoundedRect(-21, -219, 98, 58, 25);
  skull.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-21, -219, 98, 58, 25);
  skull.fillStyle(0x86c8bd, 1).fillTriangle(39, -196, 96, -179, 37, -166);
  skull.lineStyle(7, OUTLINE, 1).lineBetween(39, -196, 96, -179).lineBetween(96, -179, 37, -166);
  skull.fillStyle(SPOT, 1).fillTriangle(-4, -213, 5, -245, 17, -211).fillTriangle(31, -216, 44, -244, 53, -208);
  skull.lineStyle(6, OUTLINE, 1).strokeTriangle(-4, -213, 5, -245, 17, -211).strokeTriangle(31, -216, 44, -244, 53, -208);
  skull.fillStyle(OUTLINE, 1).fillCircle(70, -179, 4);

  const eye = scene.add.graphics();
  eye.fillStyle(0xfffaf0, 1).fillCircle(25, -191, 14);
  eye.lineStyle(6, OUTLINE, 1).strokeCircle(25, -191, 14);
  eye.fillStyle(OUTLINE, 1).fillCircle(30, -189, 6);
  eye.fillStyle(0xffffff, 1).fillCircle(32, -193, 2);

  const jaw = scene.add.graphics();
  jaw.fillStyle(BODY_DARK, 1).fillRoundedRect(1, -174, 82, 32, 14);
  jaw.lineStyle(7, OUTLINE, 1).strokeRoundedRect(1, -174, 82, 32, 14);
  jaw.lineStyle(5, BELLY, 1).lineBetween(20, -151, 65, -151);

  return { head: scene.add.container(0, 0, [neck, skull, eye, jaw]), eye, jaw };
}
