import { expect, test } from '@playwright/test';
import { aimPoint } from '../src/game/aim';
import { planAiTurn, simulateShot } from '../src/game/ai';
import { AIM, WEAPONS, WORM } from '../src/game/config';

/** Flat ground at y = 500, or a wall from x = wallX. No canvas needed. */
const terrain = (wallX = Infinity) => ({
  isSolid: (x: number, y: number) => y >= 500 || x >= wallX,
  groundY: (_x: number, fromY: number, maxDown = 260) =>
    fromY <= 500 && fromY + maxDown >= 500 ? 500 : null,
});

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

test('AI picks a weapon and a firing spot whose real shot lands on the enemy', () => {
  const turn = plan(200, 900);
  expect(turn).not.toBeNull();
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
  );
  expect(impact.valid).toBe(true);
  expect(Math.hypot(impact.x - 900, impact.y - (500 - 13))).toBeLessThan(70);
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
