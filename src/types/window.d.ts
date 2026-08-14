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
        eggX: number;
        eggY: number;
        secondEggX: number;
        secondEggY: number;
        dinoX: number;
        dinoY: number;
        secondDinoX: number;
        secondDinoY: number;
        dinoDistance: number;
        firstPondDistance: number;
      };
      forceNeed: (dinoIndex: number, need: DinoNeed) => DinoNeed | null;
      pauseDino: (dinoIndex: number) => void;
      fulfillActiveNeed: (dinoIndex: number) => boolean;
      placeDino: (dinoIndex: number, x: number, y: number) => boolean;
    };
  }
}

export {};
