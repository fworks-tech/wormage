import { beforeEach, expect, test } from 'vitest';
import {
  keyOf,
  listLeaderboard,
  listMatches,
  MOCK_TOTAL_FIXTURES,
  registerMatch,
  resetMockData,
} from '../../src/api/mockServer';
import type { NewMatchInput } from '../../src/api/types';

const match = (clientMatchId: string, score: number): NewMatchInput => ({
  clientMatchId,
  playerId: 'p-test',
  playerName: 'Tester',
  teamName: 'Ironclad',
  score,
  durationSeconds: 60,
  endReason: 'wipeout',
  turnSeconds: 45,
  wind: 'light',
  difficulty: 'veteran',
  kills: 2,
});

beforeEach(() => resetMockData());

test('the leaderboard paginates and ranks the fixtures', () => {
  const first = listLeaderboard(1, 3);
  const second = listLeaderboard(2, 3);
  expect(first.total).toBe(MOCK_TOTAL_FIXTURES);
  expect(first.items.map((row) => row.rank)).toEqual([1, 2, 3]);
  expect(second.items.map((row) => row.rank)).toEqual([4, 5, 6]);
  expect(first.items).toHaveLength(3);
  expect(second.items).toHaveLength(3);
  const keys = [...first.items, ...second.items].map((row) => `${row.playerId}|${row.createdAt}|${row.configKey}`);
  expect(new Set(keys).size).toBe(keys.length);
  const scores = [...first.items, ...second.items].map((row) => row.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

test('a ruleset filter only ranks matches with that config key', () => {
  const key = keyOf(45, 'light', 'veteran');
  const board = listLeaderboard(1, 50, key);
  expect(board.total).toBeGreaterThan(0);
  expect(board.items.every((row) => row.configKey === key)).toBe(true);
});

test('registering the same client match twice is idempotent', () => {
  const input = match('client-1', 640);
  const first = registerMatch(input);
  const second = registerMatch(input);
  expect(first.created).toBe(true);
  expect(second.created).toBe(false);
  expect(second.record.id).toBe(first.record.id);
  expect(listMatches('p-test', 1, 50).total).toBe(1);
});

test('a registration updates the leaderboard', () => {
  const before = listLeaderboard(1, 50).total;
  registerMatch(match('client-2', 5000));
  const board = listLeaderboard(1, 50);
  expect(board.total).toBe(before + 1);
  expect(board.items[0]).toMatchObject({ playerId: 'p-test', score: 5000, rank: 1 });
});
