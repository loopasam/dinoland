export type PlayMode = 'egg' | 'hatching' | 'free-play' | 'bath';

export interface SavedProgress {
  hatched: boolean;
}

export const SAVE_KEY = 'dinoland-progress-v1';

export class GameModel {
  private _eggTaps = 0;
  private _mode: PlayMode;

  constructor(hatched = false) {
    this._mode = hatched ? 'free-play' : 'egg';
    this._eggTaps = hatched ? 4 : 0;
  }

  get eggTaps(): number {
    return this._eggTaps;
  }

  get mode(): PlayMode {
    return this._mode;
  }

  tapEgg(): number {
    if (this._mode !== 'egg') return this._eggTaps;
    this._eggTaps = Math.min(4, this._eggTaps + 1);
    if (this._eggTaps === 4) this._mode = 'hatching';
    return this._eggTaps;
  }

  finishHatching(): void {
    if (this._mode === 'hatching') this._mode = 'free-play';
  }

  enterBath(): void {
    if (this._mode === 'free-play') this._mode = 'bath';
  }

  leaveBath(): void {
    if (this._mode === 'bath') this._mode = 'free-play';
  }

  reset(): void {
    this._eggTaps = 0;
    this._mode = 'egg';
  }

  serialize(): SavedProgress {
    return { hatched: this._mode === 'free-play' || this._mode === 'bath' };
  }
}

export function loadProgress(storage: Pick<Storage, 'getItem'>): SavedProgress {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { hatched: false };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return { hatched: parsed.hatched === true };
  } catch {
    return { hatched: false };
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: SavedProgress): void {
  storage.setItem(SAVE_KEY, JSON.stringify(progress));
}
