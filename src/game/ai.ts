import {
  AIM,
  BOUNCE,
  GRAVITY,
  JUMP_REACH,
  PREVIEW_SECONDS,
  PROJECTILE_GRAVITY,
  RETREAT_SECONDS,
  ROPE,
  WATER_Y,
  WEAPON_ORDER,
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
  fireY: number;
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
 * Sample a shot's path for the dotted aim preview. Each point runs the shared
 * integrator up to its own slice of the weapon's horizon, so a fuse-less
 * weapon traces an arc instead of collapsing every dot on its impact point.
 */
export function previewFlight(
  terrain: AiTerrain,
  startX: number,
  startY: number,
  angle: number,
  power: number,
  weapon: WeaponId,
  wind: number,
  steps = 16,
): Array<{ x: number; y: number }> {
  const def = WEAPONS[weapon];
  const horizon = def.fuse ?? def.life ?? PREVIEW_SECONDS;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= steps; i += 1) {
    const point = simulateShot(
      terrain,
      startX,
      startY,
      angle,
      power,
      weapon,
      wind,
      (horizon * i) / steps,
      def.bounces,
    );
    const previous = points[points.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 2) continue;
    points.push({ x: point.x, y: point.y });
  }
  return points;
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
  // The rope extends the AI's climb beyond a jump.
  const positions = firingPositions(terrain, worm, moveBudget, ROPE.range);

  let best: (Candidate & { weapon: WeaponId; fireX: number; fireY: number }) | null = null;

  for (const weapon of WEAPON_ORDER) {
    const def = WEAPONS[weapon];
    if (def.ammo !== null && ammo[weapon] <= 0) continue;
    for (const pos of positions) {
      const candidate =
        def.kind === 'drop'
          ? planDrop(terrain, weapon, pos, worm, worms, enemies)
          : planProjectile(terrain, weapon, pos, worm, worms, enemies, wind);
      if (!candidate) continue;
      // Prefer a short walk when two plans do the same damage.
      candidate.score -= (Math.abs(pos.x - worm.x) / WORM.walkSpeed) * 0.4;
      if (!best || candidate.score > best.score) {
        best = { ...candidate, weapon, fireX: pos.x, fireY: pos.y };
      }
    }
  }

  if (!best) return null;

  // Drops are placed, not aimed: error jitter would move a shot that has no direction.
  const isDrop = WEAPONS[best.weapon].kind === 'drop';
  const jitterAngle = isDrop ? 0 : (rng() * 2 - 1) * difficulty.angleError;
  const jitterPower = isDrop ? 0 : (rng() * 2 - 1) * difficulty.powerError;

  return {
    weapon: best.weapon,
    fireX: best.fireX,
    fireY: best.fireY,
    angle: clampAngle(best.angle + jitterAngle),
    power: Math.min(1, Math.max(0.25, best.power + jitterPower)),
    retreatX: best.retreatX,
  };
}

export interface RopeClimbPlan {
  angle: number;
  anchorX: number;
  anchorY: number;
  length: number;
}

/**
 * Pick an aim angle whose ray hits terrain above `targetY`, so the CPU can
 * rope over a ledge that is higher than a jump.
 */
export function planRopeClimb(
  terrain: AiTerrain,
  worm: AiWorm,
  targetX: number,
  targetY: number,
  range = ROPE.range,
): RopeClimbPlan | null {
  const originY = worm.y - 14;
  const facingRight = targetX >= worm.x;
  const base = facingRight ? 0 : -Math.PI;
  const mirror = facingRight ? -1 : 1;
  let best: (RopeClimbPlan & { score: number }) | null = null;

  for (let offset = 0.25; offset <= 1.45; offset += 0.05) {
    const angle = clampAngle(base + mirror * offset);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    for (let distance = 12; distance <= range; distance += 4) {
      const x = worm.x + dirX * distance;
      const y = originY + dirY * distance;
      if (!terrain.isSolid(x, y)) continue;
      // The anchor must sit above the landing surface and above the worm.
      if (y > targetY - 20 || y > worm.y - 30) break;
      const score = Math.abs(x - targetX) + Math.max(0, targetY - 20 - y) * 0.15;
      if (!best || score < best.score) {
        best = { angle, anchorX: x, anchorY: y, length: distance, score };
      }
      break;
    }
  }

  return best
    ? { angle: best.angle, anchorX: best.anchorX, anchorY: best.anchorY, length: best.length }
    : null;
}

