import { expect, test } from 'vitest';
import { aimPoint } from '../../src/game/aim';
import {
  chooseRetreat,
  clampAngle,
  firingPositions,
  planAiTurn,
  planRopeClimb,
  previewFlight,
  simulateShot,
} from '../../src/game/ai';
import { AIM, JUMP_REACH, RETREAT_SECONDS, ROPE, WEAPONS, WORM } from '../../src/game/config';
import { terrain } from './terrainFixture';

test('reticle sits on the fixed-radius circle in open air', () => {
  const point = aimPoint(terrain(), 400, 500, -0.5);
  expect(point.hitTerrain).toBe(false);
  const distance = Math.hypot(point.x - 400, point.y - (500 - 14));
  expect(distance).toBeCloseTo(AIM.radius, 0);
});

test('reticle stops on terrain inside the circle', () => {
  const point = aimPoint(terrain(440), 400, 500, -0.2);
  expect(point.hitTerrain).toBe(true);
  const distance = Math.hypot(point.x - 400, point.y - (500 - 14));
  expect(distance).toBeLessThan(AIM.radius);
});

test('reticle never leaves the radius, even aiming along the floor', () => {
  const point = aimPoint(terrain(), 1260, 500, -0.08);
  const distance = Math.hypot(point.x - 1260, point.y - (500 - 14));
  expect(distance).toBeLessThanOrEqual(AIM.radius + 1);
});

test('a shot stops on the first worm in its path', () => {
  const open = simulateShot(terrain(), 418, 486, 0, 1, 'shotgun', 0);
  const blocked = simulateShot(terrain(), 418, 486, 0, 1, 'shotgun', 0, null, false, [
    { x: 700, y: 500 },
  ]);
  expect(open.x).toBeGreaterThan(900);
  expect(blocked.x).toBeGreaterThan(660);
  expect(blocked.x).toBeLessThan(700);
  expect(blocked.valid).toBe(true);
});

const ammo = { bazooka: Infinity, grenade: 3, shotgun: 4, dynamite: 2 } as const;

const plan = (wormX: number, enemyX: number) => {
  const worm = { id: 'a', teamId: 0, x: wormX, y: 500 };
  const enemy = { id: 'b', teamId: 1, x: enemyX, y: 500 };
  return planAiTurn({
    terrain: terrain(),
    worm,
    worms: [worm, enemy],
    ammo: { ...ammo },
    wind: 0,
    timeLeft: 45,
    difficulty: { angleError: 0, powerError: 0 },
    rng: () => 0.5,
  });
};

test('AI firing positions never require more than one jump', () => {
  // A 80 px step: too high to jump (the jump apex is about 58 px), but inside
  // the old 90 px window.
  const ledge = {
    isSolid: (x: number, y: number) => y >= (x >= 460 ? 420 : 500),
    groundY: (x: number, fromY: number, maxDown = 260) => {
      const top = x >= 460 ? 420 : 500;
      const start = Math.max(top, Math.ceil(fromY / 4) * 4);
      return start <= fromY + maxDown ? start : null;
    },
  };
  const positions = firingPositions(ledge, { id: 'a', teamId: 0, x: 400, y: 500 }, 400);

  expect(positions.length).toBeGreaterThan(0);
  for (const position of positions) {
    expect(500 - position.y).toBeLessThanOrEqual(JUMP_REACH);
  }
});

test('AI firing positions keep the ground under a shelf', () => {
  const shelf = {
    isSolid: (x: number, y: number) => y >= 500 || (x >= 300 && x <= 500 && y >= 300 && y <= 340),
    groundY: (x: number, fromY: number, maxDown = 260) => {
      const shelfTop = x >= 300 && x <= 500 ? 300 : 500;
      if (fromY <= shelfTop && fromY + maxDown >= shelfTop) return shelfTop;
      if (fromY <= 500 && fromY + maxDown >= 500) return 500;
      return null;
    },
  };
  const positions = firingPositions(shelf, { id: 'a', teamId: 0, x: 400, y: 500 }, 0, ROPE.range);

  expect(positions.some((position) => position.x === 400 && position.y === 500)).toBe(true);
  expect(positions.some((position) => position.x === 400 && position.y === 300)).toBe(false);
});

test('rope reach expands AI firing positions to high ledges', () => {
  const ledge = {
    isSolid: (x: number, y: number) => y >= (x >= 460 ? 420 : 500),
    groundY: (x: number, fromY: number, maxDown = 260) => {
      const top = x >= 460 ? 420 : 500;
      const start = Math.max(top, Math.ceil(fromY / 4) * 4);
      return start <= fromY + maxDown ? start : null;
    },
  };
  const positions = firingPositions(ledge, { id: 'a', teamId: 0, x: 400, y: 500 }, 400, ROPE.range);

  expect(positions.some((position) => position.y === 420)).toBe(true);
  expect(positions.every((position) => 500 - position.y <= ROPE.range)).toBe(true);
});

test('the AI finds a rope anchor above a ledge it cannot jump', () => {
  const wall = {
    isSolid: (_x: number, y: number) => y >= 500 || _x >= 520,
    groundY: (_x: number, fromY: number, maxDown = 260) =>
      fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
  };

  const plan = planRopeClimb(wall, { id: 'a', teamId: 0, x: 400, y: 500 }, 520, 420);

  expect(plan).not.toBeNull();
  expect(plan!.anchorX).toBeGreaterThanOrEqual(520);
  expect(plan!.anchorY).toBeLessThanOrEqual(400);
  expect(plan!.length).toBeLessThanOrEqual(ROPE.range);
});

