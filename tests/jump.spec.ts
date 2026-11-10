import { expect, test } from '@playwright/test';

type WormState = { x: number; y: number; vy: number; onGround: boolean };

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

const activeWorm = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const worm = (window as never as { __WORMAGE__: { engine: { activeWorm: WormState | null } } }).__WORMAGE__
      .engine.activeWorm;
    return worm ? { x: worm.x, y: worm.y, vy: worm.vy, onGround: worm.onGround } : null;
  });

test('the Jump button hops, then flips higher in the air', async ({ page }) => {
  await startMatch(page);
  const start = await activeWorm(page);
  expect(start).not.toBeNull();

  await page.getByTestId('btn-jump').click();
  await expect(page.getByTestId('btn-jump')).toHaveText('Flip');
  await page.waitForFunction(() => {
    const worm = (window as never as { __WORMAGE__: { engine: { activeWorm: WormState | null } } }).__WORMAGE__
      .engine.activeWorm;
    return Boolean(worm && worm.vy > 0);
  });

  const falling = await activeWorm(page);
  await page.getByTestId('btn-jump').click();
  await expect
    .poll(async () => {
      const worm = await activeWorm(page);
      return worm ? worm.y : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(falling!.y - 20);
});

test('holding a direction jumps the worm forward', async ({ page }) => {
  await startMatch(page);
  const start = await activeWorm(page);
  expect(start).not.toBeNull();

  await page.keyboard.down('d');
  await page.getByTestId('btn-jump').click();
  await expect.poll(async () => (await activeWorm(page))!.x).toBeGreaterThan(start!.x + 20);
  await page.keyboard.up('d');
});

test('holding the opposite direction jumps the worm back', async ({ page }) => {
  await startMatch(page);
  const start = await activeWorm(page);
  expect(start).not.toBeNull();

  await page.keyboard.down('a');
  await page.getByTestId('btn-jump').click();
  await expect.poll(async () => (await activeWorm(page))!.x).toBeLessThan(start!.x - 20);
  await page.keyboard.up('a');
});

test('a repeated J keydown does not jump', async ({ page }) => {
  await startMatch(page);
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__: { snapshot: () => { phase: string } } }).__WORMAGE__.snapshot();
    return state.phase === 'aim';
  });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', repeat: true })));

  expect((await activeWorm(page))!.onGround).toBe(true);
});

test('the Jump button stays live during the retreat window', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-fire').click();
  // Poll in the page: a Playwright click waits frames, which can outlast the three-second window.
  await page.waitForFunction(() => {
    const engine = (window as never as { __WORMAGE__: { engine: { retreatActive: boolean } } }).__WORMAGE__
      .engine;
    const button = document.querySelector<HTMLButtonElement>('[data-testid="btn-jump"]');
    return engine.retreatActive && Boolean(button && !button.disabled);
  });
});
