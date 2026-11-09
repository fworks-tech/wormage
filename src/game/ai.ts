import {
  BOUNCE,
  GRAVITY,
  PROJECTILE_GRAVITY,
  RETREAT_SECONDS,
  WATER_Y,
  WEAPONS,
  WIND_ACCEL,
  WIND_FACTOR,
  WORM,
  WORLD_W,
} from './config';
import type { WeaponId } from './types';

/** The slice of Terrain a ballistic simulation needs. */
export interface ShotTerrain {
  isSolid(x: number, y: number): boolean;
}

/** The slice of Terrain a movement plan needs. */
export interface AiTerrain extends ShotTerrain {
  groundY(x: number, fromY: number, maxDown?: number): number | null;
}

export interface ShotPlan {
  angle: number;
  power: number;
}

export interface AiWorm {
  id: string;
  teamId: number;
  x: number;
  y: number;
}

export interface AiTurnPlan {
  weapon: WeaponId;
  /** Where the worm should stand before firing. */
  fireX: number;
  angle: number;
  power: number;
  /** Where the worm should walk once the shot is away. */
  retreatX: number;
}

export interface AiTurnInput {
  terrain: AiTerrain;
  worm: AiWorm;
  /** Alive worms only, including the actor. */
  worms: AiWorm[];
  ammo: Record<WeaponId, number>;
  wind: number;
  timeLeft: number;
  difficulty: { angleError: number; powerError: number };
  rng: () => number;
}

interface SimResult {
  x: number;
  y: number;
  valid: boolean;
}

interface Candidate {
  score: number;
  angle: number;
  power: number;
  retreatX: number;
}

/**
 * Forward-simulate a projectile with the exact combat constants so the AI
 * (and the aim preview) never diverge from the real physics.
 */
export function simulateShot(
  terrain: ShotTerrain,
  startX: number,
  startY: number,
  angle: number,
  power: number,
  weapon: WeaponId,
  wind: number,
  fuse: number | null = null,
  bounces = false,
  bodies: ReadonlyArray<{ x: number; y: number }> = [],
): SimResult {
  const def = WEAPONS[weapon];
  const speed = def.speedMin + (def.speedMax - def.speedMin) * power;

  let x = startX;
  let y = startY;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  const dt = 1 / 60;

  for (let t = 0; t < 5; t += dt) {
    if (fuse !== null && t >= fuse) return { x, y, valid: true };
    vy += PROJECTILE_GRAVITY * def.gravityScale * dt;
    vx += wind * def.windScale * WIND_FACTOR * dt;
    x += vx * dt;
    y += vy * dt;
    // Match the engine: the first worm in the path takes the hit.
    if (bodies.some((b) => Math.hypot(b.x - x, b.y - 13 - y) < 14 + WORM.radius * 0.4)) {
      return { x, y, valid: y < WATER_Y - 12 };
    }
    if (x < 0 || x > 1280 || y > WATER_Y) return { x, y, valid: false };
    if (terrain.isSolid(x, y)) {
      if (!bounces) return { x, y, valid: y < WATER_Y - 12 };
      if (terrain.isSolid(x - vx * dt, y)) {
        vx = -vx * BOUNCE.x;
      } else if (terrain.isSolid(x, y - vy * dt)) {
        vy = -vy * BOUNCE.y;
      } else {
        vx = -vx * BOUNCE.x;
        vy = -vy * BOUNCE.y;
      }
      x -= vx * dt;
      y -= vy * dt;
    }
    if (def.life !== null && t >= def.life) return { x, y, valid: true };
  }
  return { x, y, valid: false };
}

/**
 * Legacy single-shot solver: best bazooka (angle, power) from a fixed spot.
 * Used as the fallback when the AI cannot walk to its planned position.
 */
