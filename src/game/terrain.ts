import { WATER_Y, WORLD_H, WORLD_W } from './config';

const CELL = 4;
export const COLS = Math.ceil(WORLD_W / CELL);
export const ROWS = Math.ceil(WORLD_H / CELL);

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothNoise(rng: () => number, points: number): (t: number) => number {
  const values = Array.from({ length: points + 1 }, () => rng());
  return (t: number) => {
    const clamped = Math.min(0.9999, Math.max(0, t)) * points;
    const i = Math.floor(clamped);
    const f = clamped - i;
    const eased = f * f * (3 - 2 * f);
    return values[i] * (1 - eased) + values[i + 1] * eased;
  };
}

export interface TerrainShelf {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Two floating shelves give the arena vertical play. */
const SHELVES: readonly TerrainShelf[] = [
  { x: WORLD_W * 0.33, y: 330, rx: 118, ry: 20 },
  { x: WORLD_W * 0.67, y: 286, rx: 96, ry: 17 },
];

/**
 * Destructible terrain as a coarse occupancy mask. Generation, collision and
 * craters live here; `TerrainPainter` draws the matching canvas.
 */
export class Terrain {
  readonly mask = new Uint8Array(COLS * ROWS);
  readonly shelves = SHELVES;
  readonly seed: number;
  /** Fired after the mask changes, so the painter can punch the same hole. */
  onCarve: ((x: number, y: number, radius: number) => void) | null = null;
  private readonly surfaceAt: (x: number) => number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const rng = mulberry32(this.seed);
    const big = smoothNoise(rng, 7);
    const medium = smoothNoise(rng, 16);
    const small = smoothNoise(rng, 42);

    this.surfaceAt = (x: number): number => {
      const t = x / WORLD_W;
      const rise = Math.sin(t * Math.PI) * 42;
      return (
        452 +
        big(t) * 110 +
        medium(t) * 46 +
        small(t) * 14 -
        rise +
        Math.abs(x - WORLD_W / 2) * 0.03
      );
    };

    for (let cx = 0; cx < COLS; cx += 1) {
      const x = cx * CELL + CELL / 2;
      const top = Math.max(140, Math.min(WATER_Y - 26, this.surfaceAt(x)));
      const startRow = Math.floor(top / CELL);
      for (let cy = startRow; cy < ROWS; cy += 1) this.mask[cy * COLS + cx] = 1;
    }

    for (const s of this.shelves) {
      for (let cy = 0; cy < ROWS; cy += 1) {
        const y = cy * CELL + CELL / 2;
        for (let cx = 0; cx < COLS; cx += 1) {
          const x = cx * CELL + CELL / 2;
          const dx = (x - s.x) / s.rx;
          const dy = (y - s.y) / s.ry;
          if (dx * dx + dy * dy <= 1) this.mask[cy * COLS + cx] = 1;
        }
      }
    }
  }

  surfaceY(x: number): number {
    return this.surfaceAt(x);
  }

  isSolid(px: number, py: number): boolean {
    if (px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) return false;
    const cx = (px / CELL) | 0;
    const cy = (py / CELL) | 0;
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
    return this.mask[cy * COLS + cx] === 1;
  }

  /** First solid y at x, scanning down from fromY for maxDown px. */
  groundY(x: number, fromY: number, maxDown = 260): number | null {
    if (x < 0 || x >= WORLD_W) return null;
    const start = Math.max(0, Math.floor(fromY / CELL));
    const end = Math.min(ROWS - 1, Math.ceil((fromY + maxDown) / CELL));
    const cx = Math.min(COLS - 1, Math.max(0, (x / CELL) | 0));
    for (let cy = start; cy <= end; cy += 1) {
      if (this.mask[cy * COLS + cx] === 1) return cy * CELL;
    }
    return null;
  }

  randomGroundX(rng: () => number, minX: number, maxX: number): { x: number; y: number } {
    for (let i = 0; i < 60; i += 1) {
      const x = minX + rng() * (maxX - minX);
      const y = this.groundY(x, 120, WATER_Y - 120);
      if (y !== null && y < WATER_Y - 40) return { x, y };
    }
    return { x: (minX + maxX) / 2, y: 480 };
  }

  carve(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let cy = 0; cy < ROWS; cy += 1) {
      const wy = cy * CELL + CELL / 2;
      const dy = wy - y;
      if (Math.abs(dy) > radius) continue;
      for (let cx = 0; cx < COLS; cx += 1) {
        const wx = cx * CELL + CELL / 2;
        const dx = wx - x;
        if (dx * dx + dy * dy <= r2) this.mask[cy * COLS + cx] = 0;
      }
    }
    this.onCarve?.(x, y, radius);
  }
}
