import { expect, test } from '@playwright/test';
import { RETREAT_SECONDS, WEAPONS } from '../src/game/config';

type Snapshot = {
  phase: string;
  turn: number;
  activeTeam: number;
  activeWormId: string;
  power: number;
  charging: boolean;
  weapon: string;
  timeLeft: number;
  retreatLeft: number;
  fuseLeft: number | null;
  teams: Array<{ hp: number; worms: Array<{ alive: boolean; x: number; y: number }> }>;
};

type EngineHandle = {
  fire: () => void;
  update: (dt: number) => void;
  snapshot: () => Snapshot;
};

type TerrainHandle = {
  carve: (x: number, y: number, radius: number) => void;
};

type PainterHandle = {
  canvas: HTMLCanvasElement;
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

test('the on-screen walk buttons move the active worm', async ({ page }) => {
  await startMatch(page);
  const before = await activeX(page);
  expect(before).not.toBeNull();

  const pad = await page.getByTestId('btn-right').boundingBox();
  await page.mouse.move(pad!.x + pad!.width / 2, pad!.y + pad!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();

  const after = await activeX(page);
  expect(after!).toBeGreaterThan(before!);

  // Releasing the pad must stop the worm, not leave it walking.
  await page.waitForTimeout(250);
  expect(await activeX(page)).toBeCloseTo(after!, 1);
});

test('the on-screen walk buttons move the worm during retreat', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('btn-fire').click();
  await page.waitForFunction(() => {
    const state = (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot();
    return state.retreatLeft > 0;
  });

  const before = await activeX(page);
  const pad = await page.getByTestId('btn-left').boundingBox();
  await page.mouse.move(pad!.x + pad!.width / 2, pad!.y + pad!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();

  const after = await activeX(page);
  expect(after!).toBeLessThan(before!);
});

test('a held walk key does not survive an auto-pause', async ({ page }) => {
  await startMatch(page);
  const startX = await activeX(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await activeX(page)) ?? -1).toBeGreaterThan(startX! + 5);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('btn-resume')).toBeVisible();
  const pausedX = await activeX(page);
  const pausedTime = (await snapshot(page)).timeLeft;

  await page.keyboard.up('d');
  await page.getByTestId('btn-resume').click();
  await page.waitForFunction(
    (time) => {
      const state = (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot();
      return state.timeLeft < time;
    },
    pausedTime,
  );

  expect(await activeX(page)).toBeCloseTo(pausedX!, 1);
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

test('the HUD stays inside the letterboxed arena on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 940 });
  await startMatch(page);

  const bar = (1900 - (940 * 16) / 9) / 2;
  const left = await page.getByTestId('btn-left').boundingBox();
  expect(left!.x).toBeGreaterThanOrEqual(bar - 1);

  const pause = await page.getByTestId('btn-pause').boundingBox();
  expect(pause!.x + pause!.width).toBeLessThanOrEqual(1900 - bar + 1);
});

test('the fuse countdown shows the real fuse and scales its bar', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('weapon-dynamite').click();
  expect((await snapshot(page)).weapon).toBe('dynamite');
  // Pause before firing: waiting for a fuse window and then clicking races the
  // fuse itself, and a slow worker can miss the window.
  await page.getByTestId('btn-pause').click();

  // The paused loop still renders and pushes snapshots but stops calling update,
  // so this burns the frozen fuse deterministically.
  const fuse = await page.evaluate(() => {
    const engine = (window as never as { __WORMAGE__: { engine: EngineHandle } }).__WORMAGE__.engine;
    engine.fire();
    for (let step = 0; step < 60; step += 1) {
      const left = engine.snapshot().fuseLeft;
      if (left !== null && left < 1.7) return left;
      engine.update(1 / 60);
    }
    throw new Error('the dynamite fuse never dropped below 1.7 s');
  });

  const total = WEAPONS.dynamite.fuse!;
  await expect(page.getByTestId('hud-timer')).toHaveText(fuse.toFixed(1));

  const expected = (fuse / total) * 100;
  await expect
    .poll(() =>
      page
        .getByTestId('hud-timer-fill')
        .evaluate((el) => Number.parseFloat((el as HTMLElement).style.width)),
    )
    .toBeCloseTo(expected, 1);
});

test('the retreat countdown scales its bar by the retreat window, not the fuse', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('weapon-dynamite').click();
  expect((await snapshot(page)).weapon).toBe('dynamite');
  // Pause before firing: waiting for the retreat window and then clicking races
  // its 3 s length, and a slow worker can miss the window entirely.
  await page.getByTestId('btn-pause').click();

  // The paused loop still renders and pushes snapshots but stops calling update,
  // so this drives the frozen engine to the explosion deterministically.
  const retreatLeft = await page.evaluate(() => {
    const engine = (window as never as { __WORMAGE__: { engine: EngineHandle } }).__WORMAGE__.engine;
    engine.fire();
    for (let step = 0; step < 300; step += 1) {
      const state = engine.snapshot();
      if (state.fuseLeft === null && state.retreatLeft > 0) return state.retreatLeft;
      engine.update(1 / 60);
    }
    throw new Error('the dynamite fuse never opened a retreat window');
  });

  const expected = (retreatLeft / RETREAT_SECONDS) * 100;
  await expect
    .poll(() =>
      page
        .getByTestId('hud-timer-fill')
        .evaluate((el) => Number.parseFloat((el as HTMLElement).style.width)),
    )
    .toBeCloseTo(expected, 1);
});

test('pausing cancels a charge instead of firing on release', async ({ page }) => {
  await startMatch(page);
  await page.keyboard.down('Space');
  await page.waitForFunction(
    () => (window as never as { __WORMAGE__: { snapshot: () => Snapshot } }).__WORMAGE__.snapshot().charging,
  );

  await page.getByTestId('btn-pause').click();
  await page.keyboard.up('Space');

  // The release happens under the pause card; nothing may fire.
  const after = await snapshot(page);
  expect(after.phase).toBe('aim');
  expect(after.charging).toBe(false);
  expect(after.power).toBe(0);
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

test('surrendering mid-flight leaves no frozen projectile', async ({ page }) => {
  await startMatch(page);

  // Fire and surrender in one tick: a UI click can resolve after the grenade
  // already hit a worm, and then there is no in-flight shot left to check.
  const after = await page.evaluate(() => {
    const engine = (
      window as never as {
        __WORMAGE__: {
          engine: {
            weapon: string;
            fire: () => void;
            surrender: () => void;
            projectilesInFlight: readonly unknown[];
            snapshot: () => Snapshot;
          };
        };
      }
    ).__WORMAGE__.engine;
    engine.weapon = 'grenade';
    engine.fire();
    const inFlightBefore = engine.projectilesInFlight.length;
    engine.surrender();
    const state = engine.snapshot();
    return {
      inFlightBefore,
      phase: state.phase,
      fuseLeft: state.fuseLeft,
      inFlight: engine.projectilesInFlight.length,
    };
  });

  expect(after.inFlightBefore).toBeGreaterThan(0);
  expect(after.phase).toBe('gameover');
  expect(after.inFlight).toBe(0);
  expect(after.fuseLeft).toBeNull();
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
  await page.waitForFunction(
    () => Boolean((window as never as { __WORMAGE__: { painter?: unknown } }).__WORMAGE__.painter),
  );
  const alpha = await page.evaluate(() => {
    const state = (window as never as { __WORMAGE__: { engine: { terrain: TerrainHandle }; painter: PainterHandle } })
      .__WORMAGE__;
    state.engine.terrain.carve(640, 560, 40);
    const ctx = state.painter.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    const alphaAt = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    return { crater: alphaAt(640, 560), ground: alphaAt(640, 660) };
  });
  expect(alpha.crater).toBe(0);
  expect(alpha.ground).toBe(255);
});
