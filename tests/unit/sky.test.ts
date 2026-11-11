import { describe, expect, it } from 'vitest';
import { SKYLINE_BLOCKS, SKYLINE_OFFSET } from '../../src/game/sky';
import { Terrain } from '../../src/game/terrain';

const tallestStack = (side: 'left' | 'right') =>
  SKYLINE_BLOCKS.filter(([x]) => (side === 'left' ? x < 640 : x >= 640)).reduce((a, b) => (b[1] < a[1] ? b : a));

describe('skyline composition', () => {
  it('keeps both tallest stacks clear of the island surface', () => {
    const hidden: string[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const terrain = new Terrain(seed);
      for (const side of ['left', 'right'] as const) {
        const [x, y] = tallestStack(side);
        const visible = terrain.surfaceY(x) - (y + SKYLINE_OFFSET);
        if (visible < 24) hidden.push(`${side} stack, seed ${seed}: ${visible.toFixed(0)}px`);
      }
    }
    expect(hidden).toEqual([]);
  });
});
