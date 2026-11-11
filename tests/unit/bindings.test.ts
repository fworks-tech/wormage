import { expect, test } from 'vitest';
import {
  assignBinding,
  bindingRejection,
  DEFAULT_BINDINGS,
  keyLabel,
  parseKeyCode,
  sanitizeBindings,
} from '../../src/state/bindings';

test('malformed stored bindings fall back to the defaults', () => {
  expect(sanitizeBindings(null)).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings(undefined)).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings('garbage')).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings(42)).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings([])).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings({ fire: 42, jump: 'KeyK' })).toEqual({ ...DEFAULT_BINDINGS, jump: 'KeyK' });
});

test('old-schema payloads keep only recognised top-level actions', () => {
  expect(sanitizeBindings({ version: 1, bindings: { fire: 'KeyF' } })).toEqual(DEFAULT_BINDINGS);
  expect(sanitizeBindings({ fire: 'KeyF', unknown: true })).toEqual({ ...DEFAULT_BINDINGS, fire: 'KeyF' });
});

test('modifier-only and reserved codes fall back per action', () => {
  expect(sanitizeBindings({ fire: 'ControlLeft' }).fire).toBe('Space');
  expect(sanitizeBindings({ jump: 'ShiftRight' }).jump).toBe('KeyJ');
  expect(sanitizeBindings({ rope: 'MetaLeft' }).rope).toBe('KeyR');
  expect(sanitizeBindings({ fire: 'Escape' }).fire).toBe('Space');
  expect(sanitizeBindings({ fire: 'Tab' }).fire).toBe('Space');
  expect(sanitizeBindings({ fire: 'F5' }).fire).toBe('Space');
  expect(sanitizeBindings({ fire: 'F12' }).fire).toBe('Space');
  expect(sanitizeBindings({ fire: 'ContextMenu' }).fire).toBe('Space');
});

test('arrow keys stay fixed aliases and are never stored as bindings', () => {
  expect(sanitizeBindings({ left: 'ArrowLeft', fire: 'ArrowUp' })).toEqual(DEFAULT_BINDINGS);
  expect(assignBinding(DEFAULT_BINDINGS, 'fire', 'ArrowLeft')).toEqual(DEFAULT_BINDINGS);
  expect(assignBinding(DEFAULT_BINDINGS, 'left', 'ArrowLeft')).toEqual(DEFAULT_BINDINGS);
});

test('a key already in use moves to its new action', () => {
  const next = assignBinding(DEFAULT_BINDINGS, 'fire', 'KeyJ');
  expect(next.fire).toBe('KeyJ');
  expect(next.jump).toBe('Space');
});

test('assignBinding rejects codes the match handler cannot reach', () => {
  expect(assignBinding(DEFAULT_BINDINGS, 'fire', 'ControlLeft')).toEqual(DEFAULT_BINDINGS);
  expect(assignBinding(DEFAULT_BINDINGS, 'fire', 'Escape')).toEqual(DEFAULT_BINDINGS);
  expect(assignBinding(DEFAULT_BINDINGS, 'fire', 'Tab')).toEqual(DEFAULT_BINDINGS);
  expect(assignBinding(DEFAULT_BINDINGS, 'fire', 'F12')).toEqual(DEFAULT_BINDINGS);
});

test('key codes are classified for the dialog message', () => {
  expect(bindingRejection('ControlLeft')).toBe('modifier');
  expect(bindingRejection('ShiftRight')).toBe('modifier');
  expect(bindingRejection('ArrowUp')).toBe('alias');
  expect(bindingRejection('Escape')).toBe('unsupported');
  expect(bindingRejection('Tab')).toBe('unsupported');
  expect(bindingRejection('KeyF')).toBeNull();
  expect(bindingRejection('Numpad7')).toBeNull();
});

test('parseKeyCode validates untrusted keyboard or storage input', () => {
  expect(parseKeyCode('KeyF')).toBe('KeyF');
  expect(parseKeyCode('Numpad7')).toBe('Numpad7');
  expect(parseKeyCode('ControlLeft')).toBeNull();
  expect(parseKeyCode('ArrowLeft')).toBeNull();
  expect(parseKeyCode('Escape')).toBeNull();
  expect(parseKeyCode('')).toBeNull();
  expect(parseKeyCode('garbage')).toBeNull();
  expect(parseKeyCode(42)).toBeNull();
  expect(parseKeyCode('x'.repeat(33))).toBeNull();
});

test('key codes render as readable labels', () => {
  expect(keyLabel('KeyF')).toBe('F');
  expect(keyLabel('Digit3')).toBe('3');
  expect(keyLabel('ArrowUp')).toBe('↑');
  expect(keyLabel('Space')).toBe('Space');
  expect(keyLabel('Numpad7')).toBe('Num 7');
  expect(keyLabel('NumpadAdd')).toBe('+');
  expect(keyLabel('NumpadEnter')).toBe('Num Enter');
  expect(keyLabel('IntlBackslash')).toBe('\\');
  expect(keyLabel('F8')).toBe('F8');
  // Codes with no friendly name still avoid leaking the raw identifier.
  expect(keyLabel('BrowserBack')).toBe('Browser Back');
  expect(keyLabel('IntlRo')).toBe('Intl Ro');
});
