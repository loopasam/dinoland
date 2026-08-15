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
        cannonLoaded: 'ball' | 'drink' | 'food-a' | 'food-b' | 'speaker' | null;
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
        ballPlaced: boolean;
        ballX: number;
        ballY: number;
        drinkPlaced: boolean;
        drinkX: number;
        drinkY: number;
        foodAPlaced: boolean;
        foodAX: number;
        foodAY: number;
        foodBPlaced: boolean;
        foodBX: number;
        foodBY: number;
        speakerPlaced: boolean;
        speakerX: number;
        speakerY: number;
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
      placeCareItem: (
        kind: 'ball' | 'drink' | 'food-a' | 'food-b' | 'speaker',
        x: number,
        y: number,
      ) => boolean;
    };
  }
}

export {};