export function planAiShot(
  terrain: AiTerrain,
  wormX: number,
  wormY: number,
  targetX: number,
  targetY: number,
  wind: number,
  difficulty: { angleError: number; powerError: number },
  rng: () => number,
  bodies: ReadonlyArray<{ x: number; y: number }> = [],
): ShotPlan {
  const facingLeft = targetX < wormX;
  const base = facingLeft ? -Math.PI : 0;
  // Angles grow from -π (left) to -0.08 (right), so left-facing adds and right-facing subtracts.
  const mirror = facingLeft ? 1 : -1;
  const offsets = [0.22, 0.5, 0.75, 1.0, 1.22, 1.42];
  let best: { score: number; angle: number; power: number } | null = null;

  for (const offset of offsets) {
    for (let power = 0.4; power <= 1.001; power += 0.06) {
      const angle = base + mirror * offset;
      const startX = wormX + Math.cos(angle) * 18;
      const startY = wormY - 14 + Math.sin(angle) * 18;
      const result = simulateShot(terrain, startX, startY, angle, power, 'bazooka', wind, null, false, bodies);
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

/**
 * Plan a whole AI turn: choose the weapon, the spot to fire from and the spot
 * to retreat to. Every weapon is evaluated with the real physics; damage to
 * enemies is weighed against damage to allies and the shooter.
 */
export function planAiTurn(input: AiTurnInput): AiTurnPlan | null {
  const { terrain, worm, worms, ammo, wind, timeLeft, difficulty, rng } = input;
  const enemies = worms.filter((w) => w.teamId !== worm.teamId);
  if (enemies.length === 0) return null;

  // Do not spend the whole turn walking: leave time to aim and fire.
  const moveBudget = Math.min(5, Math.max(0, timeLeft - 2)) * WORM.walkSpeed;
  const positions = firingPositions(terrain, worm, moveBudget);

  let best: (Candidate & { weapon: WeaponId; fireX: number }) | null = null;

  for (const weapon of ['bazooka', 'grenade', 'shotgun', 'dynamite'] as WeaponId[]) {
    if (WEAPONS[weapon].ammo !== null && ammo[weapon] <= 0) continue;
    for (const pos of positions) {
      const candidate =
        weapon === 'dynamite'
          ? planDrop(terrain, pos, worm, worms, enemies)
          : planProjectile(terrain, weapon, pos, worm, worms, enemies, wind);
      if (!candidate) continue;
      // Prefer a short walk when two plans do the same damage.
      candidate.score -= (Math.abs(pos.x - worm.x) / WORM.walkSpeed) * 0.4;
      if (!best || candidate.score > best.score) best = { ...candidate, weapon, fireX: pos.x };
    }
  }

  if (!best) return null;

  const jitterAngle = best.weapon === 'dynamite' ? 0 : (rng() * 2 - 1) * difficulty.angleError;
  const jitterPower = best.weapon === 'dynamite' ? 0 : (rng() * 2 - 1) * difficulty.powerError;

  return {
    weapon: best.weapon,
    fireX: best.fireX,
    angle: clampAngle(best.angle + jitterAngle),
    power: Math.min(1, Math.max(0.25, best.power + jitterPower)),
    retreatX: best.retreatX,
  };
}

function firingPositions(terrain: AiTerrain, worm: AiWorm, budget: number): Array<{ x: number; y: number }> {
  const xs = new Set<number>([worm.x]);
  for (let offset = 50; offset <= budget + 50; offset += 50) {
    xs.add(worm.x - offset);
    xs.add(worm.x + offset);
  }

  const positions: Array<{ x: number; y: number }> = [];
  for (const rawX of xs) {
    if (rawX < 20 || rawX > WORLD_W - 20) continue;
    const x = Math.round(rawX / 4) * 4;
    const ground =
      terrain.groundY(x, worm.y - 60, 200) ?? terrain.groundY(x, 120, WATER_Y - 120);
    // Walkable ground only: no water, no cliffs the worm cannot climb.
    if (ground === null || ground > WATER_Y - 30 || Math.abs(ground - worm.y) > 90) continue;
    positions.push({ x, y: ground });
  }
  return positions.sort((a, b) => Math.abs(a.x - worm.x) - Math.abs(b.x - worm.x));
}

function planProjectile(
  terrain: AiTerrain,
  weapon: WeaponId,
  pos: { x: number; y: number },
  worm: AiWorm,
  worms: AiWorm[],
  enemies: AiWorm[],
  wind: number,
): Candidate | null {
  const def = WEAPONS[weapon];
  const target = enemies.reduce((nearest, enemy) => {
    const d = Math.hypot(enemy.x - pos.x, enemy.y - pos.y);
    return d < nearest.d ? { enemy, d } : nearest;
  }, { enemy: enemies[0], d: Infinity }).enemy;
  const facingLeft = target.x < pos.x;
  const base = facingLeft ? -Math.PI : 0;
  // Angles grow from -π (left) to -0.08 (right), so left-facing adds and right-facing subtracts.
  const mirror = facingLeft ? 1 : -1;
  const offsets = [0.22, 0.5, 0.75, 1.0, 1.22, 1.42];
  const retreatX = chooseRetreat(terrain, pos, enemies, null, 0, RETREAT_SECONDS) ?? pos.x;
  const bodies = worms.filter((w) => w.id !== worm.id);
  let best: Candidate | null = null;

  for (const offset of offsets) {
    const angle = clampAngle(base + mirror * offset);
    const powers = weapon === 'shotgun' ? [1] : range(0.4, 1, 0.06);
    for (const power of powers) {
      const muzzleX = pos.x + Math.cos(angle) * 18;
      const muzzleY = pos.y - 14 + Math.sin(angle) * 18;
      const result = simulateShot(terrain, muzzleX, muzzleY, angle, power, weapon, wind, def.fuse, def.bounces, bodies);
      if (!result.valid) continue;
      const score = damageScore(result.x, result.y, weapon, worm, worms);
      if (!best || score > best.score) {
        best = { score, angle, power, retreatX };
      }
    }
  }
  return best;
}

function planDrop(
  terrain: AiTerrain,
  pos: { x: number; y: number },
  worm: AiWorm,
  worms: AiWorm[],
  enemies: AiWorm[],
): Candidate | null {
  const blast = { x: pos.x, y: pos.y - 8 };
  const safety = WEAPONS.dynamite.radius + WORM.radius + 6;
  const retreatX = chooseRetreat(terrain, pos, enemies, blast, safety, WEAPONS.dynamite.fuse ?? RETREAT_SECONDS);
  // Never plant dynamite without a way out of its own blast.
  if (retreatX === null) return null;
  return {
    score: damageScore(blast.x, blast.y, 'dynamite', worm, worms),
    angle: -0.5,
    power: 0.5,
    retreatX,
  };
}

/** Damage to enemies minus a penalty for friendly and self damage. */
function damageScore(x: number, y: number, weapon: WeaponId, shooter: AiWorm, worms: AiWorm[]): number {
  const def = WEAPONS[weapon];
  const reach = def.radius + WORM.radius;
  let enemy = 0;
  let ally = 0;
  let self = 0;

  for (const w of worms) {
    const distance = Math.hypot(w.x - x, w.y - 13 - y);
    const amount =
      weapon === 'shotgun'
        ? distance < 14 + WORM.radius * 0.4
          ? def.damage
          : 0
        : distance <= reach
          ? def.damage * Math.max(0.22, 1 - distance / reach)
          : 0;
    if (amount <= 0) continue;
    if (w.teamId !== shooter.teamId) enemy += amount;
    else if (w.id === shooter.id) self += amount;
    else ally += amount;
  }

  return enemy - ally * 0.9 - self * 0.85;
}

/**
 * Best walkable spot within the window, away from the enemy and (when given)
 * outside a blast. Returns null when no spot satisfies the blast constraint.
 */
function chooseRetreat(
  terrain: AiTerrain,
  from: { x: number; y: number },
  enemies: AiWorm[],
  blast: { x: number; y: number } | null,
  minBlastDistance: number,
  seconds: number,
): number | null {
  const reach = Math.max(0, seconds) * WORM.walkSpeed;
  let bestX: number | null = null;
  let bestScore = -Infinity;

  for (let offset = -reach; offset <= reach; offset += 24) {
    const x = Math.round(Math.min(WORLD_W - 20, Math.max(20, from.x + offset)) / 4) * 4;
    const ground = terrain.groundY(x, from.y - 80, 200);
    if (ground === null || ground > WATER_Y - 30 || Math.abs(ground - from.y) > 120) continue;

    const blastDistance = blast ? Math.hypot(x - blast.x, ground - 13 - blast.y) : Infinity;
    if (blastDistance < minBlastDistance) continue;

    const enemyDistance = enemies.length
      ? Math.min(...enemies.map((e) => Math.hypot(x - e.x, ground - 13 - e.y)))
      : 0;
    const highGround = (WATER_Y - ground) * 0.06;
    const score = Math.min(enemyDistance, 420) + (blast ? Math.min(blastDistance, 320) * 0.5 : 0) + highGround;

    if (score > bestScore) {
      bestScore = score;
      bestX = x;
    }
  }

  return bestX;
}

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) values.push(Number(value.toFixed(2)));
  return values;
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
