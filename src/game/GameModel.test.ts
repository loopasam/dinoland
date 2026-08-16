import { describe, expect, it } from 'vitest';
import {
  GameModel,
  growthScaleForCareCount,
  heartTargetForDinoCount,
  INITIAL_HEART_TARGET,
  loadProgress,
  saveProgress,
  SAVE_KEY,
} from './GameModel';

function fulfillNextNeed(model: GameModel, dinoIndex = 0): void {
  const need = model.requestNeed(dinoIndex);
  if (!need) throw new Error('Expected a dino need');
  expect(model.fulfillNeed(dinoIndex, need)).toBe(true);
}

describe('GameModel', () => {
  it('hatches one dinosaur and alternates its two basic needs', () => {
    const model = new GameModel();
    for (let tap = 0; tap < 4; tap += 1) model.tapEgg();
    model.finishHatching();

    expect(model.mode).toBe('field');
    expect(model.requestNeed(0)).toBe('hunger');
    expect(model.fulfillNeed(0, 'hunger')).toBe(true);
    expect(model.requestNeed(0)).toBe('play');
    expect(model.fulfillNeed(0, 'play')).toBe(true);
    expect(model.hearts).toBe(2);
  });

  it('never replaces an active need when a delayed request arrives', () => {
    const model = new GameModel({ hatched: true });
    expect(model.requestNeed(0, 'play')).toBe('play');
    expect(model.requestNeed(0)).toBe('play');
    expect(model.needFor(0)).toBe('play');
  });

  it('drops one loot reward halfway through a round', () => {
    const model = new GameModel({ hatched: true });
    fulfillNextNeed(model);
    expect(model.lootReady).toBe(false);
    fulfillNextNeed(model);
    expect(model.lootReady).toBe(true);

    expect(model.collectLoot()).toEqual({ unlockedSlot: 3 });
    expect(model.collectLoot()).toBeUndefined();
    expect(model.unlockedSlots).toBe(3);
    expect(model.cannonBoostReady).toBe(true);
    expect(model.useCannonBoost()).toBe(true);
    expect(model.useCannonBoost()).toBe(false);
  });

  it('cycles through every item type that has been unlocked', () => {
    const model = new GameModel({ hatched: true, dinoCount: 2, unlockedSlots: 5 });
    for (const expected of ['hunger', 'play', 'thirst', 'music', 'affection'] as const) {
      expect(model.requestNeed(0)).toBe(expected);
      expect(model.fulfillNeed(0, expected)).toBe(true);
    }
    expect(model.careCountFor(0)).toBe(5);
    expect(growthScaleForCareCount(model.careCountFor(0))).toBeGreaterThan(growthScaleForCareCount(0));
  });

  it('grows each dino independently and caps its visual size', () => {
    const model = new GameModel({ hatched: true, dinoCount: 2, dinoCareCounts: [3, 20] });

    expect(model.careCountFor(0)).toBe(3);
    expect(model.careCountFor(1)).toBe(20);
    expect(growthScaleForCareCount(0)).toBe(0.42);
    expect(growthScaleForCareCount(3)).toBeCloseTo(0.54);
    expect(growthScaleForCareCount(20)).toBe(0.78);
  });

  it('randomly assigns a species once and preserves it in the save', () => {
    const samples = [0.05, 0.45, 0.95];
    const model = new GameModel({ hatched: true, dinoCount: 3 }, () => samples.shift() ?? 0);

    expect([model.speciesFor(0), model.speciesFor(1), model.speciesFor(2)]).toEqual([
      'triceratops',
      'trex',
      'brachiosaurus',
    ]);

    const restored = new GameModel(model.serialize(), () => 0);
    expect([restored.speciesFor(0), restored.speciesFor(1), restored.speciesFor(2)]).toEqual([
      'triceratops',
      'trex',
      'brachiosaurus',
    ]);
  });

  it('keeps reward eggs scalable and starts a fresh loot round', () => {
    const model = new GameModel({ hatched: true });
    for (let expectedCount = 2; expectedCount <= 8; expectedCount += 1) {
      while (!model.newEggUnlocked) fulfillNextNeed(model);
      if (model.lootReady) model.collectLoot();
      for (let tap = 0; tap < 4; tap += 1) model.tapRewardEgg();
      expect(model.finishRewardHatching()).toBe(expectedCount);
      expect(model.hearts).toBe(0);
      expect(model.lootReady).toBe(false);
      expect(model.heartTarget).toBe(heartTargetForDinoCount(expectedCount));
    }
  });

  it('pauses needs while a reward egg is ready', () => {
    const model = new GameModel({ hatched: true });
    for (let heart = 0; heart < INITIAL_HEART_TARGET; heart += 1) fulfillNextNeed(model);
    expect(model.newEggUnlocked).toBe(true);
    expect(model.requestNeed(0)).toBeNull();
  });

  it('migrates old saves without preserving obsolete item counts', () => {
    const legacy = JSON.stringify({ hatched: true, hearts: 9, secondEggHatched: true, apples: 0 });
    expect(loadProgress({ getItem: () => legacy })).toEqual({
      hatched: true,
      hearts: 0,
      heartTarget: 6,
      dinoCount: 2,
      dinoCareCounts: [0, 0],
      dinoSpecies: [],
      unlockedSlots: 2,
      lootClaimed: false,
      cannonBoostReady: false,
    });
    expect(loadProgress({ getItem: () => '{broken' })).toEqual({
      hatched: false,
      hearts: 0,
      heartTarget: 4,
      dinoCount: 0,
      dinoCareCounts: [],
      dinoSpecies: [],
      unlockedSlots: 2,
      lootClaimed: false,
      cannonBoostReady: false,
    });
  });

  it('serializes loot state and resets cleanly', () => {
    const model = new GameModel({ hatched: true, hearts: 2 });
    model.collectLoot();
    const values: Record<string, string> = {};
    saveProgress({ setItem: (key, value) => { values[key] = value; } }, model.serialize());
    expect(loadProgress({ getItem: (key) => values[key] ?? null })).toEqual(model.serialize());

    model.reset();
    expect(model.serialize()).toEqual({
      hatched: false,
      hearts: 0,
      heartTarget: 4,
      dinoCount: 0,
      dinoCareCounts: [],
      dinoSpecies: [],
      unlockedSlots: 2,
      lootClaimed: false,
      cannonBoostReady: false,
    });
    expect(values[SAVE_KEY]).toBeTruthy();
  });
});
