import { expect, test } from '@playwright/test';

type RopeWorm = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  airborne: boolean;
  fallDistance: number;
  aimAngle: number;
  facing: 1 | -1;
  rope: { anchorX: number; anchorY: number; length: number } | null;
};

type RopeEngine = {
  activeWorm: RopeWorm | null;
  terrain: {
    isSolid(x: number, y: number): boolean;
    groundY(x: number, fromY: number, maxDown?: number): number | null;
  };
};

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/demo?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

test('the rope card anchors, reels in and lets go', async ({ page }) => {
  await startMatch(page);
  await expect(page.getByTestId('btn-rope')).toBeEnabled();

  // Stand under a floating shelf so a vertical rope has terrain to grab.
  const spot = await page.evaluate(() => {
    const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
    for (let x = 40; x <= 1240; x += 20) {
      const shelf = engine.terrain.groundY(x, 120, 520);
      if (shelf === null) continue;
      const ground = engine.terrain.groundY(x, shelf + 40, 600);
      if (ground === null || ground > 640) continue;
      if (ground - shelf < 60 || ground - shelf > 200) continue;
      return { x, y: ground };
    }
    return null;
  });
  expect(spot).not.toBeNull();

  const start = await page.evaluate((position) => {
    const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
    const worm = engine.activeWorm!;
    worm.x = position.x;
    worm.y = position.y;
    worm.vx = 0;
    worm.vy = 0;
    worm.onGround = true;
    worm.airborne = false;
    worm.fallDistance = 0;
    worm.aimAngle = -Math.PI / 2;
    worm.facing = 1;
    return { x: worm.x, y: worm.y };
  }, spot!);

  await page.getByTestId('btn-rope').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
        return Boolean(engine.activeWorm?.rope);
      }),
    )
    .toBe(true);
  const attached = await page.evaluate(() => {
    const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
    const worm = engine.activeWorm!;
    return { length: worm.rope!.length, anchorX: worm.rope!.anchorX, anchorY: worm.rope!.anchorY };
  });
  expect(Math.hypot(attached.anchorX - start.x, attached.anchorY - (start.y - 14))).toBeLessThanOrEqual(220);

  await page.keyboard.down('w');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
        return engine.activeWorm?.rope?.length ?? Infinity;
      }),
    )
    .toBeLessThan(attached.length - 5);
  await page.keyboard.up('w');

  await page.keyboard.press('j');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const engine = (window as never as { __WORMAGE__: { engine: RopeEngine } }).__WORMAGE__.engine;
        return Boolean(engine.activeWorm?.rope);
      }),
    )
    .toBe(false);
});
