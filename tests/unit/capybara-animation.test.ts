import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAPYBARA_FRAME_COUNTS,
  CAPYBARA_FRAME_SIZE,
  selectCapybaraFrame,
} from '../../src/game/capybara-animation';
import { WATER_Y } from '../../src/game/config';

const base = {
  airborne: false,
  onGround: true,
  alive: true,
  y: 400,
  isActive: true,
  moveDir: 0 as const,
  time: 0,
  attackFrame: null,
};

describe('capybara animation frame selection', () => {
  it('defines the frame counts and cell size of the supplied atlas', () => {
    expect(CAPYBARA_FRAME_COUNTS).toEqual({ walk: 6, jump: 5, bath: 4, attack: 8 });
    expect(CAPYBARA_FRAME_SIZE).toEqual({ width: 128, height: 96 });

    const bytes = readFileSync(new URL('../../src/assets/capybara-atlas.png', import.meta.url));
    expect(bytes.subarray(0, 8).toString('hex'), 'PNG signature').toBe('89504e470d0a1a0a');
    expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toEqual({
      width: CAPYBARA_FRAME_SIZE.width * 8,
      height: CAPYBARA_FRAME_SIZE.height * 4,
    });
  });

  it('cycles walking frames only while the active worm moves on the ground', () => {
    expect(selectCapybaraFrame({ ...base, moveDir: 1, time: 0.23 })).toEqual({ animation: 'walk', frame: 2 });
    expect(selectCapybaraFrame({ ...base, isActive: false, moveDir: 1, time: 0.23 })).toEqual({
      animation: 'walk',
      frame: 0,
    });
  });

  it('uses the jump sequence while airborne', () => {
    expect(selectCapybaraFrame({ ...base, airborne: true, onGround: false, time: 0.5 })).toEqual({
      animation: 'jump',
      frame: 4,
    });
  });

  it('uses the attack frame supplied by the fire animation timer', () => {
    expect(selectCapybaraFrame({ ...base, attackFrame: 6 })).toEqual({ animation: 'attack', frame: 6 });
  });

  it('clamps attack frames and bathes only when idle near the water line', () => {
    expect(selectCapybaraFrame({ ...base, attackFrame: 99 })).toEqual({ animation: 'attack', frame: 7 });
    expect(selectCapybaraFrame({ ...base, y: WATER_Y - 8, time: 0.3 })).toEqual({
      animation: 'bath',
      frame: 2,
    });
    // Walking near the shore keeps the walk cycle; bath frames never move a worm.
    expect(selectCapybaraFrame({ ...base, y: WATER_Y - 8, moveDir: 1, time: 0.23 })).toEqual({
      animation: 'walk',
      frame: 2,
    });
  });
});
