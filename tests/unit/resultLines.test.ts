import { expect, test } from 'vitest';
import { resultLine } from '../../src/ui/resultLines';
import type { SessionResult } from '../../src/types';

const base: SessionResult = {
  winnerTeam: 0,
  playerTeam: 0,
  playerWon: true,
  score: 1240,
  durationSeconds: 252,
  endReason: 'wipeout',
  kills: 3,
  config: { turnSeconds: 30, wind: 'light', difficulty: 'veteran', seed: 4242 },
  recordedAt: '2026-11-11T00:00:00.000Z',
};

test('the same match always reads the same line', () => {
  expect(resultLine(base)).toBe(resultLine({ ...base }));
});

test('a defeat never shows a victory line', () => {
  const seeds = Array.from({ length: 24 }, (_, index) => index);
  const wins = new Set(seeds.map((seed) => resultLine({ ...base, config: { ...base.config, seed } })));
  const losses = new Set(
    seeds.map((seed) => resultLine({ ...base, playerWon: false, config: { ...base.config, seed } })),
  );

  expect(wins.size).toBeGreaterThan(1);
  expect(losses.size).toBeGreaterThan(1);
  for (const line of losses) expect(wins.has(line)).toBe(false);
});

test('surrender and timeout get their own lines', () => {
  expect(resultLine({ ...base, endReason: 'surrender', playerWon: false })).toContain('worms will talk');
  expect(resultLine({ ...base, endReason: 'time', playerWon: true })).toContain('clock ran out');
  expect(resultLine({ ...base, endReason: 'time', playerWon: false })).toContain('clock won');
});
