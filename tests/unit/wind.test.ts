import { expect, test } from 'vitest';
import { windLabel, windTier } from '../../src/game/config';

test('wind tiers and labels share one set of thresholds', () => {
  expect(windTier(0)).toBe('calm');
  expect(windTier(5.9)).toBe('calm');
  expect(windTier(6)).toBe('breeze');
  expect(windTier(34.9)).toBe('breeze');
  expect(windTier(35)).toBe('gust');
  expect(windTier(74.9)).toBe('gust');
  expect(windTier(75)).toBe('gale');
  expect(windTier(-80)).toBe('gale');

  expect(windLabel(0)).toBe('calm');
  expect(windLabel(20)).toBe('breeze →');
  expect(windLabel(-20)).toBe('breeze ←');
  expect(windLabel(-90)).toBe('gale ←');
});
