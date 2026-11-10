import { describe, expect, test } from 'vitest';
import { previewFlight, simulateShot } from '../../src/game/ai';
import { BOUNCE, PREVIEW_SECONDS, WEAPONS } from '../../src/game/config';
import { openTerrain, terrain } from './terrainFixture';

const ground = terrain();

/** Mutate one config value for the duration of a test body. */
const withConfig = <T extends object, K extends keyof T>(target: T, key: K, value: T[K], run: () => void) => {
  const original = target[key];
  target[key] = value;
  try {
    run();
  } finally {
    target[key] = original;
  }
};

describe('simulateShot reads the weapon config, not copies of it', () => {
  test('speed comes from WEAPONS', () => {
    const before = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 0, 0.5);
    withConfig(WEAPONS.bazooka, 'speedMax', WEAPONS.bazooka.speedMax * 1.5, () => {
      const after = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 0, 0.5);
      expect(Math.abs(after.x - before.x)).toBeGreaterThan(5);
    });
  });

  test('gravity scale comes from WEAPONS', () => {
    const before = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 0, 0.5);
    withConfig(WEAPONS.bazooka, 'gravityScale', WEAPONS.bazooka.gravityScale * 2, () => {
      const after = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 0, 0.5);
      expect(Math.abs(after.y - before.y)).toBeGreaterThan(5);
    });
  });

  test('wind scale comes from WEAPONS', () => {
    const before = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 100, 0.5);
    withConfig(WEAPONS.bazooka, 'windScale', 0, () => {
      const after = simulateShot(openTerrain, 400, 486, -0.6, 0.8, 'bazooka', 100, 0.5);
      expect(Math.abs(after.x - before.x)).toBeGreaterThan(5);
    });
  });

  test('the shotgun stops at its configured lifetime', () => {
    const start = { x: 400, y: 486 };
    const atLife = simulateShot(openTerrain, start.x, start.y, -0.1, 1, 'shotgun', 0, null, false);
    const travelled = Math.hypot(atLife.x - start.x, atLife.y - start.y);

    // Compare the two shots to each other: a balance change to the shotgun's
    // speed must not decide whether the lifetime is honoured.
    withConfig(WEAPONS.shotgun, 'life', 0.1, () => {
      const short = simulateShot(openTerrain, start.x, start.y, -0.1, 1, 'shotgun', 0, null, false);
      expect(Math.hypot(short.x - start.x, short.y - start.y)).toBeLessThan(travelled / 2);
    });
  });

  test('the grenade bounces with BOUNCE damping', () => {
    const noBounce = simulateShot(ground, 400, 486, -0.3, 0.5, 'grenade', 0, null, false);
    const bounced = simulateShot(ground, 400, 486, -0.3, 0.5, 'grenade', 0, null, true);
    expect(bounced.y).not.toBe(noBounce.y);

    withConfig(BOUNCE as { x: number; y: number }, 'x', 1, () => {
      const undamped = simulateShot(ground, 400, 486, -0.3, 0.5, 'grenade', 0, null, true);
      expect(Math.abs(undamped.x - bounced.x)).toBeGreaterThan(5);
    });
  });

  test('a fused preview stops at the weapon fuse', () => {
    const fuse = WEAPONS.grenade.fuse;
    expect(fuse).not.toBeNull();
    withConfig(WEAPONS.grenade, 'fuse', (fuse ?? 0) / 2, () => {
      const points = previewFlight(openTerrain, 400, 486, -0.6, 0.8, 'grenade', 0);
      const end = simulateShot(
        openTerrain,
        400,
        486,
        -0.6,
        0.8,
        'grenade',
        0,
        WEAPONS.grenade.fuse,
        WEAPONS.grenade.bounces,
      );
      const last = points.at(-1)!;
      expect(last.x).toBeCloseTo(end.x, 5);
      expect(last.y).toBeCloseTo(end.y, 5);
    });
  });

  test('a lifetime preview stops at the weapon life', () => {
    const points = previewFlight(openTerrain, 400, 486, -0.1, 1, 'shotgun', 0);
    const end = simulateShot(openTerrain, 400, 486, -0.1, 1, 'shotgun', 0, WEAPONS.shotgun.life);
    const last = points.at(-1)!;
    expect(last.x).toBeCloseTo(end.x, 5);
    expect(last.y).toBeCloseTo(end.y, 5);
  });
});

test('the preview horizon comes from PREVIEW_SECONDS when a weapon has no fuse or life', () => {
  const points = previewFlight(openTerrain, 400, 486, -0.3, 0.5, 'bazooka', 0, 3);
  const last = points.at(-1)!;
  const end = simulateShot(openTerrain, 400, 486, -0.3, 0.5, 'bazooka', 0, PREVIEW_SECONDS);
  expect(last.x).toBeCloseTo(end.x, 5);
  expect(last.y).toBeCloseTo(end.y, 5);
});
