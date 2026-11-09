import { expect, test } from '@playwright/test';

/**
 * Menu, options and persistence.
 * Every test starts from a clean storage state so results never leak between runs.
 */
test.beforeEach(async ({ page }) => {
  // Clear once per tab, not on every reload: persistence is under test.
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('e2e-cleared')) {
      window.sessionStorage.setItem('e2e-cleared', '1');
      window.localStorage.clear();
    }
  });
});

test('menu renders the briefing and both boards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1.wordmark')).toContainText('WORM');
  await expect(page.getByTestId('btn-play')).toBeVisible();

  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard')).toBeVisible();
  await expect(page.getByTestId('leaderboard').locator('tbody tr').first()).toBeVisible();

  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});

test('options persist after reload and clamp the timer', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-options').click();

  await page.getByTestId('select-wind').selectOption('strong');
  await page.getByTestId('select-difficulty').selectOption('rookie');
  await page.getByTestId('input-turn-seconds').fill('60');
  await page.getByTestId('btn-save-options').click();

  await page.reload();
  await page.getByTestId('tab-options').click();
  await expect(page.getByTestId('select-wind')).toHaveValue('strong');
  await expect(page.getByTestId('select-difficulty')).toHaveValue('rookie');
  await expect(page.getByTestId('input-turn-seconds')).toHaveValue('60');

  // The board is scoped to the active ruleset.
  await page.getByTestId('tab-ranking').click();
  await expect(page.locator('.table-meta')).toContainText('60s');
});

test('empty and failing archive scenarios render recoverable states', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-options').click();
  await page.getByTestId('select-scenario').selectOption('empty');
  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard-empty')).toBeVisible();

  await page.getByTestId('tab-options').click();
  await page.getByTestId('select-scenario').selectOption('error');
  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard-error')).toBeVisible();

  await page.getByTestId('tab-options').click();
  await page.getByTestId('select-scenario').selectOption('normal');
  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard').locator('tbody tr').first()).toBeVisible();
});
