import { expect, Page, test } from '@playwright/test';

type GamePoint = { x: number; y: number };

async function waitForPhysicsToSettle(page: Page): Promise<void> {
  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__DINOLAND__?.getState());
    return (state?.bouncingDinoCount ?? 0) + (state?.movingObjectCount ?? 0);
  }, { timeout: 20_000 }).toBe(0);
}

async function launchFromCannon(
  page: Page,
  point: (x: number, y: number) => GamePoint,
  drag: (from: GamePoint, to: GamePoint) => Promise<void>,
  itemHome: GamePoint,
  target: GamePoint,
  kind: 'ball' | 'drink' | 'food-a' | 'food-b' | 'speaker',
  requestedPower?: number,
): Promise<number> {
  const alreadyLoaded = await page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded);
  if (alreadyLoaded !== kind) {
    const inventoryItem = point(itemHome.x, itemHome.y);
    await page.mouse.click(inventoryItem.x, inventoryItem.y);
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe(kind);

  const state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const barrelStart = {
    x: 640 + Math.cos(state.cannonAngle) * 45,
    y: 348 + Math.sin(state.cannonAngle) * 45,
  };
  await drag(barrelStart, target);

  const angle = Math.atan2(target.y - 348, target.x - 640);
  const muzzle = { x: 640 + Math.cos(angle) * 96, y: 348 + Math.sin(angle) * 96 };
  const desiredDistance = Math.hypot(target.x - muzzle.x, target.y - muzzle.y);
  let selectedPower = 0.12;
  let smallestError = Infinity;
  for (let step = 12; step <= 100; step += 1) {
    const candidate = step / 100;
    const distance = (140 + candidate * 760) * (0.5 + candidate * 0.4);
    const error = Math.abs(distance - desiredDistance);
    if (error < smallestError) {
      smallestError = error;
      selectedPower = candidate;
    }
  }
  if (requestedPower !== undefined) selectedPower = Math.max(0.12, Math.min(1, requestedPower));

  const fire = point(720, 650);
  await page.mouse.move(fire.x, fire.y);
  await page.mouse.down();
  await page.waitForTimeout(Math.max(220, selectedPower * 1700));
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBeNull();
  const firedPower = await page.evaluate(() => window.__DINOLAND__!.getState().lastCannonPower);
  expect(firedPower).toBeGreaterThan(0.1);
  await expect.poll(
    () => page.evaluate(() => window.__DINOLAND__?.getState().cannonShotActive),
    { timeout: 10_000 },
  ).toBe(false);
  return firedPower;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dinoland/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('egg');
});

test('hatches, uses the cannon, locks landed items, fulfills needs, and keeps the dinosaur tap-only', async ({ page }) => {
  test.setTimeout(120_000);
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
  expect(state.need).toBe('thirst');
  expect(state.firstBubbleVisible).toBe(true);
  expect(state.firstBubbleAlpha).toBe(1);
  expect(Math.abs(state.firstBubbleX - state.dinoX)).toBeLessThanOrEqual(1);
  expect(state.firstBubbleY).toBeLessThan(state.dinoY);

  await page.evaluate(() => window.__DINOLAND__?.pauseDino(0));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await launchFromCannon(page, point, drag, { x: 170, y: 650 }, { x: state.dinoX, y: state.dinoY }, 'drink');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.need).toBe('thirst');
  expect(state.lastShotHitDino).toBe(true);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.drinkPlaced).toBe(true);
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), { x: state.drinkX, y: state.drinkY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().drinkPlaced)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().need), { timeout: 7000 }).toBe('play');

  await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: 1000, y: 500 }, 'ball');
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const lockedBall = { x: state.ballX, y: state.ballY };
  await drag(lockedBall, { x: 780, y: 280 });
  await page.waitForTimeout(600);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect({ x: state.ballX, y: state.ballY }).toEqual(lockedBall);
  expect(state.ballPlaced).toBe(true);
  const recalledBall = point(state.ballX, state.ballY);
  await page.mouse.click(recalledBall.x, recalledBall.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);

  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: state.dinoX, y: state.dinoY }, 'ball');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(1);
  expect(state.lastShotHitDino).toBe(true);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), { x: state.ballX, y: state.ballY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dinoland-progress-v2') ?? '{}').hearts)).toBe(2);

  await page.waitForTimeout(700);
  await page.evaluate(() => window.__DINOLAND__?.pauseDino(0));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const restingPosition = { x: state.dinoX, y: state.dinoY };
  await drag({ x: state.dinoX, y: state.dinoY }, { x: 80, y: 80 });
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.dinoX).toBe(restingPosition.x);
  expect(state.dinoY).toBe(restingPosition.y);
  expect(await page.evaluate(() => {
    const game = window.__DINOLAND__;
    return game?.getState().need ?? game?.forceNeed(0, 'affection');
  })).not.toBeNull();
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.firstBubbleVisible).toBe(true);
  expect(state.firstBubbleX).toBe(state.dinoX);
  expect(state.firstBubbleY).toBe(state.dinoY - 73);
});

