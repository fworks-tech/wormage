export type WeaponId = 'bazooka' | 'grenade' | 'shotgun' | 'dynamite';
export type Difficulty = 'rookie' | 'veteran' | 'elite';
export type WindSetting = 'off' | 'light' | 'strong';
export type EndReason = 'time' | 'wipeout' | 'surrender';

export interface GameSettings {
  turnSeconds: number;
  wind: WindSetting;
  difficulty: Difficulty;
  sound: boolean;
}

export interface MatchConfig {
  turnSeconds: number;
  wind: WindSetting;
  difficulty: Difficulty;
  seed: number;
  wormsPerTeam: number;
}

/** Stable identifier for a ruleset. Used to compare like-for-like on the board. */
export function configKey(config: Pick<MatchConfig, 'turnSeconds' | 'wind' | 'difficulty'>): string {
  return `${config.turnSeconds}s-${config.wind}-${config.difficulty}`;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  glyph: string;
  ammo: number | null;
  damage: number;
  radius: number;
  terrainRadius: number;
  speedMin: number;
  speedMax: number;
  gravityScale: number;
  windScale: number;
  fuse: number | null;
  bounces: boolean;
  life: number | null;
  color: number;
  blurb: string;
}

export interface Worm {
  id: string;
  name: string;
  teamId: number;
  x: number;
  y: number;
  vy: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  facing: 1 | -1;
  aimAngle: number;
  onGround: boolean;
  fallDistance: number;
  airborne: boolean;
}

export interface Team {
  id: number;
  name: string;
  color: number;
  accent: string;
  isAi: boolean;
  worms: Worm[];
  ammo: Record<WeaponId, number>;
}

export interface Projectile {
  id: number;
  weapon: WeaponId;
  teamId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  fuse: number | null;
  trailTimer: number;
}

export type Phase = 'aim' | 'projectile' | 'settle' | 'gameover';

export type GameEvent =
  | { type: 'fire'; x: number; y: number; angle: number; weapon: WeaponId }
  | { type: 'explosion'; x: number; y: number; radius: number }
  | { type: 'hurt'; x: number; y: number; amount: number }
  | { type: 'death'; x: number; y: number; color: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'jump'; x: number; y: number }
  | { type: 'turn'; teamId: number; wormId: string }
  | { type: 'gameover'; winnerTeamId: number | null }
  | { type: 'shotgun'; x: number; y: number; angle: number }
  | { type: 'impact'; x: number; y: number };

export interface WormSnapshot {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  active: boolean;
  x: number;
  y: number;
}

export interface TeamSnapshot {
  id: number;
  name: string;
  accent: string;
  isAi: boolean;
  hp: number;
  maxHp: number;
  worms: WormSnapshot[];
  ammo: Record<WeaponId, number>;
}

export interface GameSnapshot {
  phase: Phase;
  turn: number;
  timeLeft: number;
  turnSeconds: number;
  wind: number;
  windLabel: string;
  activeTeam: number;
  activeWormId: string | null;
  activeWormName: string;
  aimAngle: number;
  power: number;
  charging: boolean;
  weapon: WeaponId;
  teams: TeamSnapshot[];
  winnerTeam: number | null;
  aiThinking: boolean;
}
