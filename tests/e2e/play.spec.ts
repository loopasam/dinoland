import { expect, Page, test } from '@playwright/test';

type GamePoint = { x: number; y: number };
type ItemName = 'apple' | 'ball' | 'water' | 'music' | 'heart';
const INVENTORY_X: Record<ItemName, number> = { apple: 44, ball: 103, water: 162, music: 221, heart: 280 };
const INVENTORY_Y = 675;

async function canvasControls(page: Page) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({
    x: box.x + (x / 1280) * box.width,
    y: box.y + (y / 720) * box.height,
  });
  const drag = async (from: GamePoint, to: GamePoint) => {
    const start = point(from.x, from.y);
    const end = point(to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };
  return { point, drag };
}

async function waitForPhysicsToSettle(page: Page): Promise<void> {
  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__DINOLAND__?.getState());
    return (state?.bouncingDinoCount ?? 0) + (state?.movingObjectCount ?? 0);
  }, { timeout: 20_000 }).toBe(0);
}

async function launchItem(
  page: Page,
  point: (x: number, y: number) => GamePoint,
  drag: (from: GamePoint, to: GamePoint) => Promise<void>,
  item: ItemName,
  target: GamePoint,
  requestedPower = 0.3,
): Promise<void> {
  const inventory = point(INVENTORY_X[item], INVENTORY_Y);
  await page.mouse.click(inventory.x, inventory.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe(item);

  const state = await page.evaluate(() => window.__DINOLAND__!.getState());
  await drag({
    x: 640 + Math.cos(state.cannonAngle) * 45,
    y: 348 + Math.sin(state.cannonAngle) * 45,
  }, target);

  const fire = point(700, 675);
  await page.mouse.move(fire.x, fire.y);
  await page.mouse.down();
  await page.waitForTimeout(Math.max(220, Math.min(1, requestedPower) * 1700));
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBeNull();
  await expect.poll(
    () => page.evaluate(() => window.__DINOLAND__?.getState().cannonShotActive),
    { timeout: 10_000 },
  ).toBe(false);
}

async function loadField(page: Page, hearts = 0): Promise<void> {
  await page.evaluate(({ savedHearts }) => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    scoringVersion: 2,
    hatched: true,
    hearts: savedHearts,
    heartTarget: 4,
    dinoCount: 1,
    dinoCareCounts: [0],
    dinoSpecies: ['triceratops'],
    unlockedSlots: 2,
    lootClaimed: false,
    cannonBoostReady: false,
  })), { savedHearts: hearts });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('field');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dinoland/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('egg');
});

test('keeps the field quiet between effects and mute controls all audio', async ({ page }) => {
  const { point } = await canvasControls(page);
  const meadow = point(900, 180);
  await page.mouse.click(meadow.x, meadow.y);
  expect(await page.evaluate(() => window.__DINOLAND__!.getState().soundMuted)).toBe(false);

  const mute = point(1170, 35);
  await page.mouse.click(mute.x, mute.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    soundMuted: true,
  });

  await page.mouse.click(mute.x, mute.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    soundMuted: false,
  });
});

test('hatches into an immediate hunger need with both permanent inventory tools', async ({ page }) => {
  const { point } = await canvasControls(page);
  for (let tap = 1; tap <= 4; tap += 1) {
    const state = await page.evaluate(() => window.__DINOLAND__!.getState());
    const egg = point(state.eggX, state.eggY);
    await page.mouse.click(egg.x, egg.y);
    await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggTaps)).toBe(tap);
    if (tap < 4) await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggBusy)).toBe(false);
  }

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    mode: 'field',
    dinoCount: 1,
    riggedDinoCount: 1,
    need: 'hunger',
    firstBubbleVisible: true,
    firstBubbleItem: 'apple',
    heartTextures: ['score-heart-empty', 'score-heart-empty', 'score-heart-empty', 'score-heart-empty'],
    fieldItemCount: 0,
  });
  const hatchedType = (await page.evaluate(() => window.__DINOLAND__!.getState())).dinoTypes[0];
  expect(['triceratops', 'trex', 'brachiosaurus']).toContain(hatchedType);
  const apple = point(INVENTORY_X.apple, INVENTORY_Y);
  await page.mouse.click(apple.x, apple.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe('apple');
  const ball = point(INVENTORY_X.ball, INVENTORY_Y);
  await page.mouse.click(ball.x, ball.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe('ball');
  expect(await page.evaluate(() => window.__DINOLAND__!.getState().fireControlSymbol)).toBe('➤');
});

