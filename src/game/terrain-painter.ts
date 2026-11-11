import { WATER_Y, WORLD_H, WORLD_W } from './config';
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
    dirt.addColorStop(0, '#866044');
    dirt.addColorStop(0.28, '#68452e');
    dirt.addColorStop(0.68, '#40291e');
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

    // Grass line, with a darker underside and a sunlit edge for stronger depth.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3f6332';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(0, surface(0) + 6);
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x) + 6);
    ctx.stroke();
    ctx.strokeStyle = '#587f3d';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(0, surface(0) + 3);
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x) + 3);
    ctx.stroke();
    ctx.strokeStyle = '#91bd60';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, surface(0));
    for (let x = 0; x <= WORLD_W; x += 6) ctx.lineTo(x, surface(x));
    ctx.stroke();

    for (const s of this.terrain.shelves) {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#68452e';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 4, s.rx - 3, s.ry - 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#587f3d';
      ctx.fill();
    }

    // Seeded grass tufts add a hand-painted edge without changing collision pixels.
    ctx.lineCap = 'round';
    for (let x = 8; x <= WORLD_W; x += 18) {
      const bladeX = x + (rng() - 0.5) * 8;
      const y = surface(bladeX) + 1;
      const height = 4 + rng() * 5;
      ctx.strokeStyle = rng() > 0.52 ? '#9fc66a' : '#547d3e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bladeX, y + 2);
      ctx.lineTo(bladeX - 2 - rng() * 2, y - height);
      ctx.moveTo(bladeX, y + 2);
      ctx.lineTo(bladeX + 1 + rng() * 3, y - height * 0.72);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Dirt texture: small pebbles, warm mineral flecks and layered strata.
    for (let i = 0; i < 900; i += 1) {
      const x = rng() * WORLD_W;
      const top = surface(x);
      const y = top + 14 + rng() * (WORLD_H - top - 14);
      if (!this.terrain.isSolid(x, y)) continue;
      const shade = rng();
      ctx.fillStyle = shade > 0.5 ? 'rgba(255,220,180,0.075)' : 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, 1 + rng() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 2;
    for (let band = 0; band < 6; band += 1) {
      const offset = 150 + band * 78;
      ctx.strokeStyle = band % 2 === 0 ? 'rgba(0,0,0,0.13)' : 'rgba(231,174,119,0.075)';
      ctx.beginPath();
      for (let x = 0; x <= WORLD_W; x += 24) {
        const y = surface(x) + offset + Math.sin(x * 0.012 + band) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // The island meets the water at WATER_Y: clear the canvas below it so the
    // sky's water and the renderer's water layer show through. Opaque fill:
    // destination-out erases by source alpha, and the pebble fills are translucent.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
    ctx.globalCompositeOperation = 'source-over';
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
