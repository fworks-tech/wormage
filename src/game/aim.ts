import { AIM } from './config';

export interface AimTerrain {
  isSolid(x: number, y: number): boolean;
}

export interface AimPoint {
  x: number;
  y: number;
  /** True when the ray met terrain before the radius, so the reticle sits on it. */
  hitTerrain: boolean;
}

/**
 * The reticle is an aim indicator, not an impact prediction: it sits on a
 * fixed-radius circle around the worm, or on the first terrain point the ray
 * meets inside that circle (for example, aiming at the ground at its feet).
 */
export function aimPoint(
  terrain: AimTerrain,
  wormX: number,
  wormY: number,
  angle: number,
  radius: number = AIM.radius,
): AimPoint {
  const originX = wormX;
  const originY = wormY - 14;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let d = 4; d < radius; d += 2) {
    const x = originX + dirX * d;
    const y = originY + dirY * d;
    if (terrain.isSolid(x, y)) return { x, y, hitTerrain: true };
  }

  return { x: originX + dirX * radius, y: originY + dirY * radius, hitTerrain: false };
}
