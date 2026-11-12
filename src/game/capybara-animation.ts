import { WATER_Y } from './config';

/** Frame layout of `src/assets/capybara-atlas.png`, checked against the image. */
export const CAPYBARA_FRAME_SIZE = { width: 128, height: 96 } as const;

/** Row frame counts: walk, jump, bath and bazooka attack. */
export const CAPYBARA_FRAME_COUNTS = {
  walk: 6,
  jump: 5,
  bath: 4,
  attack: 8,
} as const;

export type CapybaraAnimationName = keyof typeof CAPYBARA_FRAME_COUNTS;

export interface CapybaraFrameState {
  airborne: boolean;
  onGround: boolean;
  alive: boolean;
  y: number;
  isActive: boolean;
  moveDir: -1 | 0 | 1;
  time: number;
  attackFrame: number | null;
}

export interface CapybaraFrame {
  animation: CapybaraAnimationName;
  frame: number;
}

/** Selects a visual frame only; the engine remains authoritative for movement. */
export function selectCapybaraFrame(state: CapybaraFrameState): CapybaraFrame {
  if (state.alive && state.attackFrame !== null) {
    return {
      animation: 'attack',
      frame: Math.max(0, Math.min(CAPYBARA_FRAME_COUNTS.attack - 1, state.attackFrame)),
    };
  }

  if (state.airborne) {
    return { animation: 'jump', frame: Math.floor(state.time * 8) % CAPYBARA_FRAME_COUNTS.jump };
  }

  // Bath frames are visual only; the engine still drowns at WATER_Y.
  if (state.alive && state.onGround && state.y >= WATER_Y - 12 && state.moveDir === 0) {
    return { animation: 'bath', frame: Math.floor(state.time * 7) % CAPYBARA_FRAME_COUNTS.bath };
  }

  if (state.alive && state.onGround && state.isActive && state.moveDir !== 0) {
    return { animation: 'walk', frame: Math.floor(state.time * 9) % CAPYBARA_FRAME_COUNTS.walk };
  }

  return { animation: 'walk', frame: 0 };
}
