import { afterEach, expect, test, vi } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/state/bindings';
import { loadBindings } from '../../src/state/storage';

const stubStorage = (raw: string | null) => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => raw),
    setItem: vi.fn(),
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('empty storage yields the default bindings', () => {
  stubStorage(null);
  expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
});

test('corrupt JSON yields the default bindings', () => {
  stubStorage('{"fire":');
  expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
});

test('an old-schema object yields the default bindings', () => {
  stubStorage('{"version":1,"bindings":{"fire":"KeyF"}}');
  expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
});

test('stored bindings are validated field by field', () => {
  stubStorage(
    JSON.stringify({
      fire: 'KeyF',
      jump: 'ControlLeft',
      rope: 'ArrowUp',
      pause: 'Escape',
      weapon1: 'Numpad1',
      weapon2: 'garbage',
    }),
  );
  expect(loadBindings()).toEqual({
    ...DEFAULT_BINDINGS,
    fire: 'KeyF',
    weapon1: 'Numpad1',
  });
});