test('the AI finds no rope anchor in open air or beyond range', () => {
  const open = { isSolid: () => false, groundY: () => null };
  expect(planRopeClimb(open, { id: 'a', teamId: 0, x: 400, y: 500 }, 520, 420)).toBeNull();

  const farWall = {
    isSolid: (x: number, y: number) => y >= 500 || x >= 900,
    groundY: (_x: number, fromY: number, maxDown = 260) =>
      fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
  };
  expect(planRopeClimb(farWall, { id: 'a', teamId: 0, x: 400, y: 500 }, 900, 420)).toBeNull();
});

const impactOf = (turn: NonNullable<ReturnType<typeof plan>>, targetX: number) => {
  const def = WEAPONS[turn.weapon];
  const impact = simulateShot(
    terrain(),
    turn.fireX + Math.cos(turn.angle) * 18,
    500 - 14 + Math.sin(turn.angle) * 18,
    turn.angle,
    turn.power,
    turn.weapon,
    0,
    def.fuse,
    def.bounces,
  );
  return impact.valid ? Math.hypot(impact.x - targetX, impact.y - (500 - 13)) : Infinity;
};

/** Flat ground at y = 500 with solid vertical walls spanning body height. */
const walled = (...walls: Array<[number, number]>) => ({
  isSolid: (x: number, y: number) => y >= 500 || walls.some(([from, to]) => x >= from && x <= to),
  groundY: (_x: number, fromY: number, maxDown = 260) =>
    fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
});

const enemy = { id: 'b', teamId: 1, x: 440, y: 500 };

test('the aim preview traces an arc for a fuse-less weapon', () => {
  const points = previewFlight(terrain(), 400, 486, -0.6, 0.8, 'bazooka', 0);
  expect(points.length).toBeGreaterThan(3);
  expect(new Set(points.map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`)).size).toBe(points.length);
});

test('a fused preview ends on the detonation point', () => {
  const points = previewFlight(terrain(), 400, 486, -0.6, 0.8, 'grenade', 0);
  const end = simulateShot(
    terrain(),
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
  expect(Math.hypot(last.x - end.x, last.y - end.y)).toBeLessThan(3);
});

test('the aim clamp uses the configured limits', () => {
  expect(clampAngle(0)).toBe(AIM.max);
  expect(clampAngle(-Math.PI)).toBe(AIM.min);
});

test('the AI never retreats through a wall to escape its own blast', () => {
  // The best blast-safe spot is left of the wall, but the worm cannot get there.
  const spot = chooseRetreat(
    walled([300, 330]),
    { x: 400, y: 500 },
    [enemy],
    { x: 400, y: 492 },
    95,
    RETREAT_SECONDS,
  );
  expect(spot).not.toBeNull();
  expect(spot!).toBeGreaterThan(400);
});

test('the AI finds no retreat spot when every blast-safe spot is walled off', () => {
  const spot = chooseRetreat(
    walled([300, 330], [470, 500]),
    { x: 400, y: 500 },
    [enemy],
    { x: 400, y: 492 },
    95,
    RETREAT_SECONDS,
  );
  expect(spot).toBeNull();
});

test('AI picks a weapon and a firing spot whose real shot lands on the enemy', () => {
  const turn = plan(200, 900);
  expect(turn).not.toBeNull();
  expect(turn!.weapon).not.toBe('dynamite');
  expect(impactOf(turn!, 900)).toBeLessThan(70);
});

test('AI aims at an enemy on its left, not away from it', () => {
  const turn = plan(900, 200);
  expect(turn).not.toBeNull();
  expect(impactOf(turn!, 200)).toBeLessThan(70);
});

test('AI retreats away from the enemy after firing', () => {
  const turn = plan(200, 900);
  expect(turn).not.toBeNull();
  expect(Math.abs(turn!.retreatX - 900)).toBeGreaterThan(Math.abs(turn!.fireX - 900));
});

test('AI drops dynamite at point-blank only when it can escape the blast', () => {
  const turn = plan(400, 440);
  expect(turn).not.toBeNull();
  expect(turn!.weapon).toBe('dynamite');
  expect(Math.abs(turn!.retreatX - turn!.fireX)).toBeGreaterThan(
    WEAPONS.dynamite.radius + WORM.radius,
  );
});

test('the AI never plans a shot through an ally', () => {
  const worm = { id: 'a', teamId: 0, x: 900, y: 500 };
  const ally = { id: 'c', teamId: 0, x: 600, y: 500 };
  const enemy = { id: 'b', teamId: 1, x: 200, y: 500 };
  const turn = planAiTurn({
    terrain: terrain(),
    worm,
    worms: [worm, ally, enemy],
    ammo: { ...ammo },
    wind: 0,
    timeLeft: 45,
    difficulty: { angleError: 0, powerError: 0 },
    rng: () => 0.5,
  });
  expect(turn).not.toBeNull();
  // The enemy is out of dynamite walking range, so the plan must be a projectile.
  expect(turn!.weapon).not.toBe('dynamite');

  const def = WEAPONS[turn!.weapon];
  const impact = simulateShot(
    terrain(),
    turn!.fireX + Math.cos(turn!.angle) * 18,
    500 - 14 + Math.sin(turn!.angle) * 18,
    turn!.angle,
    turn!.power,
    turn!.weapon,
    0,
    def.fuse,
    def.bounces,
    [ally, enemy],
  );
  expect(Math.hypot(impact.x - ally.x, impact.y - (ally.y - 13))).toBeGreaterThan(
    14 + WORM.radius * 0.4,
  );
});