test('turns and charges the flower launcher with arrow keys and Space', async ({ page }) => {
  await loadField(page);
  const { point } = await canvasControls(page);
  const apple = point(INVENTORY_X.apple, INVENTORY_Y);
  await page.mouse.click(apple.x, apple.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe('apple');

  const initialAngle = await page.evaluate(() => window.__DINOLAND__!.getState().cannonAngle);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(360);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => {
    const angle = await page.evaluate(() => window.__DINOLAND__!.getState().cannonAngle);
    return Math.abs(angle - initialAngle);
  }).toBeGreaterThan(0.35);

  await page.keyboard.down('Space');
  await page.waitForTimeout(520);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonPower)).toBeGreaterThan(0.2);
  await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBeNull();
  expect(await page.evaluate(() => window.__DINOLAND__!.getState().lastCannonPower)).toBeGreaterThan(0.2);
});

test('migrates old scoring and keeps needs cycling after one heart', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    hatched: true,
    hearts: 8,
    heartTarget: 9,
    dinoCount: 3,
    dinoCareCounts: [2, 1, 0],
    dinoSpecies: ['triceratops', 'trex', 'brachiosaurus'],
    unlockedSlots: 4,
    lootClaimed: false,
    cannonBoostReady: false,
  })));
  await page.reload();

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 0,
    heartTarget: 4,
    newEggUnlocked: false,
    need: 'hunger',
    firstBubbleVisible: true,
  });

  await page.evaluate(() => window.__DINOLAND__?.fulfillActiveNeed(0));
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 1,
    heartTarget: 4,
    newEggUnlocked: false,
    heartTextures: ['score-heart', 'score-heart-empty', 'score-heart-empty', 'score-heart-empty'],
  });
  await expect.poll(
    () => page.evaluate(() => window.__DINOLAND__?.getState()),
    { timeout: 4000 },
  ).toMatchObject({ need: 'play', firstBubbleVisible: true, firstBubbleItem: 'ball' });
});

test('allows unlimited copies and recalls landed items without changing inventory', async ({ page }) => {
  test.setTimeout(60_000);
  await loadField(page);
  await page.evaluate(() => window.__DINOLAND__?.pauseDino(0));
  const { point, drag } = await canvasControls(page);

  await launchItem(page, point, drag, 'apple', { x: 230, y: 180 }, 0.12);
  await launchItem(page, point, drag, 'apple', { x: 1080, y: 500 }, 0.18);
  await launchItem(page, point, drag, 'ball', { x: 900, y: 180 }, 0.14);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().fieldItemCount)).toBe(3);

  let state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.fieldItems.map((item) => item.type).sort()).toEqual(['apple', 'apple', 'ball']);
  const recalled = point(state.fieldItems[0].x, state.fieldItems[0].y);
  await page.mouse.click(recalled.x, recalled.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().fieldItemCount)).toBe(2);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('field');
  state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.fieldItemCount).toBe(0);
  const apple = point(INVENTORY_X.apple, INVENTORY_Y);
  await page.mouse.click(apple.x, apple.y);
  expect(await page.evaluate(() => window.__DINOLAND__!.getState().cannonLoaded)).toBe('apple');
});

test('only the matching item fulfills hunger and play', async ({ page }) => {
  await loadField(page);
  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.pauseDino(0);
    game?.forceNeed(0, 'hunger');
    game?.placeCareItem('hunger', 520, 250);
    game?.placeDino(0, 520, 250);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 1,
    need: null,
    fieldItemCount: 0,
  });

  await page.waitForTimeout(450);
  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.forceNeed(0, 'play');
    game?.placeCareItem('hunger', 520, 250);
    game?.placeDino(0, 520, 250);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().movingObjectCount)).toBeGreaterThan(0);
  await waitForPhysicsToSettle(page);
  expect(await page.evaluate(() => window.__DINOLAND__!.getState())).toMatchObject({
    hearts: 1,
    need: 'play',
    fieldItemCount: 1,
  });

  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.placeCareItem('play', 620, 250);
    game?.placeDino(0, 620, 250);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    hearts: 2,
    need: null,
    lootVisible: true,
  });
});

