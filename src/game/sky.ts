import { WATER_Y, WORLD_H, WORLD_W } from './config';

/**
 * Paints the arena sky, sun, distant hills and water into a world-sized
 * context. Shared by the match renderer and the menu backdrop.
 */
export function paintSky(ctx: CanvasRenderingContext2D): void {
  ctx.save();

  const sky = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  sky.addColorStop(0, '#0a141a');
  sky.addColorStop(0.38, '#1d3b47');
  sky.addColorStop(0.7, '#5f6a5a');
  sky.addColorStop(0.9, '#c98a52');
  sky.addColorStop(1, '#e8ad68');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const sunGlow = ctx.createRadialGradient(928, 372, 8, 928, 372, 230);
  sunGlow.addColorStop(0, 'rgba(255, 226, 160, 0.95)');
  sunGlow.addColorStop(0.22, 'rgba(255, 190, 110, 0.46)');
  sunGlow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.beginPath();
  ctx.arc(928, 372, 46, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 232, 176, 0.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(914, 357, 35, Math.PI * 1.05, Math.PI * 1.55);
  ctx.strokeStyle = 'rgba(255, 249, 220, 0.42)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Distant hills establish depth behind the destructible island.
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
  hill('rgba(26, 44, 48, 0.42)', 470, 26, 1.2);
  hill('rgba(16, 30, 34, 0.68)', 520, 20, 2.6);
  hill('rgba(10, 21, 24, 0.84)', 566, 14, 0.4);

  // A restrained Rustbelt skyline gives the arena a place-specific silhouette.
  ctx.save();
  ctx.translate(0, -120);
  ctx.fillStyle = 'rgba(12, 24, 25, 0.62)';
  ctx.fillRect(150, 587, 124, 86);
  ctx.fillRect(165, 565, 43, 108);
  ctx.fillRect(178, 526, 16, 147);
  ctx.fillRect(214, 548, 24, 125);
  ctx.fillRect(1006, 578, 142, 95);
  ctx.fillRect(1024, 548, 30, 125);
  ctx.fillRect(1088, 534, 17, 139);
  ctx.fillRect(1120, 560, 20, 113);
  ctx.fillRect(260, 610, 46, 63);
  ctx.fillRect(970, 605, 50, 68);

  // Catwalks and stack caps make the silhouette read as old industrial ruins.
  ctx.fillRect(201, 582, 57, 5);
  ctx.fillRect(1052, 574, 37, 5);
  ctx.fillRect(174, 523, 24, 5);
  ctx.fillRect(1084, 531, 25, 5);
  ctx.fillStyle = 'rgba(241, 166, 91, 0.4)';
  ctx.fillRect(181, 553, 4, 5);
  ctx.fillRect(181, 568, 4, 5);
  ctx.fillRect(1032, 566, 5, 5);
  ctx.fillRect(1032, 582, 5, 5);
  ctx.fillRect(1094, 552, 5, 5);
  ctx.restore();

  // Water body and subtle sunset reflections.
  const water = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  water.addColorStop(0, '#16323a');
  water.addColorStop(0.4, '#0d2229');
  water.addColorStop(1, '#071216');
  ctx.fillStyle = water;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);

  const reflection = ctx.createLinearGradient(690, 0, 1110, 0);
  reflection.addColorStop(0, 'rgba(255, 190, 110, 0)');
  reflection.addColorStop(0.5, 'rgba(255, 190, 110, 0.11)');
  reflection.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = reflection;
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
  ctx.restore();
}
