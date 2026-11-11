import { expect, test, type Page } from '@playwright/test';

type Engine = { surrender: () => void; scoreFor: (team: number) => number };

/** Starts the seeded match and ends it, landing on the result card. */
async function finishMatch(page: Page) {
  await page.goto('/?seed=777');
  await page.getByTestId('btn-play').click();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  await page.evaluate(() => {
    (window as never as { __WORMAGE__: { engine: Engine } }).__WORMAGE__.engine.surrender();
  });
  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 10_000 });
}

test('a finished match is registered once and shows in history and ranking', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('e2e-cleared')) {
      window.sessionStorage.setItem('e2e-cleared', '1');
      window.localStorage.clear();
      window.localStorage.setItem('wormage.netScenario.v1', JSON.stringify('normal'));
    }
  });
  await page.goto('/?seed=777');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));

  await page.evaluate(() => {
    (window as never as { __WORMAGE__: { engine: Engine } }).__WORMAGE__.engine.surrender();
  });

  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 10_000 });
  const score = await page.getByTestId('result-score').innerText();
  expect(Number(score)).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId('save-state')).toContainText(/Logged|Filing/, { timeout: 10_000 });
  await expect(page.getByTestId('save-state')).toContainText('Logged', { timeout: 10_000 });

  await page.getByTestId('btn-main-menu').click();
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('match-history').locator('tbody tr').first()).toBeVisible();
  await expect(page.getByTestId('match-history').locator('tbody tr').first()).toContainText(score);

  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard').locator('tbody tr').first()).toBeVisible();

  // The board survives a reload (localStorage-backed mock DB).
  await page.reload();
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('match-history').locator('tbody tr').first()).toBeVisible();
});

test('the result survives a refresh through the persisted last result', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('btn-play').click();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  await page.evaluate(() => {
    (window as never as { __WORMAGE__: { engine: Engine } }).__WORMAGE__.engine.surrender();
  });
  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 10_000 });

  await page.goto('/project');
  await page.getByTestId('tab-briefing').click();
  await expect(page.locator('.last-run')).toBeVisible();
});

test('the Main menu waits while the result is still being filed', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('e2e-cleared')) {
      window.sessionStorage.setItem('e2e-cleared', '1');
      window.localStorage.clear();
      window.localStorage.setItem('wormage.netScenario.v1', JSON.stringify('slow'));
    }
  });
  await page.goto('/?seed=777');
  await page.getByTestId('btn-play').click();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
  await page.evaluate(() => {
    (window as never as { __WORMAGE__: { engine: Engine } }).__WORMAGE__.engine.surrender();
  });

  // The slow-link scenario holds the save open for 1.5s, so the window is real.
  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('save-state')).toContainText('Filing');
  await expect(page.getByTestId('btn-main-menu')).toBeDisabled();

  await expect(page.getByTestId('save-state')).toContainText('Logged', { timeout: 10_000 });
  await expect(page.getByTestId('btn-main-menu')).toBeEnabled();
  await page.getByTestId('btn-main-menu').click();
  await expect(page).toHaveURL(/\/project$/);
});

test('the result card tells the story without a statistics grid', async ({ page }) => {
  await finishMatch(page);

  await expect(page.getByTestId('result-line')).not.toBeEmpty();
  await expect(page.getByTestId('result-screen').locator('.result-meta')).toContainText('seed 777');
  await expect(page.getByTestId('result-screen').locator('dl')).toHaveCount(0);
  await expect(page.getByTestId('btn-change-setup')).toBeVisible();
  await expect(page.getByTestId('btn-play-again')).toBeVisible();
});

test('Change setup returns to the New Game card', async ({ page }) => {
  await finishMatch(page);
  await page.getByTestId('btn-change-setup').click();

  await expect(page).toHaveURL(/\/demo\?seed=777$/);
  await expect(page.getByTestId('btn-play')).toHaveText('Start Game');
});

test('Copy result puts a shareable summary on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await finishMatch(page);

  await page.getByTestId('btn-copy-result').click();
  await expect(page.getByTestId('btn-copy-result')).toHaveText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/Wormage — (Victory|Defeat), \d+ pts, \d+ kills?, .+, seed 777/);
});
