import { expect, test } from '@playwright/test';

test('presents a polished cover before entering Dinoland', async ({ page }) => {
  await page.goto('/dinoland/');

  const startScreen = page.locator('#start-screen');
  const cover = page.locator('.start-cover');
  const play = page.getByRole('button', { name: 'Play Dinoland' });

  await expect(startScreen).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dinoland' })).toBeVisible();
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(1000);
  await expect(play).toBeEnabled();

  await play.click();
  await expect(startScreen).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__DINOLAND__?.getState().soundtrackPlaying)).toBe(true);
});
