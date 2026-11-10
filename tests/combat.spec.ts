import { expect, test } from '@playwright/test';

type Snapshot = {
  phase: string;
  turn: number;
  activeTeam: number;
  activeWormId: string;
  power: number;
  weapon: string;
  timeLeft: number;
  retreatLeft: number;
  fuseLeft: number | null;
  teams: Array<{ hp: number; worms: Array<{ alive: boolean; x: number; y: number }> }>;
};

type TerrainHandle = {
  canvas: HTMLCanvasElement;
  carve: (x: number, y: number, radius: number) => void;
};

const startMatch = async (page: import('@playwright/test').Page) => {
  await page.goto('/?seed=4242');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('arena').locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as never as { __WORMAGE__?: unknown }).__WORMAGE__));
};

const snapshot = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot());

const activeX = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      (window as never as { __WORMAGE__: { engine: { activeWorm: { x: number } | null } } }).__WORMAGE__.engine
        .activeWorm?.x ?? null,
  );

test('firing runs a projectile and hands the turn to the AI', async ({ page }) => {
  await startMatch(page);
  const before = await snapshot(page);
  expect(before.phase).toBe('aim');
  expect(before.activeTeam).toBe(0);
  expect(before.teams[0].hp).toBe(300);

  await page.getByTestId('btn-fire').click();
  await page.waitForTimeout(150);
  expect(['projectile', 'settle']).toContain((await snapshot(page)).phase);

  await page.waitForFunction(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn >= 2, undefined, { timeout: 15000 });
  const after = await snapshot(page);
  expect(after.activeTeam).toBe(1);
});

test('ending the turn during a shot does not cancel the projectile', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-fire').click();
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot();
    return state.phase === 'projectile';
  });

  await expect(page.getByTestId('btn-end-turn')).toBeDisabled();
  await page.keyboard.press('e');

  const during = await snapshot(page);
  expect(during.turn).toBe(1);
  expect(['projectile', 'settle']).toContain(during.phase);

  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn >= 2,
    undefined,
    { timeout: 15000 },
  );
});

test('walking changes the worm x position and respects the arena edge', async ({ page }) => {
  await startMatch(page);
  const before = await snapshot(page);
  const startX = before.teams[0].worms.find((w) => w.alive)!.x;

  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const moved = await snapshot(page);
  const movedX = moved.teams[0].worms.find((w) => w.alive)!.x;
  expect(movedX).toBeGreaterThan(startX);

  await page.keyboard.down('a');
  await page.waitForTimeout(2500);
  await page.keyboard.up('a');
  const edge = await snapshot(page);
  expect(edge.teams[0].worms.find((w) => w.alive)!.x).toBeGreaterThanOrEqual(12);
});

test('weapon selection follows ammo and keyboard shortcuts', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('weapon-dynamite').click();
  expect((await snapshot(page)).weapon).toBe('dynamite');

  await page.keyboard.press('1');
  expect((await snapshot(page)).weapon).toBe('bazooka');
});

test('pause freezes the turn timer until resumed', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('btn-resume')).toBeVisible();
  const frozen = (await snapshot(page)).timeLeft;
  await page.waitForTimeout(900);
  expect((await snapshot(page)).timeLeft).toBe(frozen);

  await page.getByTestId('btn-resume').click();
  await page.waitForTimeout(700);
  expect((await snapshot(page)).timeLeft).toBeLessThan(frozen);
});

test('the shooter can retreat during the post-fire window', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-fire').click();
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot();
    return state.phase === 'projectile' || state.phase === 'settle';
  });
  expect((await snapshot(page)).retreatLeft).toBeGreaterThan(0);

  const before = await activeX(page);
  await page.keyboard.down('a');
  await page.waitForTimeout(500);
  await page.keyboard.up('a');

  const after = await activeX(page);
  expect(after).not.toBeNull();
  expect(after!).toBeLessThan(before!);
  expect((await snapshot(page)).turn).toBe(1);

  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn >= 2,
    undefined,
    { timeout: 15000 },
  );
});

test('dynamite fuses down and explodes before the turn passes', async ({ page }) => {
  await startMatch(page);
  const hpBefore = (await snapshot(page)).teams[0].hp;

  await page.getByTestId('weapon-dynamite').click();
  await page.getByTestId('btn-fire').click();

  // A dropped charge burns its fuse instead of detonating on contact with the thrower.
  const midFuse = await page.evaluate(() => {
    const engine = (
      window as never as {
        __WORMAGE__: { engine: { update: (dt: number) => void; snapshot: () => Snapshot } };
      }
    ).__WORMAGE__.engine;
    for (let i = 0; i < 10; i += 1) engine.update(0.1);
    const state = engine.snapshot();
    return { fuseLeft: state.fuseLeft, hp: state.teams[0].hp };
  });
  expect(midFuse.fuseLeft).toBeGreaterThan(0);
  expect(midFuse.hp).toBe(hpBefore);

  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot();
    return state.fuseLeft !== null && state.fuseLeft <= 2.2;
  });

  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn >= 2,
    undefined,
    { timeout: 15000 },
  );
  expect((await snapshot(page)).teams[0].hp).toBeLessThan(hpBefore);
});

test('the AI plans, fires and hands the turn back', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-end-turn').click();
  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn === 2,
    undefined,
    { timeout: 5000 },
  );

  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn >= 3,
    undefined,
    { timeout: 25000 },
  );
  expect((await snapshot(page)).activeTeam).toBe(0);
});

test('ending the turn switches sides without damage', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-end-turn').click();
  await page.waitForFunction(() => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().turn === 2, undefined, { timeout: 5000 });
  const after = await snapshot(page);
  expect(after.activeTeam).toBe(1);
  expect(after.teams[0].hp).toBe(300);
  expect(after.teams[1].hp).toBe(300);
});

test('carving terrain punches a hole in the canvas instead of tinting it', async ({ page }) => {
  await startMatch(page);
  const alpha = await page.evaluate(() => {
    const terrain = (window as never as { __WORMAGE__: { engine: { terrain: TerrainHandle } } }).__WORMAGE__.engine
      .terrain;
    terrain.carve(640, 560, 40);
    const ctx = terrain.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    const alphaAt = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    return { crater: alphaAt(640, 560), ground: alphaAt(640, 660) };
  });
  expect(alpha.crater).toBe(0);
  expect(alpha.ground).toBe(255);
});
