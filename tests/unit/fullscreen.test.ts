import { afterEach, expect, test, vi } from 'vitest';
import { enterDemoFullscreen, isDemoRoute } from '../../src/ui/fullscreen';

/** Minimal fake document: the module only reads these fields. */
const stubDocument = ({
  enabled = true,
  active = null,
  request = vi.fn(() => Promise.resolve()),
}: {
  enabled?: boolean;
  active?: object | null;
  request?: () => Promise<void>;
} = {}) => {
  const documentElement = { requestFullscreen: request };
  vi.stubGlobal('document', {
    fullscreenEnabled: enabled,
    fullscreenElement: active,
    documentElement,
  });
  return documentElement;
};

/** The orientation helpers only run on coarse pointers, so tests must say which. */
const stubPointer = (coarse = true) => {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({ matches: coarse && query === '(pointer: coarse)' }),
  });
};

const stubOrientation = (lock = vi.fn(() => Promise.resolve())) => {
  vi.stubGlobal('screen', { orientation: { lock, unlock: vi.fn() } });
  return lock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('only /project is excluded from the demo route', () => {
  expect(isDemoRoute('/demo')).toBe(true);
  expect(isDemoRoute('/demo/')).toBe(true);
  expect(isDemoRoute('/')).toBe(true);
  expect(isDemoRoute('/project')).toBe(false);
  expect(isDemoRoute('/project/history')).toBe(false);
});

test('the demo requests fullscreen', async () => {
  const doc = stubDocument();
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(true);
  expect(doc.requestFullscreen).toHaveBeenCalledTimes(1);
});

test('the demo asks for landscape once fullscreen is granted', async () => {
  stubDocument();
  stubPointer();
  const lock = stubOrientation();
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(true);
  expect(lock).toHaveBeenCalledWith('landscape');
});

test('a fine pointer never asks for landscape', async () => {
  stubDocument();
  stubPointer(false);
  const lock = stubOrientation();
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(true);
  expect(lock).not.toHaveBeenCalled();
});

test('a refused orientation lock leaves the match in fullscreen', async () => {
  stubDocument();
  stubPointer();
  stubOrientation(vi.fn(() => Promise.reject(new Error('denied'))));
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(true);
});

test('a browser without the orientation API still enters fullscreen', async () => {
  stubDocument();
  stubPointer();
  vi.stubGlobal('screen', {});
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(true);
});

test('/project never requests fullscreen', async () => {
  const doc = stubDocument();
  await expect(enterDemoFullscreen('/project')).resolves.toBe(false);
  expect(doc.requestFullscreen).not.toHaveBeenCalled();
});

test('a browser without the Fullscreen API is a no-op', async () => {
  const doc = stubDocument({ enabled: false });
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(false);
  expect(doc.requestFullscreen).not.toHaveBeenCalled();
});

test('an existing fullscreen session is not requested twice', async () => {
  const doc = stubDocument({ active: {} });
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(false);
  expect(doc.requestFullscreen).not.toHaveBeenCalled();
});

test('a refused request resolves false instead of rejecting', async () => {
  stubDocument({ request: () => Promise.reject(new Error('denied')) });
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(false);
});

test('no DOM in Node is a no-op, not a crash', async () => {
  await expect(enterDemoFullscreen('/demo')).resolves.toBe(false);
});
