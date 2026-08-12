import { describe, expect, it, vi } from 'vitest';
import { GameModel, loadProgress, saveProgress } from './GameModel';

describe('GameModel', () => {
  it('hatches after exactly four taps', () => {
    const model = new GameModel();
    expect([model.tapEgg(), model.tapEgg(), model.tapEgg()]).toEqual([1, 2, 3]);
    expect(model.mode).toBe('egg');
    expect(model.tapEgg()).toBe(4);
    expect(model.mode).toBe('hatching');
    model.finishHatching();
    expect(model.mode).toBe('free-play');
  });

  it('moves in and out of the bath only after hatching', () => {
    const model = new GameModel();
    model.enterBath();
    expect(model.mode).toBe('egg');

    const hatched = new GameModel(true);
    hatched.enterBath();
    expect(hatched.mode).toBe('bath');
    hatched.leaveBath();
    expect(hatched.mode).toBe('free-play');
  });

  it('loads malformed storage safely and saves progress', () => {
    expect(loadProgress({ getItem: () => '{broken' })).toEqual({ hatched: false });
    const setItem = vi.fn();
    saveProgress({ setItem }, { hatched: true });
    expect(setItem).toHaveBeenCalledWith('dinoland-progress-v1', '{"hatched":true}');
  });
});
