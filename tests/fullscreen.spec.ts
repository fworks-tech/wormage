import { expect, test, type Page } from '@playwright/test';

type Snapshot = { turn: number; phase: string };

const fullscreenTag = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.fullscreenElement?.tagName ?? null);

const snapshot = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot());

const startMatch = async (page: Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
};

/** Records orientation requests; the real API cannot rotate a headless viewport. */
const stubOrientation = (page: Page) =>
  page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __orientation: string[] }).__orientation = calls;
    const prototype = (window as unknown as { ScreenOrientation?: { prototype: object } }).ScreenOrientation
      ?.prototype;
    if (!prototype) return;
    Object.defineProperty(prototype, 'lock', {
      configurable: true,
      value: (orientation: string) => {
        calls.push(`lock:${orientation}`);
        return Promise.resolve();
      },
    });
    Object.defineProperty(prototype, 'unlock', {
      configurable: true,
      value: () => {
        calls.push('unlock');
      },
    });
  });

const orientationCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __orientation: string[] }).__orientation);

test('starting a match puts the demo in fullscreen without pausing it', async ({ page }) => {
  await startMatch(page);
  await expect.poll(() => fullscreenTag(page)).toBe('HTML');
  await expect(page.getByTestId('btn-resume')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
});

test('a touch match locks landscape only while fullscreen', async ({ page }, testInfo) => {
  await stubOrientation(page);
  await startMatch(page);

  if (testInfo.project.name === 'mobile') {
    await expect.poll(() => orientationCalls(page)).toContain('lock:landscape');
  } else {
    expect(await orientationCalls(page)).not.toContain('lock:landscape');
  }

  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => fullscreenTag(page)).toBeNull();

  if (testInfo.project.name === 'mobile') {
    await expect.poll(() => orientationCalls(page)).toContain('unlock');
  }
});

test('exiting fullscreen is respected and the pause dialog restores it', async ({ page }) => {
  await startMatch(page);
  await expect.poll(() => fullscreenTag(page)).toBe('HTML');

  if (test.info().project.name === 'desktop') await page.keyboard.press('p');
  else await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('btn-fullscreen')).toHaveCount(0);
  const before = await snapshot(page);

  // Escape is the browser's fullscreen exit, so it must not also resume here.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('btn-resume')).toBeVisible();

  // Stands in for the system exit, which headless Chrome does not perform.
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => fullscreenTag(page)).toBeNull();
  await expect(page.getByTestId('btn-resume')).toBeVisible();

  const button = page.getByTestId('btn-fullscreen');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  await button.click();
  await expect.poll(() => fullscreenTag(page)).toBe('HTML');
  await expect(page.getByTestId('btn-fullscreen')).toHaveCount(0);

  const after = await snapshot(page);
  expect(after.turn).toBe(before.turn);
  expect(after.phase).toBe(before.phase);
});

test('the project page never asks for fullscreen', async ({ page }) => {
  await page.goto('/project');
  await page.getByTestId('tab-ranking').click();
  await expect(page.getByTestId('leaderboard')).toBeVisible();
  expect(await fullscreenTag(page)).toBeNull();

  // Deploy is a real navigation: fullscreen must wait for Start Game on /demo.
  await page.getByTestId('tab-briefing').click();
  await page.getByTestId('btn-play').click();
  await expect(page).toHaveURL(/\/demo$/);
  expect(await fullscreenTag(page)).toBeNull();
});

test('Play Again re-enters fullscreen from the result screen', async ({ page }) => {
  await startMatch(page);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => fullscreenTag(page)).toBeNull();

  await page.evaluate(() =>
    (window as never as { __WORMAGE__: { engine: { surrender: () => void } } }).__WORMAGE__.engine.surrender(),
  );
  await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('btn-play-again').click();
  await expect.poll(() => fullscreenTag(page)).toBe('HTML');
});
