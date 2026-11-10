import type { AiTerrain } from '../../src/game/ai';

/** Flat ground at y = 500, or a wall from x = wallX. No canvas needed. */
export const terrain = (wallX = Infinity): AiTerrain => ({
  isSolid: (x, y) => y >= 500 || x >= wallX,
  groundY: (_x, fromY, maxDown = 260) => (fromY <= 500 && fromY + maxDown >= 500 ? 500 : null),
});

/** Air with no hit surface: a shot only stops on fuse, life or the arena bounds. */
export const openTerrain: AiTerrain = {
  isSolid: () => false,
  groundY: () => null,
};
