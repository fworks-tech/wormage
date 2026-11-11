import { expect, test, type Page } from '@playwright/test';

type Snapshot = {
  phase: string;
  turn: number;
  turnSeconds: number;
  teams: Array<{ hp: number }>;
};

test.beforeEach(async ({ page }) => {
  // Clear once per tab so a reload can prove persistence.
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('e2e-cleared')) {
      window.sessionStorage.setItem('e2e-cleared', '1');
      window.localStorage.clear();
    }
  });
});

const startMatch = async (page: Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await page.getByTestId('arena').locator('canvas').waitFor();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

const snapshot = (page: Page) =>
  page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot());

test('Settings from the New Game menu persist into the next match', async ({ page }) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();

  await page.getByTestId('input-turn-seconds').fill('30');
  await page.getByTestId('select-wind').selectOption('strong');
  await page.getByTestId('btn-save-settings').click();
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0);

  await page.getByTestId('btn-play').click();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  expect((await snapshot(page)).turnSeconds).toBe(30);

  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('input-turn-seconds')).toHaveValue('30');
  await expect(page.getByTestId('select-wind')).toHaveValue('strong');
});

test('a rebound fire key persists and fires the next match', async ({ page }) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-controls').click();
  await page.getByTestId('binding-fire').click();
  await page.keyboard.press('f');
  await expect(page.getByTestId('binding-fire')).toHaveText('F');
  await page.getByTestId('btn-save-bindings').click();

  await page.getByTestId('btn-play').click();
  await page.getByTestId('arena').locator('canvas').waitFor();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  await page.keyboard.down('f');
  await page.waitForTimeout(120);
  await page.keyboard.up('f');
  await expect.poll(async () => (await snapshot(page)).phase).not.toBe('aim');

  await page.reload();
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('F');
});

test('Restart Match starts a fresh match from the pause card', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn === 2,
    undefined,
    { timeout: 5000 },
  );

  await page.keyboard.press('p');
  await page.getByTestId('btn-restart').click();
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__?: { snapshot: () => Snapshot } }).__WORMAGE__;
    return state ? state.snapshot().turn === 1 : false;
  });

  const after = await snapshot(page);
  expect(after.turn).toBe(1);
  expect(after.teams[0].hp).toBe(300);
  expect(after.teams[1].hp).toBe(300);
});

test('the pause card stays inside a landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await startMatch(page);
  await page.keyboard.press('p');

  const card = await page.locator('.pause-overlay .overlay-card').boundingBox();
  expect(card!.y).toBeGreaterThanOrEqual(20);
  expect(card!.y + card!.height).toBeLessThanOrEqual(392);
  await page.getByTestId('btn-restart').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('btn-restart')).toBeVisible();
});

test('the pause card opens Settings and Controls', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('p');
  await expect(page.getByTestId('btn-resume')).toBeVisible();

  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('btn-close-settings').click();
  await expect(page.getByTestId('btn-resume')).toBeVisible();

  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();
  await page.getByTestId('btn-close-bindings').click();
  await expect(page.getByTestId('btn-resume')).toBeVisible();
});