test('a dino is attracted only to the item matching its need', async ({ page }) => {
  await loadField(page);
  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.pauseDino(0);
    game?.placeDino(0, 280, 250);
    game?.forceNeed(0, 'play');
    game?.placeCareItem('hunger', 280, 450);
    game?.placeCareItem('play', 540, 250);
    game?.resumeDino(0);
  });
  await expect.poll(
    () => page.evaluate(() => window.__DINOLAND__?.getState()),
    { timeout: 5000 },
  ).toMatchObject({ hearts: 1, need: null, fieldItemCount: 1 });
  expect((await page.evaluate(() => window.__DINOLAND__!.getState())).fieldItems[0].type).toBe('apple');
});

test('cycles three dino species and personalities while preserving individual growth', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('dinoland-progress-v2', JSON.stringify({
    scoringVersion: 2,
    hatched: true,
    hearts: 0,
    dinoCount: 3,
    dinoCareCounts: [0, 4, 20],
    dinoSpecies: ['triceratops', 'trex', 'brachiosaurus'],
    unlockedSlots: 5,
    lootClaimed: false,
    cannonBoostReady: false,
  })));
  await page.reload();

  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    dinoTypes: ['triceratops', 'trex', 'brachiosaurus'],
    dinoPersonalities: ['eager', 'steady', 'sleepy'],
    riggedDinoCount: 3,
    dinoCareCounts: [0, 4, 20],
    dinoScales: [0.42, 0.58, 0.78],
  });

  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.pauseDino(0);
    game?.forceNeed(0, 'hunger');
    game?.fulfillActiveNeed(0);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    dinoCareCounts: [1, 4, 20],
    dinoScales: [0.46, 0.58, 0.78],
  });
});

test('loot drops halfway and grants exactly one boosted shot', async ({ page }) => {
  test.setTimeout(60_000);
  await loadField(page);
  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.pauseDino(0);
    game?.forceNeed(0, 'hunger');
    game?.fulfillActiveNeed(0);
    game?.forceNeed(0, 'play');
    game?.fulfillActiveNeed(0);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().lootVisible)).toBe(true);

  const { point, drag } = await canvasControls(page);
  const loot = await page.evaluate(() => {
    const state = window.__DINOLAND__!.getState();
    return { x: state.lootX, y: state.lootY };
  });
  const lootPoint = point(loot.x, loot.y);
  await page.mouse.click(lootPoint.x, lootPoint.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    lootVisible: false,
    cannonBoostReady: true,
    magicSlotSymbol: '✦',
    lootCelebrationVisible: true,
    unlockedSlots: 3,
  });

  await page.waitForTimeout(1600);
  const water = point(INVENTORY_X.water, INVENTORY_Y);
  await page.mouse.click(water.x, water.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonLoaded)).toBe('water');

  await launchItem(page, point, drag, 'ball', { x: 1040, y: 250 }, 0.25);
  const state = await page.evaluate(() => window.__DINOLAND__!.getState());
  expect(state.cannonBoostReady).toBe(false);
  expect(state.lastCannonSpeed).toBeGreaterThan(400);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('dinoland-progress-v2') ?? '{}')).cannonBoostReady).toBe(false);
});

test('keeps billiards physics and reset clears progression without limiting inventory', async ({ page }) => {
  test.setTimeout(90_000);
  await loadField(page);
  await page.evaluate(() => {
    const game = window.__DINOLAND__;
    game?.pauseDino(0);
    game?.placeDino(0, 420, 348);
    game?.launchDino(0, 420, 0);
  });
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().cannonDinoCollisions)).toBeGreaterThan(0);
  await waitForPhysicsToSettle(page);

  const { point } = await canvasControls(page);
  const reset = point(1228, 35);
  await page.mouse.click(reset.x, reset.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState())).toMatchObject({
    mode: 'egg',
    hearts: 0,
    dinoCount: 0,
    fieldItemCount: 0,
    cannonBoostReady: false,
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dinoland-progress-v2'))).toBeNull();
});
