import { expect, test, type Page } from '@playwright/test';

type Snapshot = {
  phase: string;
  turn: number;
  turnSeconds: number;
  aimAngle: number;
  charging: boolean;
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

const openControls = async (page: Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();
};

const snapshot = (page: Page) =>
  page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot());

const activeX = (page: Page) =>
  page.evaluate(
    () =>
      (window as never as { __WORMAGE__: { engine: { activeWorm: { x: number } | null } } }).__WORMAGE__.engine
        .activeWorm?.x ?? null,
  );

const focusedText = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '');

// Escape leaves fullscreen first, so panel-close checks need a windowed match.
const exitFullscreen = (page: Page) =>
  page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : Promise.resolve()));

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

test('difficulty and sound persist across a reload', async ({ page }) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('select-difficulty').selectOption('elite');
  await page.getByTestId('toggle-sound').uncheck();
  await page.getByTestId('btn-save-settings').click();

  await page.reload();
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('select-difficulty')).toHaveValue('elite');
  await expect(page.getByTestId('toggle-sound')).not.toBeChecked();
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
  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
  );
  await page.keyboard.up('f');
  await expect.poll(async () => (await snapshot(page)).phase).not.toBe('aim');

  await page.reload();
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('F');
});

test('a lone modifier is rejected while capturing a binding', async ({ page }) => {
  await openControls(page);
  await page.getByTestId('binding-fire').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('Press a key…');

  await page.keyboard.press('Control');
  await expect(page.getByRole('status')).toHaveText(/modifier/i);
  await expect(page.getByTestId('binding-fire')).toHaveText('Press a key…');

  await page.keyboard.press('f');
  await expect(page.getByTestId('binding-fire')).toHaveText('F');
  await page.getByTestId('btn-save-bindings').click();

  await page.reload();
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('F');
});

test('Reset restores the defaults and saves them', async ({ page }) => {
  await openControls(page);
  await page.getByTestId('binding-fire').click();
  await page.keyboard.press('f');
  await expect(page.getByTestId('binding-fire')).toHaveText('F');

  await page.getByTestId('btn-reset-bindings').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('Space');
  await page.getByTestId('btn-save-bindings').click();

  await page.reload();
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('Space');
});

test('binding a duplicate key swaps the two actions', async ({ page }) => {
  await openControls(page);
  await page.getByTestId('binding-fire').click();
  await page.keyboard.press('j');
  await expect(page.getByTestId('binding-fire')).toHaveText('J');
  await expect(page.getByTestId('binding-jump')).toHaveText('Space');
  await page.getByTestId('btn-save-bindings').click();

  await page.reload();
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('J');
  await expect(page.getByTestId('binding-jump')).toHaveText('Space');
  await page.getByTestId('btn-close-bindings').click();

  await page.getByTestId('btn-play').click();
  await page.getByTestId('arena').locator('canvas').waitFor();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  await page.keyboard.down('j');
  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
  );
  await page.keyboard.up('j');
  await expect.poll(async () => (await snapshot(page)).phase).not.toBe('aim');
});

test('Escape cancels capture without changing the binding', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('p');
  await page.getByTestId('btn-controls').click();
  await page.getByTestId('binding-fire').click();
  await expect(page.getByTestId('binding-fire')).toHaveText('Press a key…');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('binding-fire')).toHaveText('Space');
  await expect(page.getByTestId('controls-dialog')).toBeVisible();
  await expect(page.getByTestId('btn-resume')).toHaveCount(0);

  await page.getByTestId('btn-close-bindings').click();
  await expect(page.getByTestId('btn-resume')).toBeVisible();
});

test('arrow keys keep moving and aiming after the movement keys are rebound', async ({ page }) => {
  await openControls(page);
  await page.getByTestId('binding-left').click();
  await page.keyboard.press('k');
  await expect(page.getByTestId('binding-left')).toHaveText('K');
  await page.getByTestId('btn-save-bindings').click();

  await startMatch(page);
  const start = (await activeX(page))!;
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await activeX(page))! - start).toBeGreaterThan(20);
  await page.keyboard.up('ArrowRight');

  const right = (await activeX(page))!;
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => right - (await activeX(page))!).toBeGreaterThan(20);
  await page.keyboard.up('ArrowLeft');

  const moved = (await activeX(page))!;
  await page.keyboard.down('k');
  await expect.poll(async () => (await activeX(page))! - moved).toBeLessThan(-20);
  await page.keyboard.up('k');

  const angle = (await snapshot(page)).aimAngle;
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).aimAngle).toBeGreaterThan(angle);
  await page.keyboard.up('ArrowUp');
});

test('settings saved while paused apply to the next match only', async ({ page }) => {
  await startMatch(page);
  expect((await snapshot(page)).turnSeconds).toBe(45);

  await page.keyboard.press('p');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('input-turn-seconds').fill('30');
  await page.getByTestId('btn-save-settings').click();
  await expect(page.getByTestId('btn-restart')).toBeVisible();
  expect((await snapshot(page)).turnSeconds).toBe(45);

  await page.getByTestId('btn-restart').click();
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__?: { snapshot: () => Snapshot } }).__WORMAGE__;
    return state ? state.snapshot().turn === 1 && state.snapshot().turnSeconds === 30 : false;
  });
  expect((await snapshot(page)).turnSeconds).toBe(30);
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

test('Escape closes Settings back to the pause card without resuming', async ({ page }) => {
  await startMatch(page);
  await exitFullscreen(page);
  await page.keyboard.press('p');
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0);
  await expect(page.getByTestId('btn-resume')).toBeVisible();

  // A second Escape belongs to the pause card and resumes the match.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('btn-resume')).toHaveCount(0);
});

test('Escape closes Controls back to the pause card without resuming', async ({ page }) => {
  await startMatch(page);
  await exitFullscreen(page);
  await page.keyboard.press('p');
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('controls-dialog')).toHaveCount(0);
  await expect(page.getByTestId('btn-resume')).toBeVisible();
});

test('the pause key closes a panel instead of resuming the match', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('p');
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();

  await page.keyboard.press('p');
  await expect(page.getByTestId('controls-dialog')).toHaveCount(0);
  await expect(page.getByTestId('btn-resume')).toBeVisible();
});

test('clicking the backdrop closes an open panel and keeps the match paused', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('p');
  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();

  await page.locator('.pause-overlay').click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId('controls-dialog')).toHaveCount(0);
  await expect(page.getByTestId('btn-resume')).toBeVisible();
});

test('focus enters the pause card and Tab wraps inside the dialog', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.press('p');
  await expect.poll(() => focusedText(page)).toBe('Resume');

  // Shift+Tab from the first control lands on the last one, not the page.
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => focusedText(page)).toBe('Quit to Menu');

  await page.getByTestId('btn-settings').click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="settings-dialog"]'))))
    .toBe(true);
});

test('Escape closes a panel on the New Game card', async ({ page }) => {
  await page.goto('/demo?seed=4242');
  await expect.poll(() => focusedText(page)).toBe('Start Game');

  await page.getByTestId('btn-controls').click();
  await expect(page.getByTestId('controls-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('controls-dialog')).toHaveCount(0);
  await expect(page.getByTestId('btn-play')).toBeVisible();
});