test('reveals eggs with escalating targets and resumes care after each hatch', async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({ hatched: true, hearts: 4, secondEggHatched: false })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().newEggUnlocked)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggVisible)).toBe(true);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const drag = async (from: GamePoint, to: GamePoint) => {
    const dragStart = point(from.x, from.y);
    const dragEnd = point(to.x, to.y);
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 });
    await page.mouse.up();
  };
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
    heartTarget: 6,
    dinoCount: 2,
    secondNeed: 'play',
    secondBubbleVisible: true,
    secondBubbleAlpha: 1,
  });
  await page.evaluate(() => window.__DINOLAND__?.pauseDino(1));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(Math.abs(state.secondBubbleX - state.secondDinoX)).toBeLessThanOrEqual(1);
  expect(state.secondBubbleY).toBeLessThan(state.secondDinoY);

  await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: state.secondDinoX, y: state.secondDinoY }, 'ball');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.lastShotHitDino).toBe(true);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(1, x, y), { x: state.ballX, y: state.ballY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 1,
    secondNeed: null,
    secondBubbleVisible: false,
    ballPlaced: false,
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondNeed), { timeout: 7000 }).toBe('hunger');
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    secondBubbleVisible: true,
    secondBubbleAlpha: 1,
  });

  for (const dinoIndex of [1, 0, 1, 0, 1]) {
    const completed = await page.evaluate((index) => {
      const game = window.__DINOLAND__;
      if (!game) return false;
      if (!game.getState().needs[index]) game.forceNeed(index, index % 2 === 0 ? 'thirst' : 'play');
      return game.fulfillActiveNeed(index);
    }, dinoIndex);
    expect(completed).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 6,
    heartTarget: 6,
    dinoCount: 2,
    secondEggVisible: true,
    secondEggBusy: false,
    scoreText: 'OPEN YOUR EGG!',
  });
  expect(await page.evaluate(() => window.__DINOLAND__?.forceNeed(0, 'play'))).toBeNull();
  expect(await page.evaluate(() => window.__DINOLAND__?.getState().needs)).toEqual([null, null]);
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
    heartTarget: 9,
    dinoCount: 3,
    secondEggVisible: false,
    scoreText: '0  /  9',
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().needs[2])).not.toBeNull();
});

test('keeps item ownership, dinosaurs, and draggable egg collisions independent', async ({ page }) => {
  test.setTimeout(90_000);
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 0,
    heartTarget: 6,
    dinoCount: 2,
  })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoCount)).toBe(2);
  await page.evaluate(() => {
    window.__DINOLAND__?.forceNeed(0, 'play');
    window.__DINOLAND__?.forceNeed(1, 'thirst');
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
  await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: state.secondDinoX, y: state.secondDinoY }, 'ball');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.need).toBe('play');
  expect(state.secondNeed).toBe('thirst');
  expect(state.lastShotHitDino).toBe(true);
  expect(state.ballPlaced).toBe(true);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.mouse.click(point(state.ballX, state.ballY).x, point(state.ballX, state.ballY).y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);

  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await launchFromCannon(page, point, drag, { x: 170, y: 650 }, { x: state.secondDinoX, y: state.secondDinoY }, 'drink');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.lastShotHitDino).toBe(true);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(1, x, y), { x: state.drinkX, y: state.drinkY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().drinkPlaced)).toBe(false);

  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.need).toBe('play');

  for (const dinoIndex of [0, 1, 0, 1, 0]) {
    expect(await page.evaluate((index) => {
      const game = window.__DINOLAND__;
      if (!game) return false;
      if (!game.getState().needs[index]) game.forceNeed(index, index === 0 ? 'play' : 'thirst');
      return game.fulfillActiveNeed(index);
    }, dinoIndex)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().secondEggVisible)).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), {
    x: state.secondEggX,
    y: state.secondEggY,
  })).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.firstRewardEggDistance).toBeGreaterThanOrEqual(75);

  await page.waitForTimeout(1200);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(1, x, y), {
    x: state.dinoX,
    y: state.dinoY,
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoDistance)).toBeGreaterThanOrEqual(79);
});

