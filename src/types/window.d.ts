import type { PlayMode } from '../game/GameModel';

declare global {
  interface Window {
    __DINOLAND__?: {
      getState: () => { mode: PlayMode; eggTaps: number; poppedBubbles: number };
    };
  }
}

export {};
