import { DEFAULT_SETTINGS, sanitizeSettings } from '../game/config';
import type { GameSettings } from '../game/types';
import { DEFAULT_BINDINGS, sanitizeBindings, type Bindings } from './bindings';

const SETTINGS_KEY = 'wormage.settings.v1';
const BINDINGS_KEY = 'wormage.bindings.v1';
const LAST_RESULT_KEY = 'wormage.lastResult.v1';
const PLAYER_KEY = 'wormage.player.v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
  } catch {
    // storage can be unavailable in private modes; the session still works
  }
}

export function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    return sanitizeBindings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(bindings: Bindings): void {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(sanitizeBindings(bindings)));
  } catch {
    // storage can be unavailable in private modes; the session still works
  }
}

export function loadLastResult<T>(): T | null {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveLastResult<T>(result: T): void {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  } catch {
    // ignore
  }
}

export interface PlayerIdentity {
  id: string;
  name: string;
}

export function loadPlayer(): PlayerIdentity {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerIdentity;
      if (parsed?.id && parsed?.name) return parsed;
    }
  } catch {
    // fall through to a fresh identity
  }
  const player: PlayerIdentity = {
    id: `player-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Field Commander',
  };
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // ignore
  }
  return player;
}

export function savePlayer(player: PlayerIdentity): void {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // ignore
  }
}
