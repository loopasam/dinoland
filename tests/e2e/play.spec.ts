import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dinoland/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('egg');
});

test('hatches, plays with the ball, and enters the bath', async ({ page }) => {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas not found');
  const point = (x: number, y: number) => ({ x: box.x + (x / 1280) * box.width, y: box.y + (y / 720) * box.height });

  for (let i = 0; i < 4; i += 1) {
    const egg = point(640, 445);
    await page.mouse.click(egg.x, egg.y);
    await page.waitForTimeout(i === 3 ? 1300 : 750);
    await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().eggTaps)).toBe(i + 1);
  }
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('free-play');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dinoland-progress-v1') ?? '{}').hatched)).toBe(true);

  const start = point(210, 558);
  const end = point(580, 480);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();

  const bath = point(1060, 520);
  await page.mouse.click(bath.x, bath.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('bath');

  const bubble = point(470, 470);
  await page.mouse.click(bubble.x, bubble.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().poppedBubbles)).toBe(1);

  const back = point(84, 80);
  await page.mouse.click(back.x, back.y);
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().mode)).toBe('free-play');
});