export function firingPositions(
  terrain: AiTerrain,
  worm: AiWorm,
  budget: number,
  maxClimb = JUMP_REACH,
): Array<{ x: number; y: number }> {
  const xs = new Set<number>([worm.x]);
  for (let offset = 50; offset <= budget + 50; offset += 50) {
    xs.add(worm.x - offset);
    xs.add(worm.x + offset);
  }

  const positions: Array<{ x: number; y: number }> = [];
  // Start above the highest pixel the worm can climb; a column that is already
  // solid there is a cliff beyond reach.
  const scanTop = Math.max(0, worm.y - maxClimb - 12);
  for (const rawX of xs) {
    if (rawX < 20 || rawX > WORLD_W - 20) continue;
    const x = Math.round(rawX / 4) * 4;
    const top = terrain.groundY(x, scanTop, WATER_Y - scanTop);
    if (top === null || top > WATER_Y - 30) continue;
    // A shelf above the worm is not the ground it walks on; keep the surface
    // below its feet when the column at the top is an overhang.
    let ground = top;
    if (top < worm.y - 8) {
      const under = terrain.groundY(x, worm.y - 18, WATER_Y - (worm.y - 18));
      if (under !== null && under >= worm.y - 8 && under <= WATER_Y - 30) ground = under;
    }
    // Walkable ground only: no water, no cliff above reach, no damaging drop.
    if (worm.y - ground > maxClimb || ground - worm.y > WORM.fallSafePx) continue;
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
  weapon: WeaponId,
  pos: { x: number; y: number },
  worm: AiWorm,
  worms: AiWorm[],
  enemies: AiWorm[],
): Candidate | null {
  const def = WEAPONS[weapon];
  const blast = { x: pos.x, y: pos.y - 8 };
  const safety = def.radius + WORM.radius + 6;
  const retreatX = chooseRetreat(terrain, pos, enemies, blast, safety, def.fuse ?? RETREAT_SECONDS);
  // Never plant a drop without a way out of its own blast.
  if (retreatX === null) return null;
  const target = enemies.reduce((nearest, enemy) => {
    const d = Math.hypot(enemy.x - pos.x, enemy.y - pos.y);
    return d < nearest.d ? { enemy, d } : nearest;
  }, { enemy: enemies[0], d: Infinity }).enemy;
  return {
    score: damageScore(blast.x, blast.y, weapon, worm, worms),
    // Drops ignore the angle in flight, but the worm and its weapon should face the enemy.
    angle: target.x < pos.x ? mirrorAngle(-0.5) : -0.5,
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
export function chooseRetreat(
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
    if (!walkablePath(terrain, from, x)) continue;

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

/**
 * True when the worm can walk from `from` to `toX` without hitting a wall or
 * dropping into water. Checks the body height the engine walks at.
 */
function walkablePath(terrain: AiTerrain, from: { x: number; y: number }, toX: number): boolean {
  const dir = Math.sign(toX - from.x);
  let y = from.y;
  for (let x = from.x; dir !== 0 && (dir > 0 ? x < toX : x > toX); ) {
    x = dir > 0 ? Math.min(x + 4, toX) : Math.max(x - 4, toX);
    // shortcut: a ledge counts as blocked rather than measuring the fall, so
    // the AI may skip a safe drop-down retreat; revisit with a real walk sim.
    const ground = terrain.groundY(x, y - 18, 260);
    if (ground === null || ground > WATER_Y - 30) return false;
    if (terrain.isSolid(x, ground - 12)) return false;
    y = ground;
  }
  return true;
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
  return Math.min(AIM.max, Math.max(AIM.min, a));
}

/** Keep the fall math shared between worms and projectiles. */
export const PHYSICS = { gravity: GRAVITY, waterY: WATER_Y, windAccel: WIND_ACCEL, worm: WORM };
