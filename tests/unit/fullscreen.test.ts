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
