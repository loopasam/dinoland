import { expect, test } from '@playwright/test';

test('the Triceratops lab keeps animation controls separate from the game', async ({ page }) => {
  await page.goto('/dinoland/lab/');

  await expect(page.getByRole('heading', { name: 'Baby Triceratops' })).toBeVisible();
  await expect(page.locator('#dino-stage .layer')).toHaveCount(6);
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'idle');

  await page.getByRole('button', { name: '02 Walk' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'walk');
  await expect(page.getByText('WALK · OFFSET HEAD, BODY BOUNCE, FOUR FEET')).toBeVisible();

  await page.getByRole('button', { name: 'Show layers' }).click();
  await expect(page.getByRole('button', { name: 'Hide layers' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stage')).toHaveClass(/show-layers/);

  await page.getByLabel('GAME SCALE').fill('78');
  await expect(page.locator('#growth-value')).toHaveText('78%');
  await expect(page.locator('#rig-scale')).toHaveAttribute('transform', 'scale(0.78)');

  await page.getByRole('button', { name: '← Left' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-facing', 'left');
});

test('the T-Rex lab exposes its complete layered animation stack', async ({ page }) => {
  await page.goto('/dinoland/lab/trex/');

  await expect(page.getByRole('heading', { name: 'Baby T-Rex' })).toBeVisible();
  await expect(page.locator('#dino-stage .layer')).toHaveCount(7);
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'idle');

  await page.getByRole('button', { name: '02 Walk' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'walk');
  await expect(page.getByText('WALK · OFFSET HEAD, BODY BOUNCE, FOUR FEET')).toBeVisible();

  await page.getByRole('button', { name: '04 Eat' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'eat');

  await page.getByRole('button', { name: 'Show layers' }).click();
  await expect(page.getByRole('button', { name: 'Hide layers' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('GAME SCALE').fill('78');
  await expect(page.locator('#rig-scale')).toHaveAttribute('transform', 'scale(0.78)');

  await page.getByRole('button', { name: '← Left' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-facing', 'left');
});

test('the Brachiosaurus lab animates its long-necked seven-layer rig', async ({ page }) => {
  await page.goto('/dinoland/lab/brachiosaurus/');

  await expect(page.getByRole('heading', { name: 'Baby Brachiosaurus' })).toBeVisible();
  await expect(page.locator('#dino-stage .layer')).toHaveCount(7);
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'idle');

  await page.getByRole('button', { name: '02 Walk' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'walk');

  await page.getByRole('button', { name: '03 Happy' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-motion', 'happy');

  await page.getByRole('button', { name: 'Show layers' }).click();
  await expect(page.getByRole('button', { name: 'Hide layers' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('GAME SCALE').fill('42');
  await expect(page.locator('#rig-scale')).toHaveAttribute('transform', 'scale(0.42)');

  await page.getByRole('button', { name: '← Left' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-facing', 'left');
});
