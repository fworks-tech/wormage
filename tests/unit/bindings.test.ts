import { expect, test } from 'vitest';
import {
  assignBinding,
  DEFAULT_BINDINGS,
  keyLabel,
  sanitizeBindings,
} from '../../src/state/bindings';

test('malformed stored bindings fall back to the defaults', () => {
  expect(sanitizeBindings(null)).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings({ fire: 42, jump: 'KeyK' })).toEqual({ ...DEFAULT_BINDINGS, jump: 'KeyK' });
});

test('a key already in use moves to its new action', () => {
  const next = assignBinding(DEFAULT_BINDINGS, 'fire', 'KeyJ');
  expect(next.fire).toBe('KeyJ');
  expect(next.jump).toBe('Space');
});

test('key codes render as readable labels', () => {
  expect(keyLabel('KeyF')).toBe('F');
  expect(keyLabel('Digit3')).toBe('3');
  expect(keyLabel('ArrowUp')).toBe('↑');
  expect(keyLabel('Space')).toBe('Space');
  expect(keyLabel('Numpad7')).toBe('Num 7');
});
