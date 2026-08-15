export type PlayMode = 'egg' | 'hatching' | 'field';
export type DinoNeed = 'thirst' | 'play' | 'hunger' | 'affection' | 'music';

export interface SavedProgress {
  hatched: boolean;
  hearts: number;
  heartTarget: number;
  dinoCount: number;
}

interface LegacyProgress extends Partial<SavedProgress> {
  secondEggHatched?: boolean;
}

export const SAVE_KEY = 'dinoland-progress-v2';
export const INITIAL_HEART_TARGET = 4;
export const NEED_CYCLE: readonly DinoNeed[] = ['thirst', 'play', 'hunger', 'affection', 'music'];

function firstNeedFor(dinoIndex: number): DinoNeed {
  return NEED_CYCLE[dinoIndex % NEED_CYCLE.length];
}

function nextNeedAfter(need: DinoNeed): DinoNeed {
  const index = NEED_CYCLE.indexOf(need);
  return NEED_CYCLE[(index + 1) % NEED_CYCLE.length];
}

export class GameModel {
  private _eggTaps: number;
  private _rewardEggTaps = 0;
  private _mode: PlayMode;
  private _hearts: number;
  private _heartTarget: number;
  private _dinoCount: number;
  private rewardHatching = false;
  private needs: Array<DinoNeed | null>;
  private nextNeeds: DinoNeed[];

  constructor(progress: Partial<SavedProgress> = {}) {
    const hatched = progress.hatched === true;
    this._mode = hatched ? 'field' : 'egg';
    this._eggTaps = hatched ? 4 : 0;
    this._dinoCount = hatched ? Math.max(1, Math.floor(progress.dinoCount ?? 1)) : 0;
    this._hearts = Math.max(0, Math.floor(progress.hearts ?? 0));
    this._heartTarget = INITIAL_HEART_TARGET;
    this.needs = Array.from({ length: this._dinoCount }, () => null);
    this.nextNeeds = Array.from({ length: this._dinoCount }, (_, index) => firstNeedFor(index));
  }

  get eggTaps(): number { return this._eggTaps; }
  get rewardEggTaps(): number { return this._rewardEggTaps; }
  get mode(): PlayMode { return this._mode; }
  get hearts(): number { return this._hearts; }
  get heartTarget(): number { return this._heartTarget; }
  get dinoCount(): number { return this._dinoCount; }
  get newEggUnlocked(): boolean { return this._mode === 'field' && this._hearts >= this._heartTarget; }
  get rewardEggHatching(): boolean { return this.rewardHatching; }

  tapEgg(): number {
    if (this._mode !== 'egg') return this._eggTaps;
    this._eggTaps = Math.min(4, this._eggTaps + 1);
    if (this._eggTaps === 4) this._mode = 'hatching';
    return this._eggTaps;
  }

  finishHatching(): void {
    if (this._mode !== 'hatching') return;
    this._mode = 'field';
    this._dinoCount = 1;
    this.needs = [null];
    this.nextNeeds = ['thirst'];
  }

  tapRewardEgg(): number {
    if (!this.newEggUnlocked || this.rewardHatching) return this._rewardEggTaps;
    this._rewardEggTaps = Math.min(4, this._rewardEggTaps + 1);
    if (this._rewardEggTaps === 4) this.rewardHatching = true;
    return this._rewardEggTaps;
  }

  finishRewardHatching(): number {
    if (!this.rewardHatching) return this._dinoCount;
    this.rewardHatching = false;
    this._rewardEggTaps = 0;
    this._dinoCount += 1;
    this._hearts = 0;
    this._heartTarget = INITIAL_HEART_TARGET;
    this.needs.push(null);
    this.nextNeeds.push(firstNeedFor(this._dinoCount - 1));
    return this._dinoCount;
  }

  needFor(dinoIndex: number): DinoNeed | null {
    return this.needs[dinoIndex] ?? null;
  }

  requestNeed(dinoIndex: number, forced?: DinoNeed): DinoNeed | null {
    if (this._mode !== 'field' || dinoIndex < 0 || dinoIndex >= this._dinoCount) return null;
    if (this.needs[dinoIndex]) return this.needs[dinoIndex];
    const need = forced ?? this.nextNeeds[dinoIndex] ?? 'thirst';
    this.needs[dinoIndex] = need;
    this.nextNeeds[dinoIndex] = nextNeedAfter(need);
    return need;
  }

  fulfillNeed(dinoIndex: number, action: DinoNeed): boolean {
    if (this.needs[dinoIndex] !== action) return false;
    this.needs[dinoIndex] = null;
    this._hearts = Math.min(this._heartTarget, this._hearts + 1);
    return true;
  }

  reset(): void {
    this._eggTaps = 0;
    this._rewardEggTaps = 0;
    this._mode = 'egg';
    this._hearts = 0;
    this._heartTarget = INITIAL_HEART_TARGET;
    this._dinoCount = 0;
    this.rewardHatching = false;
    this.needs = [];
    this.nextNeeds = [];
  }

  serialize(): SavedProgress {
    return {
      hatched: this._mode === 'field',
      hearts: this._hearts,
      heartTarget: this._heartTarget,
      dinoCount: this._dinoCount,
    };
  }
}

export function loadProgress(storage: Pick<Storage, 'getItem'>): SavedProgress {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { hatched: false, hearts: 0, heartTarget: INITIAL_HEART_TARGET, dinoCount: 0 };
    const parsed = JSON.parse(raw) as LegacyProgress;
    const hatched = parsed.hatched === true;
    const legacyDinoCount = parsed.secondEggHatched === true ? 2 : hatched ? 1 : 0;
    const isLegacySave = parsed.dinoCount === undefined;
    const dinoCount = hatched ? Math.max(1, Math.floor(parsed.dinoCount ?? legacyDinoCount)) : 0;
    const heartTarget = INITIAL_HEART_TARGET;
    const storedHearts = Number.isFinite(parsed.hearts) ? Math.max(0, Math.floor(parsed.hearts ?? 0)) : 0;
    return {
      hatched,
      hearts: isLegacySave && parsed.secondEggHatched === true ? 0 : Math.min(heartTarget, storedHearts),
      heartTarget,
      dinoCount,
    };
  } catch {
    return { hatched: false, hearts: 0, heartTarget: INITIAL_HEART_TARGET, dinoCount: 0 };
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: SavedProgress): void {
  storage.setItem(SAVE_KEY, JSON.stringify(progress));
}
