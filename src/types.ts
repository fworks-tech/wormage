import type { EndReason } from './game/types';

export interface SessionConfig {
  turnSeconds: number;
  wind: 'off' | 'light' | 'strong';
  difficulty: 'rookie' | 'veteran' | 'elite';
  seed: number;
}

export interface SessionResult {
  winnerTeam: number | null;
  playerTeam: number;
  playerWon: boolean;
  score: number;
  durationSeconds: number;
  endReason: EndReason;
  kills: number;
  config: SessionConfig;
  recordedAt: string;
}

export type Screen = 'menu' | 'game' | 'result';
