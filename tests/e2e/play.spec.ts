import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dinoland/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('egg');
});

test('hatches, places a persistent ball, and fulfills needs by collision', async ({ page }) => {
  test.setTimeout(60_000);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const start = point(from.x, from.y);
    const end = point(to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };

  await drag({ x: 490, y: 360 }, { x: 570, y: 330 });
  let state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.eggX).toBeGreaterThan(540);

  for (let index = 0; index < 2; index += 1) {
    state = await page.evaluate(() => window.__DINOLAND__!.getState());
    const egg = point(state.eggX, state.eggY);
    await page.mouse.click(egg.x, egg.y);
    await page.waitForTimeout(650);
    await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggTaps)).toBe(index + 1);
  }

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggBusy)).toBe(false);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await drag({ x: state.eggX, y: state.eggY }, { x: 650, y: 370 });
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.eggTaps).toBe(2);
  expect(state.eggX).toBeGreaterThan(620);

  for (let index = 2; index < 4; index += 1) {
    state = await page.evaluate(() => window.__DINOLAND__!.getState());
    const egg = point(state.eggX, state.eggY);
    await page.mouse.click(egg.x, egg.y);
    if (index === 3) await page.mouse.click(egg.x, egg.y);
    await page.waitForTimeout(index === 3 ? 1200 : 650);
    await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggTaps)).toBe(index + 1);
  }

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('field');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.need).toBe('bath');
  expect(state.firstBubbleVisible).toBe(true);
  expect(state.firstBubbleAlpha).toBe(1);
  expect(Math.abs(state.firstBubbleX - state.dinoX)).toBeLessThanOrEqual(1);
  expect(state.firstBubbleY).toBeLessThan(state.dinoY);

  expect(await page.evaluate(() => window.__DINOLAND__?.fulfillActiveNeed(0))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().need), { timeout: 7000 }).toBe('play');

  await drag({ x: 86, y: 650 }, { x: 620, y: 430 });
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  if (state.hearts < 2) {
    expect(state.ballPlaced).toBe(true);
    await page.evaluate(() => window.__DINOLAND__?.pauseDino(0));
    state = await page.evaluate(() => window.__DINOLAND__!.getState());
    await drag({ x: state.dinoX, y: state.dinoY }, { x: state.ballX, y: state.ballY });
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dinoland-progress-v2') ?? '{}').hearts)).toBe(2);

  await page.evaluate(() => window.__DINOLAND__?.pauseDino(0));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await drag({ x: state.dinoX, y: state.dinoY }, { x: 80, y: 80 });
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.dinoX).toBeGreaterThanOrEqual(209);
  expect(state.dinoY).toBeGreaterThanOrEqual(191);
});

test('reveals and reuses the four-heart egg to hatch a third dinosaur', async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({ hatched: true, hearts: 4, secondEggHatched: false })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().newEggUnlocked)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggVisible)).toBe(true);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const start = point(760, 285);
  const end = point(680, 360);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();

  let state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.secondEggY).toBeGreaterThan(330);
  for (let index = 0; index < 4; index += 1) {
    state = await page.evaluate(() => window.__DINOLAND__!.getState());
    const egg = point(state.secondEggX, state.secondEggY);
    await page.mouse.click(egg.x, egg.y);
    await page.waitForTimeout(index === 3 ? 1300 : 650);
    if (index < 3) {
      await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggTaps)).toBe(index + 1);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggVisible)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondDinoVisible)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondDinoAlpha)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 0,
    heartTarget: 4,
    dinoCount: 2,
    secondNeed: 'play',
    secondBubbleVisible: true,
    secondBubbleAlpha: 1,
  });
  await page.evaluate(() => window.__DINOLAND__?.pauseDino(1));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(Math.abs(state.secondBubbleX - state.secondDinoX)).toBeLessThanOrEqual(1);
  expect(state.secondBubbleY).toBeLessThan(state.secondDinoY);

  const ballStart = point(86, 650);
  const secondDino = point(state.secondDinoX, state.secondDinoY);
  await page.mouse.move(ballStart.x, ballStart.y);
  await page.mouse.down();
  await page.mouse.move(secondDino.x, secondDino.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 1,
    secondNeed: null,
    secondBubbleVisible: false,
    ballPlaced: false,
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondNeed), { timeout: 7000 }).toBe('bath');
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    secondBubbleVisible: true,
    secondBubbleAlpha: 1,
  });

  for (const dinoIndex of [1, 0, 1]) {
    const completed = await page.evaluate((index) => {
      const game = window.__DINOLAND__;
      if (!game) return false;
      if (!game.getState().needs[index]) game.forceNeed(index, index % 2 === 0 ? 'bath' : 'play');
      return game.fulfillActiveNeed(index);
    }, dinoIndex);
    expect(completed).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 4,
    heartTarget: 4,
    dinoCount: 2,
    secondEggVisible: true,
    secondEggBusy: false,
  });
  await page.waitForTimeout(800);

  for (let index = 0; index < 4; index += 1) {
    state = await page.evaluate(() => window.__DINOLAND__!.getState());
    const egg = point(state.secondEggX, state.secondEggY);
    await page.mouse.click(egg.x, egg.y);
    await page.waitForTimeout(index === 3 ? 1500 : 650);
    if (index < 3) {
      await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggTaps)).toBe(index + 1);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 0,
    heartTarget: 4,
    dinoCount: 3,
    secondEggVisible: false,
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().needs[2])).not.toBeNull();
});

test('keeps dinosaur needs and physical collisions independent', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 0,
    heartTarget: 4,
    dinoCount: 2,
  })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoCount)).toBe(2);
  await page.evaluate(() => {
    window.__DINOLAND__?.forceNeed(0, 'play');
    window.__DINOLAND__?.forceNeed(1, 'bath');
  });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const start = point(from.x, from.y);
    const end = point(to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };

  let state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(() => window.__DINOLAND__?.pauseDino(1));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await drag({ x: 86, y: 650 }, { x: state.secondDinoX, y: state.secondDinoY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.need).toBe('play');
  expect(state.secondNeed).toBe('bath');

  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__DINOLAND__?.placeDino(1, 970, 410))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(1);

  expect(await page.evaluate(() => window.__DINOLAND__?.placeDino(0, 970, 410))).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.firstPondDistance).toBeGreaterThanOrEqual(132);
  expect(state.need).toBe('play');

  await page.waitForTimeout(1200);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(1, x, y), {
    x: state.dinoX,
    y: state.dinoY,
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoDistance)).toBeGreaterThanOrEqual(109);
});

test('reset button immediately clears all progress', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 8,
    secondEggHatched: true,
  })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondDinoVisible)).toBe(true);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  await page.mouse.click(box.x + (1202 / 1280) * box.width, box.y + (60 / 720) * box.height);

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    mode: 'egg',
    eggTaps: 0,
    hearts: 0,
    heartTarget: 4,
    dinoCount: 0,
    secondEggVisible: false,
    secondDinoVisible: false,
    ballPlaced: false,
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dinoland-progress-v2'))).toBeNull();
});
