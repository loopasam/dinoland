import { DinoSpecies, isDinoSpecies, randomDinoSpecies } from './DinoSpecies';

export type PlayMode = 'egg' | 'hatching' | 'field';
export const INVENTORY_NEEDS = ['hunger', 'play', 'thirst', 'music', 'affection'] as const;
export type DinoNeed = typeof INVENTORY_NEEDS[number];

export interface LootReward {
  unlockedSlot: number | null;
}

export interface SavedProgress {
  scoringVersion: number;
  hatched: boolean;
  hearts: number;
  heartTarget: number;
  dinoCount: number;
  dinoCareCounts: number[];
  dinoSpecies: DinoSpecies[];
  unlockedSlots: number;
  lootClaimed: boolean;
  cannonBoostReady: boolean;
}

interface LegacyProgress extends Partial<SavedProgress> {
  secondEggHatched?: boolean;
}

export const SAVE_KEY = 'dinoland-progress-v2';
export const SCORE_VERSION = 2;
export const INITIAL_HEART_TARGET = 4;
export const INITIAL_UNLOCKED_SLOTS = 2;
export const INVENTORY_CAPACITY = INVENTORY_NEEDS.length;
export const DINO_BABY_SCALE = 0.42;
export const DINO_MAX_SCALE = 0.78;
export const DINO_GROWTH_PER_CARE = 0.04;

export function growthScaleForCareCount(careCount: number): number {
  const count = Math.max(0, Math.floor(Number.isFinite(careCount) ? careCount : 0));
  return Math.min(DINO_MAX_SCALE, DINO_BABY_SCALE + count * DINO_GROWTH_PER_CARE);
}

export class GameModel {
  private _eggTaps: number;
  private _rewardEggTaps = 0;
  private _mode: PlayMode;
  private _hearts: number;
  private _heartTarget: number;
  private _dinoCount: number;
  private _dinoCareCounts: number[];
  private _dinoSpecies: DinoSpecies[];
  private _unlockedSlots: number;
  private _lootClaimed: boolean;
  private _cannonBoostReady: boolean;
  private rewardHatching = false;
  private needs: Array<DinoNeed | null>;
  private nextNeeds: DinoNeed[];

  constructor(progress: Partial<SavedProgress> = {}, private readonly random = Math.random) {
    const hatched = progress.hatched === true;
    this._mode = hatched ? 'field' : 'egg';
    this._eggTaps = hatched ? 4 : 0;
    this._dinoCount = hatched ? Math.max(1, Math.floor(progress.dinoCount ?? 1)) : 0;
    this._dinoCareCounts = Array.from(
      { length: this._dinoCount },
      (_, index) => clampCareCount(progress.dinoCareCounts?.[index]),
    );
    this._dinoSpecies = Array.from(
      { length: this._dinoCount },
      (_, index) => isDinoSpecies(progress.dinoSpecies?.[index])
        ? progress.dinoSpecies[index]
        : randomDinoSpecies(this.random),
    );
    this._heartTarget = INITIAL_HEART_TARGET;
    this._hearts = Math.min(this._heartTarget, Math.max(0, Math.floor(progress.hearts ?? 0)));
    this._unlockedSlots = clampUnlockedSlots(progress.unlockedSlots);
    this._lootClaimed = progress.lootClaimed === true;
    this._cannonBoostReady = progress.cannonBoostReady === true;
    this.needs = Array.from({ length: this._dinoCount }, () => null);
    this.nextNeeds = Array.from({ length: this._dinoCount }, () => 'hunger');
  }

  get eggTaps(): number { return this._eggTaps; }
  get rewardEggTaps(): number { return this._rewardEggTaps; }
  get mode(): PlayMode { return this._mode; }
  get hearts(): number { return this._hearts; }
  get heartTarget(): number { return this._heartTarget; }
  get dinoCount(): number { return this._dinoCount; }
  careCountFor(dinoIndex: number): number { return this._dinoCareCounts[dinoIndex] ?? 0; }
  speciesFor(dinoIndex: number): DinoSpecies { return this._dinoSpecies[dinoIndex] ?? 'triceratops'; }
  get unlockedSlots(): number { return this._unlockedSlots; }
  get newEggUnlocked(): boolean { return this._mode === 'field' && this._hearts >= this._heartTarget; }
  get rewardEggHatching(): boolean { return this.rewardHatching; }
  get lootReady(): boolean {
    return this._mode === 'field'
      && this._hearts >= Math.ceil(this._heartTarget / 2)
      && !this._lootClaimed;
  }
  get cannonBoostReady(): boolean { return this._cannonBoostReady; }

