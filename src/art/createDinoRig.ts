import Phaser from 'phaser';
import { DinoSpecies } from '../game/DinoSpecies';
import { BrachiosaurusRig } from './BrachiosaurusRig';
import { DinoRig } from './DinoRig';
import { TriceratopsRig } from './TriceratopsRig';
import { TRexRig } from './TRexRig';

const RIG_FACTORIES: Record<DinoSpecies, (scene: Phaser.Scene) => DinoRig> = {
  triceratops: (scene) => new TriceratopsRig(scene),
  trex: (scene) => new TRexRig(scene),
  brachiosaurus: (scene) => new BrachiosaurusRig(scene),
};

export function createDinoRig(scene: Phaser.Scene, species: DinoSpecies): DinoRig {
  return RIG_FACTORIES[species](scene);
}
