import { WORLD_H, WORLD_W } from './config';
import { cosmeticRng, Terrain } from './terrain';

/**
 * Canvas half of the terrain: paints the island once and punches craters into
 * the canvas whenever `Terrain.carve` changes the mask. Renderer-only.
 */
export class TerrainPainter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly terrain: Terrain) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WORLD_W;
    this.canvas.height = WORLD_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available in this browser');
    this.ctx = ctx;
    this.paint();
  }

  private paint(): void {
    const rng = cosmeticRng(this.terrain.seed);
    const ctx = this.ctx;
    const surface = (x: number): number => this.terrain.surfaceY(x);

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

    for (const s of this.terrain.shelves) {
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

    for (const s of this.terrain.shelves) {
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
      const top = surface(x);
      const y = top + 14 + rng() * (WORLD_H - top - 14);
      if (!this.terrain.isSolid(x, y)) continue;
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
        const y = surface(x) + offset + Math.sin(x * 0.012 + band) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  carve(x: number, y: number, radius: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Opaque: destination-out erases by source alpha, so an inherited translucent fill only tints.
    ctx.fillStyle = '#000';
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
  }
}
