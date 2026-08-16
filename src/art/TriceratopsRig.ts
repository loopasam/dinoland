import Phaser from 'phaser';
import { DinoRig, DinoRigParts } from './DinoRig';

const OUTLINE = 0x20363a;
const BODY = 0x83d39f;
const BODY_DARK = 0x5caf83;
const BELLY = 0xc7edba;

export class TriceratopsRig extends DinoRig {
  constructor(scene: Phaser.Scene) {
    super(scene, createParts(scene), {
      artScale: 0.46,
      head: { x: 74, y: -39 },
      tail: { x: -92, y: 3 },
      legs: [{ x: -39, y: 35 }, { x: 3, y: 38 }, { x: 35, y: 37 }, { x: 72, y: 32 }],
    });
  }
}

function createParts(scene: Phaser.Scene): DinoRigParts {
  const bodyArt = scene.add.graphics();
  bodyArt.fillStyle(BODY, 1).fillEllipse(-12, 0, 174, 106);
  bodyArt.lineStyle(8, OUTLINE, 1).strokeEllipse(-12, 0, 174, 106);
  bodyArt.fillStyle(BELLY, 0.72).fillEllipse(-20, 25, 137, 54);
  bodyArt.lineStyle(6, BODY_DARK, 0.75)
    .lineBetween(-56, -29, -42, -33).lineBetween(-42, -33, -45, -13)
    .lineBetween(-11, -39, 1, -42).lineBetween(1, -42, -1, -22);
  bodyArt.fillStyle(BODY_DARK, 0.62).fillCircle(-67, 2, 7).fillCircle(-41, -19, 5);
  const body = scene.add.container(0, 0, [bodyArt]);

  const tail = scene.add.graphics();
  tail.fillStyle(BODY, 1).fillTriangle(7, -16, -100, 12, 8, 22);
  tail.lineStyle(8, OUTLINE, 1).lineBetween(7, -16, -100, 12).lineBetween(-100, 12, 8, 22);
  tail.lineStyle(6, BELLY, 0.7).lineBetween(-79, 13, -12, 15);

  const legs = [BODY_DARK, 0x6fc491, 0x78ca98, 0x91d9aa].map((color) => createLeg(scene, color));
  const { head, eye, jaw } = createHead(scene);
  return { body, head, tail, eye, jaw, legs };
}

function createLeg(scene: Phaser.Scene, color: number): Phaser.GameObjects.Graphics {
  const leg = scene.add.graphics();
  leg.fillStyle(color, 1).fillRoundedRect(-14, -5, 30, 70, 12);
  leg.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-14, -5, 30, 70, 12);
  leg.lineStyle(5, OUTLINE, 1).lineBetween(-8, 57, 11, 57);
  return leg;
}

function createHead(scene: Phaser.Scene): { head: Phaser.GameObjects.Container; eye: Phaser.GameObjects.Graphics; jaw: Phaser.GameObjects.Graphics } {
  const frill = scene.add.graphics();
  frill.fillStyle(0xe79a82, 1).fillCircle(0, -8, 61);
  frill.lineStyle(8, OUTLINE, 1).strokeCircle(0, -8, 61);
  frill.fillStyle(0xf6d7b8, 0.75).fillCircle(-34, -34, 6).fillCircle(34, -32, 6);

  const face = scene.add.graphics();
  face.fillStyle(BODY, 1).fillEllipse(7, 7, 96, 91);
  face.lineStyle(8, OUTLINE, 1).strokeEllipse(7, 7, 96, 91);
  face.fillStyle(0xf5e5b8, 1)
    .fillTriangle(-7, -37, 7, -93, 22, -36)
    .fillTriangle(37, -21, 76, -44, 52, -2)
    .fillTriangle(-33, -23, -69, -50, -49, -4);
  face.lineStyle(7, OUTLINE, 1)
    .strokeTriangle(-7, -37, 7, -93, 22, -36)
    .strokeTriangle(37, -21, 76, -44, 52, -2)
    .strokeTriangle(-33, -23, -69, -50, -49, -4);
  face.fillStyle(0xef8b84, 0.45).fillCircle(-17, 19, 8);

  const eye = scene.add.graphics();
  eye.fillStyle(0xfffaf0, 1).fillCircle(-6, -3, 14);
  eye.lineStyle(6, OUTLINE, 1).strokeCircle(-6, -3, 14);
  eye.fillStyle(OUTLINE, 1).fillCircle(-2, -1, 6);
  eye.fillStyle(0xffffff, 1).fillCircle(0, -4, 2);

  const muzzle = scene.add.graphics();
  muzzle.fillStyle(BELLY, 1).fillTriangle(25, 10, 68, 34, 23, 35);
  muzzle.lineStyle(6, OUTLINE, 1).lineBetween(25, 10, 68, 34).lineBetween(68, 34, 23, 35);
  muzzle.fillStyle(OUTLINE, 1).fillCircle(44, 24, 4);

  const jaw = scene.add.graphics();
  jaw.fillStyle(0x73c394, 1).fillEllipse(11, 39, 72, 33);
  jaw.lineStyle(7, OUTLINE, 1).strokeEllipse(11, 39, 72, 33);
  jaw.lineStyle(4, BELLY, 1).lineBetween(-4, 40, 27, 43);

  return { head: scene.add.container(0, 0, [frill, face, eye, muzzle, jaw]), eye, jaw };
}
