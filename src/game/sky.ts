import { WATER_Y, WORLD_H, WORLD_W } from './config';

/**
 * Paints the arena sky, sun, distant hills and water into a world-sized
 * context. Shared by the match renderer and the menu backdrop.
 */
export function paintSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  sky.addColorStop(0, '#0a141a');
  sky.addColorStop(0.42, '#1d3b47');
  sky.addColorStop(0.72, '#5f6a5a');
  sky.addColorStop(0.9, '#c98a52');
  sky.addColorStop(1, '#e8ad68');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const sun = ctx.createRadialGradient(928, 372, 8, 928, 372, 190);
  sun.addColorStop(0, 'rgba(255, 226, 160, 0.95)');
  sun.addColorStop(0.22, 'rgba(255, 190, 110, 0.5)');
  sun.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.beginPath();
  ctx.arc(928, 372, 46, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 232, 176, 0.9)';
  ctx.fill();

  // distant hills
  const hill = (color: string, base: number, amp: number, phase: number) => {
    ctx.beginPath();
    ctx.moveTo(0, WORLD_H);
    for (let x = 0; x <= WORLD_W; x += 12) {
      const y = base + Math.sin(x * 0.004 + phase) * amp + Math.sin(x * 0.011 + phase * 2) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WORLD_W, WORLD_H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  hill('rgba(26, 44, 48, 0.55)', 470, 26, 1.2);
  hill('rgba(16, 30, 34, 0.75)', 520, 20, 2.6);
  hill('rgba(10, 21, 24, 0.9)', 566, 14, 0.4);

  // water body
  const water = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  water.addColorStop(0, '#16323a');
  water.addColorStop(0.4, '#0d2229');
  water.addColorStop(1, '#071216');
  ctx.fillStyle = water;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i += 1) {
    const y = WATER_Y + 6 + i * 2.2;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(232, 173, 104, 0.5)' : 'rgba(120, 190, 190, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= WORLD_W; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
