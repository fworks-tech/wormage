import { GRAVITY, PROJECTILE_GRAVITY, WATER_Y, WIND_ACCEL, WORM } from './config';
import type { WeaponId } from './types';
import { Terrain } from './terrain';

export interface ShotPlan {
  angle: number;
  power: number;
}

interface SimResult {
  x: number;
  y: number;
  valid: boolean;
}

/**
 * Forward-simulate a projectile with the exact combat constants so the AI
 * (and the aim preview) never diverge from the real physics.
 */
export function simulateShot(
  terrain: Terrain,
  startX: number,
  startY: number,
  angle: number,
  power: number,
  weapon: WeaponId,
  wind: number,
  fuse: number | null = null,
  bounces = false,
): SimResult {
  const speeds: Record<WeaponId, [number, number]> = {
    bazooka: [260, 830],
    grenade: [240, 760],
    shotgun: [1500, 1500],
    dynamite: [0, 0],
  };
  const [min, max] = speeds[weapon];
  const speed = min + (max - min) * power;
  const gravityScale = weapon === 'shotgun' ? 0.08 : 1;
  const windScale = weapon === 'shotgun' ? 0 : weapon === 'grenade' ? 0.8 : 1;

  let x = startX;
  let y = startY;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  const dt = 1 / 60;

  for (let t = 0; t < 5; t += dt) {
    if (fuse !== null && t >= fuse) return { x, y, valid: true };
    vy += PROJECTILE_GRAVITY * gravityScale * dt;
    vx += wind * windScale * 0.9 * dt;
    x += vx * dt;
    y += vy * dt;
    if (x < 0 || x > 1280 || y > WATER_Y) return { x, y, valid: false };
    if (terrain.isSolid(x, y)) {
      if (!bounces) return { x, y, valid: y < WATER_Y - 12 };
      if (terrain.isSolid(x - vx * dt, y)) {
        vx = -vx * 0.45;
      } else if (terrain.isSolid(x, y - vy * dt)) {
        vy = -vy * 0.45;
      } else {
        vx = -vx * 0.45;
        vy = -vy * 0.45;
      }
      x -= vx * dt;
      y -= vy * dt;
    }
    if (weapon === 'shotgun' && t > 0.32) return { x, y, valid: true };
  }
  return { x, y, valid: false };
}

export function planAiShot(
  terrain: Terrain,
  wormX: number,
  wormY: number,
  targetX: number,
  targetY: number,
  wind: number,
  difficulty: { angleError: number; powerError: number },
  rng: () => number,
): ShotPlan {
  const facingLeft = targetX < wormX;
  const base = facingLeft ? -Math.PI : 0;
  const mirror = facingLeft ? -1 : 1;
  const offsets = [0.22, 0.5, 0.75, 1.0, 1.22, 1.42];
  let best: { score: number; angle: number; power: number } | null = null;

  for (const offset of offsets) {
    for (let power = 0.4; power <= 1.001; power += 0.06) {
      const angle = base + mirror * offset;
      const startX = wormX + Math.cos(angle) * 18;
      const startY = wormY - 14 + Math.sin(angle) * 18;
      const result = simulateShot(terrain, startX, startY, angle, power, 'bazooka', wind);
      if (!result.valid) continue;
      const dx = result.x - targetX;
      const dy = result.y - targetY;
      let score = Math.hypot(dx, dy);
      if (Math.hypot(result.x - wormX, result.y - wormY) < 70) score += 400;
      if (!best || score < best.score) best = { score, angle, power };
    }
  }

  if (!best) {
    return { angle: base + mirror * 0.8, power: 0.7 };
  }

  const jitterAngle = (rng() * 2 - 1) * difficulty.angleError;
  const jitterPower = (rng() * 2 - 1) * difficulty.powerError;
  return {
    angle: best.angle + jitterAngle,
    power: Math.min(1, Math.max(0.25, best.power + jitterPower)),
  };
}

export function mirrorAngle(angle: number): number {
  return -Math.PI - angle;
}

export function clampAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.min(-0.08, Math.max(-Math.PI + 0.08, a));
}

/** Keep the fall math shared between worms and projectiles. */
export const PHYSICS = { gravity: GRAVITY, waterY: WATER_Y, windAccel: WIND_ACCEL, worm: WORM };
