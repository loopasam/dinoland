import { describe, expect, it } from 'vitest';
import {
  GameModel,
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

  it('drops one loot reward halfway through a round', () => {
    const model = new GameModel({ hatched: true });
    fulfillNextNeed(model);
    expect(model.lootReady).toBe(false);
    fulfillNextNeed(model);
    expect(model.lootReady).toBe(true);

    expect(model.collectLoot()).toBe(true);
    expect(model.collectLoot()).toBe(false);
    expect(model.cannonBoostReady).toBe(true);
    expect(model.useCannonBoost()).toBe(true);
    expect(model.useCannonBoost()).toBe(false);
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
      lootClaimed: false,
      cannonBoostReady: false,
    });
    expect(loadProgress({ getItem: () => '{broken' })).toEqual({
      hatched: false,
      hearts: 0,
      heartTarget: 4,
      dinoCount: 0,
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
      lootClaimed: false,
      cannonBoostReady: false,
    });
    expect(values[SAVE_KEY]).toBeTruthy();
  });
});