test('supports either food, affection taps, and persistent music proximity', async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 0,
    heartTarget: 4,
    dinoCount: 1,
  })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoCount)).toBe(1);
  await page.evaluate(() => {
    window.__DINOLAND__?.pauseDino(0);
    window.__DINOLAND__?.forceNeed(0, 'hunger');
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
  await launchFromCannon(page, point, drag, { x: 254, y: 650 }, { x: state.dinoX, y: state.dinoY }, 'food-a');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), { x: state.foodAX, y: state.foodAY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().foodAPlaced)).toBe(false);

  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__DINOLAND__?.forceNeed(0, 'hunger'))).toBe('hunger');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await launchFromCannon(page, point, drag, { x: 338, y: 650 }, { x: state.dinoX, y: state.dinoY }, 'food-b');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(1);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), { x: state.foodBX, y: state.foodBY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().foodBPlaced)).toBe(false);

  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__DINOLAND__?.forceNeed(0, 'affection'))).toBe('affection');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const dino = point(state.dinoX, state.dinoY);
  await page.mouse.click(dino.x, dino.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(3);

  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__DINOLAND__?.forceNeed(0, 'music'))).toBe('music');
  await page.evaluate(() => window.__DINOLAND__?.placeDino(0, 180, 170));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await launchFromCannon(page, point, drag, { x: 422, y: 650 }, { x: 1050, y: 500 }, 'speaker');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(3);
  await waitForPhysicsToSettle(page);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await page.evaluate(({ x, y }) => window.__DINOLAND__?.placeDino(0, x, y), { x: state.speakerX + 80, y: state.speakerY });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().hearts)).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().speakerPlaced)).toBe(true);
});

test('uses cannon charge for distance and knocks dinosaurs and landed items around', async ({ page }) => {
  test.setTimeout(120_000);
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 0,
    heartTarget: 4,
    dinoCount: 1,
  })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().dinoCount)).toBe(1);
  await page.evaluate(() => {
    window.__DINOLAND__?.pauseDino(0);
    window.__DINOLAND__?.placeDino(0, 1100, 300);
  });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });
  const drag = async (from: GamePoint, to: GamePoint) => {
    const start = point(from.x, from.y);
    const end = point(to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };

  const inventoryBall = point(86, 650);
  await page.mouse.click(inventoryBall.x, inventoryBall.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe('ball');
  for (const target of [{ x: 1080, y: 120 }, { x: 1080, y: 575 }]) {
    let guideState = await page.evaluate(() => window.__DINOLAND__!.getState());
    await drag({
      x: 640 + Math.cos(guideState.cannonAngle) * 45,
      y: 348 + Math.sin(guideState.cannonAngle) * 45,
    }, target);
    guideState = await page.evaluate(() => window.__DINOLAND__!.getState());
    const muzzle = {
      x: 640 + Math.cos(guideState.cannonAngle) * 96,
      y: 348 + Math.sin(guideState.cannonAngle) * 96,
    };
    const guideVector = {
      x: guideState.cannonGuideEndX - muzzle.x,
      y: guideState.cannonGuideEndY - muzzle.y,
    };
    const cross = Math.abs(guideVector.x * Math.sin(guideState.cannonAngle)
      - guideVector.y * Math.cos(guideState.cannonAngle));
    expect(cross).toBeLessThan(1.5);
  }
  const lowCharge = await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: 180, y: 348 }, 'ball', 0.12);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(true);
  let state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const lowLaunchSpeed = state.lastCannonSpeed;
  await page.mouse.click(point(state.ballX, state.ballY).x, point(state.ballX, state.ballY).y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);

  const highCharge = await launchFromCannon(page, point, drag, { x: 86, y: 650 }, { x: 180, y: 348 }, 'ball', 0.78);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const highLaunchSpeed = state.lastCannonSpeed;
  expect(highCharge).toBeGreaterThan(lowCharge + 0.5);
  expect(highLaunchSpeed).toBeGreaterThan(lowLaunchSpeed + 350);
  expect(state.lastShotWallBounces).toBeGreaterThan(0);
  await page.mouse.click(point(state.ballX, state.ballY).x, point(state.ballX, state.ballY).y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().ballPlaced)).toBe(false);

  await launchFromCannon(page, point, drag, { x: 422, y: 650 }, { x: 900, y: 300 }, 'speaker');
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().speakerPlaced)).toBe(true);
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const speakerBefore = { x: state.speakerX, y: state.speakerY };
  await launchFromCannon(page, point, drag, { x: 86, y: 650 }, speakerBefore, 'ball');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(Math.hypot(state.speakerX - speakerBefore.x, state.speakerY - speakerBefore.y)).toBeGreaterThan(20);

  await page.evaluate(() => window.__DINOLAND__?.placeDino(0, 800, 300));
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  const dinoBefore = { x: state.dinoX, y: state.dinoY };
  await launchFromCannon(page, point, drag, { x: 254, y: 650 }, dinoBefore, 'food-a');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.hearts).toBe(0);
  expect(state.lastShotHitDino).toBe(true);
  expect(state.lastDinoImpactSpeed).toBeGreaterThan(100);
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
    drinkPlaced: false,
    foodAPlaced: false,
    foodBPlaced: false,
    speakerPlaced: false,
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dinoland-progress-v2'))).toBeNull();
});
