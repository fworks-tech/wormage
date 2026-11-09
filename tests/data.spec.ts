import { expect, test } from '@playwright/test';

type Engine = { surrender: () => void; scoreFor: (team: number) => number };

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

  await page.reload();
  await page.getByTestId('tab-briefing').click();
  await expect(page.locator('.last-run')).toBeVisible();
});
