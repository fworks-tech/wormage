import { configKey } from './types';
import type { Difficulty, GameSettings, WeaponDef, WeaponId, WindSetting } from './types';

export const WORLD_W = 1280;
export const WORLD_H = 720;
export const WATER_Y = 668;

export const GRAVITY = 780;
export const PROJECTILE_GRAVITY = 520;
export const WIND_FACTOR = 0.9;
export const BOUNCE = { x: 0.45, y: 0.42 } as const;
export const WIND_ACCEL: Record<WindSetting, number> = {
  off: 0,
  light: 46,
  strong: 105,
};

export const WORM = {
  radius: 11,
  walkSpeed: 74,
  jumpVelocity: 300,
  maxHp: 100,
  fallSafePx: 150,
  fallDamagePerPx: 0.16,
  maxJumpsPerTurn: 2,
} as const;

export const AIM = {
  min: -3.04,
  max: -0.1,
  rate: 1.35,
  radius: 130,
} as const;

/** Simulation step. Gameplay math advances only in these steps (ADR 0005). */
export const FIXED_DT = 1 / 60;

export const CHARGE_SECONDS = 1.1;

/** Movement window after firing, before the turn passes. */
export const RETREAT_SECONDS = 3;

/** Free-flight span the dotted aim preview samples for weapons with no fuse or life. */
export const PREVIEW_SECONDS = 3;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bazooka: {
    id: 'bazooka',
    kind: 'projectile',
    name: 'Bazooka',
    glyph: '➤',
    ammo: null,
    damage: 42,
    radius: 48,
    terrainRadius: 42,
    speedMin: 260,
    speedMax: 830,
    gravityScale: 1,
    windScale: 1,
    fuse: null,
    bounces: false,
    life: null,
    color: 0xffd166,
    blurb: 'Reliable arc, unlimited rockets. Mind the wind.',
  },
  grenade: {
    id: 'grenade',
    kind: 'projectile',
    name: 'Grenade',
    glyph: '●',
    ammo: 3,
    damage: 52,
    radius: 54,
    terrainRadius: 46,
    speedMin: 240,
    speedMax: 760,
    gravityScale: 1,
    windScale: 0.8,
    fuse: 3,
    bounces: true,
    life: null,
    color: 0x9ee37d,
    blurb: 'Bounces off dirt, detonates after three seconds.',
  },
  shotgun: {
    id: 'shotgun',
    kind: 'projectile',
    name: 'Shotgun',
    glyph: '╾',
    ammo: 4,
    damage: 24,
    radius: 12,
    terrainRadius: 9,
    speedMin: 1500,
    speedMax: 1500,
    gravityScale: 0.08,
    windScale: 0,
    fuse: null,
    bounces: false,
    life: 0.34,
    color: 0xf2b8a2,
    blurb: 'Flat and fast. No arc, no excuses.',
  },
  dynamite: {
    id: 'dynamite',
    kind: 'drop',
    name: 'Dynamite',
    glyph: '▮',
    ammo: 2,
    damage: 78,
    radius: 78,
    terrainRadius: 66,
    speedMin: 0,
    speedMax: 0,
    gravityScale: 1,
    windScale: 0,
    fuse: 2.2,
    bounces: false,
    life: null,
    color: 0xff6b5b,
    blurb: 'Drops at your feet. Run. Two second fuse.',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['bazooka', 'grenade', 'shotgun', 'dynamite'];

export const TEAMS = [
  { name: 'Ironclad', color: 0xf05d8f, accent: '#f05d8f', isAi: false },
  { name: 'Rustbelt', color: 0x4ad6d0, accent: '#4ad6d0', isAi: true },
] as const;

export const DIFFICULTY: Record<
  Difficulty,
  { label: string; angleError: number; powerError: number; blurb: string }
> = {
  rookie: { label: 'Rookie', angleError: 0.075, powerError: 0.09, blurb: 'Loose aim, forgiving.' },
  veteran: { label: 'Veteran', angleError: 0.035, powerError: 0.045, blurb: 'Reads the wind.' },
  elite: { label: 'Elite', angleError: 0.012, powerError: 0.015, blurb: 'Almost no mercy.' },
};

export const TURN_SECONDS = { min: 20, max: 90, step: 5 } as const;

export const DEFAULT_SETTINGS: GameSettings = {
  turnSeconds: 45,
  wind: 'light',
  difficulty: 'veteran',
  sound: true,
};

export function sanitizeSettings(input: Partial<GameSettings> | null | undefined): GameSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  const turns = Number(merged.turnSeconds);
  return {
    turnSeconds: Number.isFinite(turns)
      ? Math.min(TURN_SECONDS.max, Math.max(TURN_SECONDS.min, Math.round(turns / TURN_SECONDS.step) * TURN_SECONDS.step))
      : DEFAULT_SETTINGS.turnSeconds,
    wind: merged.wind === 'off' || merged.wind === 'light' || merged.wind === 'strong' ? merged.wind : 'light',
    difficulty:
      merged.difficulty === 'rookie' || merged.difficulty === 'veteran' || merged.difficulty === 'elite'
        ? merged.difficulty
        : 'veteran',
    sound: Boolean(merged.sound),
  };
}

export function worldClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function windLabel(wind: number): string {
  const speed = Math.abs(wind);
  if (speed < 6) return 'calm';
  const dir = wind > 0 ? '→' : '←';
  if (speed < 35) return `breeze ${dir}`;
  if (speed < 75) return `gust ${dir}`;
  return `gale ${dir}`;
}

/** Human-readable ruleset label, mirrored in the menu and the archive tables. */
export function configLabel(settings: Pick<GameSettings, 'turnSeconds' | 'wind' | 'difficulty'>): string {
  return `${settings.turnSeconds}s · ${settings.wind} wind · ${DIFFICULTY[settings.difficulty].label}`;
}

export function configKeyFrom(settings: Pick<GameSettings, 'turnSeconds' | 'wind' | 'difficulty'>): string {
  return configKey(settings);
}
