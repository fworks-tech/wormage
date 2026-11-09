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

/**
 * Destructible terrain backed by a coarse occupancy mask (collision) plus a
 * full-resolution canvas (rendering). Craters punch through both.
 */
export class Terrain {
  readonly mask = new Uint8Array(COLS * ROWS);
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly seed: number;
  onCarve: (() => void) | null = null;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WORLD_W;
    this.canvas.height = WORLD_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available in this browser');
    this.ctx = ctx;
    this.paint();
  }

  private paint(): void {
    const rng = mulberry32(this.seed);
    const big = smoothNoise(rng, 7);
    const medium = smoothNoise(rng, 16);
    const small = smoothNoise(rng, 42);
    const ctx = this.ctx;

    const surface = (x: number): number => {
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
    this.surfaceAt = surface;

    for (let cx = 0; cx < COLS; cx += 1) {
      const x = cx * CELL + CELL / 2;
      const top = Math.max(140, Math.min(WATER_Y - 26, surface(x)));
      const startRow = Math.floor(top / CELL);
      for (let cy = startRow; cy < ROWS; cy += 1) this.mask[cy * COLS + cx] = 1;
    }

    // Two floating shelves give the arena vertical play.
    const shelves = [
      { x: WORLD_W * 0.33, y: 330, rx: 118, ry: 20 },
      { x: WORLD_W * 0.67, y: 286, rx: 96, ry: 17 },
    ];
    for (const s of shelves) {
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

    const dirt = ctx.createLinearGradient(0, 240, 0, WORLD_H);
    dirt.addColorStop(0, '#7a5335');
    dirt.addColorStop(0.35, '#5d3d28');
    dirt.addColorStop(0.75, '#3a2519');
    dirt.addColorStop(1, '#1b100b');
    ctx.fillStyle = dirt;

    ctx.beginPath();
    ctx.moveTo(0, surface(0));
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x));
    ctx.lineTo(WORLD_W, WORLD_H);
    ctx.lineTo(0, WORLD_H);
    ctx.closePath();
    ctx.fill();

    for (const s of shelves) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass line, then a lighter highlight along the very top.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4f7a37';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(0, surface(0) + 4);
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x) + 4);
    ctx.stroke();
    ctx.strokeStyle = '#7bab4c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, surface(0));
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x));
    ctx.stroke();

    for (const s of shelves) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5d3d28';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 4, s.rx - 3, s.ry - 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#4f7a37';
      ctx.fill();
    }

    // Dirt texture: pebbles and strata.
    for (let i = 0; i < 900; i += 1) {
      const x = rng() * WORLD_W;
      const top = this.surfaceAt(x);
      const y = top + 14 + rng() * (WORLD_H - top - 14);
      if (!this.isSolid(x, y)) continue;
      const shade = rng();
      ctx.fillStyle = shade > 0.5 ? 'rgba(255,220,180,0.06)' : 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, 1 + rng() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 2;
    for (let band = 0; band < 6; band += 1) {
      const offset = 150 + band * 78;
      ctx.beginPath();
      for (let x = 0; x <= WORLD_W; x += 24) {
        const y = this.surfaceAt(x) + offset + Math.sin(x * 0.012 + band) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private surfaceAt: (x: number) => number = () => 480;

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

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Scorched rim, clipped to remaining dirt.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(26, 16, 10, 0.55)';
    ctx.lineWidth = Math.max(4, radius * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    this.onCarve?.();
  }
}