  isNeedUnlocked(need: DinoNeed): boolean {
    return INVENTORY_NEEDS.indexOf(need) < this._unlockedSlots;
  }

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
    this._dinoCareCounts = [0];
    this._dinoSpecies = [randomDinoSpecies(this.random)];
    this.needs = [null];
    this.nextNeeds = ['hunger'];
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
    this._dinoCareCounts.push(0);
    this._dinoSpecies.push(randomDinoSpecies(this.random));
    this._hearts = 0;
    this._heartTarget = INITIAL_HEART_TARGET;
    this._lootClaimed = false;
    this.needs.push(null);
    this.nextNeeds.push('hunger');
    return this._dinoCount;
  }

  needFor(dinoIndex: number): DinoNeed | null {
    return this.needs[dinoIndex] ?? null;
  }

  requestNeed(dinoIndex: number, forced?: DinoNeed): DinoNeed | null {
    if (this._mode !== 'field' || this.newEggUnlocked || this.rewardHatching
      || dinoIndex < 0 || dinoIndex >= this._dinoCount) return null;
    const activeNeed = this.needs[dinoIndex];
    if (activeNeed && forced === undefined) return activeNeed;
    const need = forced ?? this.nextNeeds[dinoIndex] ?? 'hunger';
    if (!this.isNeedUnlocked(need)) return null;
    this.needs[dinoIndex] = need;
    return need;
  }

  fulfillNeed(dinoIndex: number, action: DinoNeed): boolean {
    if (this.newEggUnlocked || this.needs[dinoIndex] !== action) return false;
    this.needs[dinoIndex] = null;
    const availableNeeds = INVENTORY_NEEDS.slice(0, this._unlockedSlots);
    const currentIndex = Math.max(0, availableNeeds.indexOf(action));
    this.nextNeeds[dinoIndex] = availableNeeds[(currentIndex + 1) % availableNeeds.length];
    this._dinoCareCounts[dinoIndex] = this.careCountFor(dinoIndex) + 1;
    this._hearts = Math.min(this._heartTarget, this._hearts + 1);
    if (this.newEggUnlocked) this.needs.fill(null);
    return true;
  }

  collectLoot(): LootReward | undefined {
    if (!this.lootReady) return undefined;
    this._lootClaimed = true;
    this._cannonBoostReady = true;
    const unlockedSlot = this._unlockedSlots < INVENTORY_CAPACITY ? this._unlockedSlots + 1 : null;
    if (unlockedSlot) this._unlockedSlots = unlockedSlot;
    return { unlockedSlot };
  }

  useCannonBoost(): boolean {
    if (!this._cannonBoostReady) return false;
    this._cannonBoostReady = false;
    return true;
  }

  reset(): void {
    this._eggTaps = 0;
    this._rewardEggTaps = 0;
    this._mode = 'egg';
    this._hearts = 0;
    this._heartTarget = INITIAL_HEART_TARGET;
    this._dinoCount = 0;
    this._dinoCareCounts = [];
    this._dinoSpecies = [];
    this._unlockedSlots = INITIAL_UNLOCKED_SLOTS;
    this._lootClaimed = false;
    this._cannonBoostReady = false;
    this.rewardHatching = false;
    this.needs = [];
    this.nextNeeds = [];
  }

  serialize(): SavedProgress {
    return {
      scoringVersion: SCORE_VERSION,
      hatched: this._mode === 'field',
      hearts: this._hearts,
      heartTarget: this._heartTarget,
      dinoCount: this._dinoCount,
      dinoCareCounts: [...this._dinoCareCounts],
      dinoSpecies: [...this._dinoSpecies],
      unlockedSlots: this._unlockedSlots,
      lootClaimed: this._lootClaimed,
      cannonBoostReady: this._cannonBoostReady,
    };
  }
}

export function loadProgress(storage: Pick<Storage, 'getItem'>): SavedProgress {
  const empty = {
    scoringVersion: SCORE_VERSION,
    hatched: false,
    hearts: 0,
    heartTarget: INITIAL_HEART_TARGET,
    dinoCount: 0,
    dinoCareCounts: [],
    dinoSpecies: [],
    unlockedSlots: INITIAL_UNLOCKED_SLOTS,
    lootClaimed: false,
    cannonBoostReady: false,
  };
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as LegacyProgress;
    const hatched = parsed.hatched === true;
    const legacyDinoCount = parsed.secondEggHatched === true ? 2 : hatched ? 1 : 0;
    const isLegacySave = parsed.dinoCount === undefined;
    const dinoCount = hatched ? Math.max(1, Math.floor(parsed.dinoCount ?? legacyDinoCount)) : 0;
    const scoreNeedsMigration = parsed.scoringVersion !== SCORE_VERSION;
    const heartTarget = INITIAL_HEART_TARGET;
    const storedHearts = Number.isFinite(parsed.hearts) ? Math.max(0, Math.floor(parsed.hearts ?? 0)) : 0;
    return {
      scoringVersion: SCORE_VERSION,
      hatched,
      hearts: scoreNeedsMigration || (isLegacySave && parsed.secondEggHatched === true)
        ? 0
        : Math.min(heartTarget, storedHearts),
      heartTarget,
      dinoCount,
      dinoCareCounts: Array.from(
        { length: dinoCount },
        (_, index) => clampCareCount(parsed.dinoCareCounts?.[index]),
      ),
      dinoSpecies: validSavedSpecies(parsed.dinoSpecies, dinoCount),
      unlockedSlots: clampUnlockedSlots(parsed.unlockedSlots),
      lootClaimed: parsed.lootClaimed === true,
      cannonBoostReady: parsed.cannonBoostReady === true,
    };
  } catch {
    return empty;
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: SavedProgress): void {
  storage.setItem(SAVE_KEY, JSON.stringify(progress));
}

function clampUnlockedSlots(value: number | undefined): number {
  const count = Number.isFinite(value) ? Math.floor(value ?? INITIAL_UNLOCKED_SLOTS) : INITIAL_UNLOCKED_SLOTS;
  return Math.min(INVENTORY_CAPACITY, Math.max(INITIAL_UNLOCKED_SLOTS, count));
}

function clampCareCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

function validSavedSpecies(values: DinoSpecies[] | undefined, count: number): DinoSpecies[] {
  const species: DinoSpecies[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = values?.[index];
    if (!isDinoSpecies(value)) break;
    species.push(value);
  }
  return species;
}
