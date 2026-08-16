import type { DinoNeed, PlayMode } from '../game/GameModel';

declare global {
  interface Window {
    __DINOLAND__?: {
      getState: () => {
        mode: PlayMode;
        eggTaps: number;
        eggBusy: boolean;
        need: DinoNeed | null;
        secondNeed: DinoNeed | null;
        needs: Array<DinoNeed | null>;
        hearts: number;
        heartTarget: number;
        scoreText: string;
        cannonLoaded: 'apple' | 'ball' | null;
        cannonPower: number;
        lastCannonPower: number;
        lastCannonSpeed: number;
        lastShotWallBounces: number;
        lastShotHitDino: boolean;
        lastDinoImpactSpeed: number;
        cannonShotActive: boolean;
        cannonAngle: number;
        cannonGuideEndX: number;
        cannonGuideEndY: number;
        movingObjectCount: number;
        firstDinoBouncing: boolean;
        secondDinoBouncing: boolean;
        bouncingDinoCount: number;
        firstBounceSpeed: number;
        cannonDinoCollisions: number;
        firstCannonDistance: number;
        dinoCount: number;
        newEggUnlocked: boolean;
        secondEggVisible: boolean;
        secondEggTaps: number;
        secondEggBusy: boolean;
        secondDinoVisible: boolean;
        secondDinoAlpha: number;
        firstBubbleVisible: boolean;
        secondBubbleVisible: boolean;
        secondBubbleAlpha: number;
        secondBubbleX: number;
        secondBubbleY: number;
        firstBubbleAlpha: number;
        firstBubbleX: number;
        firstBubbleY: number;
        fieldItemCount: number;
        fieldItems: Array<{ type: 'apple' | 'ball' | null; x: number; y: number }>;
        lootReady: boolean;
        lootVisible: boolean;
        cannonBoostReady: boolean;
        lootX: number;
        lootY: number;
        eggX: number;
        eggY: number;
        secondEggX: number;
        secondEggY: number;
        dinoX: number;
        dinoY: number;
        secondDinoX: number;
        secondDinoY: number;
        dinoDistance: number;
        firstRewardEggDistance: number;
      };
      forceNeed: (dinoIndex: number, need: DinoNeed) => DinoNeed | null;
      pauseDino: (dinoIndex: number) => void;
      fulfillActiveNeed: (dinoIndex: number) => boolean;
      placeDino: (dinoIndex: number, x: number, y: number) => boolean;
      launchDino: (dinoIndex: number, vx: number, vy: number) => boolean;
      resumeDino: (dinoIndex: number) => boolean;
      placeCareItem: (need: DinoNeed, x: number, y: number) => boolean;
    };
  }
}

export {};
