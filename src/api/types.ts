import type { Difficulty, EndReason, WindSetting } from '../game/types';

export interface MatchRecord {
  id: string;
  clientMatchId: string;
  matchId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  score: number;
  durationSeconds: number;
  endReason: EndReason;
  configKey: string;
  turnSeconds: number;
  wind: WindSetting;
  difficulty: Difficulty;
  kills: number;
  createdAt: string;
}

export interface NewMatchInput {
  clientMatchId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  score: number;
  durationSeconds: number;
  endReason: EndReason;
  turnSeconds: number;
  wind: WindSetting;
  difficulty: Difficulty;
  kills: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  playerName: string;
  teamName: string;
  score: number;
  kills: number;
  durationSeconds: number;
  configKey: string;
  createdAt: string;
}

export type MockScenario = 'normal' | 'slow' | 'empty' | 'error';
