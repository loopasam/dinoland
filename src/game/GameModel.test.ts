import { describe, expect, it, vi } from 'vitest';
import { GameModel, INITIAL_HEART_TARGET, loadProgress, saveProgress, SAVE_KEY } from './GameModel';

describe('GameModel', () => {
  it('hatches the first dinosaur after exactly four taps', () => {
    const model = new GameModel();
    expect([model.tapEgg(), model.tapEgg(), model.tapEgg()]).toEqual([1, 2, 3]);
    expect(model.tapEgg()).toBe(4);
    expect(model.mode).toBe('hatching');
    model.finishHatching();
    expect(model.mode).toBe('field');
    expect(model.dinoCount).toBe(1);
  });

  it('keeps needs independent for every dinosaur', () => {
    const model = new GameModel({ hatched: true, dinoCount: 2, heartTarget: 4 });
    expect(model.requestNeed(0, 'play')).toBe('play');
    expect(model.requestNeed(1, 'bath')).toBe('bath');
    expect(model.fulfillNeed(1, 'play')).toBe(false);
    expect(model.needFor(0)).toBe('play');
    expect(model.needFor(1)).toBe('bath');
    expect(model.fulfillNeed(0, 'play')).toBe(true);
    expect(model.needFor(0)).toBeNull();
    expect(model.needFor(1)).toBe('bath');
  });

  it('resets every reward round to zero out of four', () => {
    const model = new GameModel({ hatched: true, hearts: 4, dinoCount: 1, heartTarget: 4 });
    expect(model.newEggUnlocked).toBe(true);
    expect([model.tapRewardEgg(), model.tapRewardEgg(), model.tapRewardEgg(), model.tapRewardEgg()]).toEqual([1, 2, 3, 4]);
    expect(model.finishRewardHatching()).toBe(2);
    expect(model.hearts).toBe(0);
    expect(model.heartTarget).toBe(4);
    expect(model.dinoCount).toBe(2);

    for (let index = 0; index < 4; index += 1) {
      model.requestNeed(index % 2, 'play');
      expect(model.fulfillNeed(index % 2, 'play')).toBe(true);
    }
    expect(model.newEggUnlocked).toBe(true);
  });

  it('keeps reward eggs and per-dinosaur needs scalable across many rounds', () => {
    const model = new GameModel({ hatched: true, dinoCount: 1, heartTarget: 4 });

    for (let expectedDinoCount = 2; expectedDinoCount <= 50; expectedDinoCount += 1) {
      for (let heart = 0; heart < 4; heart += 1) {
        const dinoIndex = heart % model.dinoCount;
        expect(model.requestNeed(dinoIndex, heart % 2 === 0 ? 'bath' : 'play')).not.toBeNull();
        expect(model.fulfillNeed(dinoIndex, model.needFor(dinoIndex)!)).toBe(true);
      }
      expect(model.newEggUnlocked).toBe(true);
      expect([model.tapRewardEgg(), model.tapRewardEgg(), model.tapRewardEgg(), model.tapRewardEgg()]).toEqual([1, 2, 3, 4]);
      expect(model.finishRewardHatching()).toBe(expectedDinoCount);
      expect(model.hearts).toBe(0);
      expect(model.heartTarget).toBe(4);
      expect(model.requestNeed(expectedDinoCount - 1)).not.toBeNull();
    }
  });

  it('loads legacy progress and saves scalable progress', () => {
    const legacy = JSON.stringify({ hatched: true, hearts: 2, secondEggHatched: true });
    expect(loadProgress({ getItem: () => legacy })).toEqual({ hatched: true, hearts: 0, heartTarget: 4, dinoCount: 2 });
    expect(loadProgress({ getItem: () => '{broken' })).toEqual({
      hatched: false, hearts: 0, heartTarget: INITIAL_HEART_TARGET, dinoCount: 0,
    });
    const setItem = vi.fn();
    saveProgress({ setItem }, { hatched: true, hearts: 1, heartTarget: 4, dinoCount: 3 });
    expect(setItem).toHaveBeenCalledWith(
      SAVE_KEY,
      '{"hatched":true,"hearts":1,"heartTarget":4,"dinoCount":3}',
    );
  });

  it('fully resets progression and every need', () => {
    const model = new GameModel({ hatched: true, hearts: 4, heartTarget: 4, dinoCount: 2 });
    model.requestNeed(0, 'play');
    model.requestNeed(1, 'bath');
    model.reset();
    expect(model.serialize()).toEqual({ hatched: false, hearts: 0, heartTarget: 4, dinoCount: 0 });
    expect(model.needFor(0)).toBeNull();
  });
});
