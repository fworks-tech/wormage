import { useEffect, useState } from 'react';

/** Matches App.tsx: `/project` is the informational page, everything else plays. */
export const isDemoRoute = (pathname: string): boolean => !pathname.startsWith('/project');

const fullscreenSupported = (): boolean =>
  typeof document !== 'undefined' &&
  document.fullscreenEnabled === true &&
  typeof document.documentElement.requestFullscreen === 'function';

/** `lock` is missing from the DOM typings TS ships even where browsers support it. */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

const orientationApi = (): LockableOrientation | undefined => {
  if (typeof screen === 'undefined' || !('orientation' in screen)) return undefined;
  return screen.orientation;
};

/**
 * Landscape belongs to the fullscreen session: the match gets the wide arena,
 * while windowed portrait play keeps the #59 layout. Refusals are expected —
 * Safari has no Screen Orientation API and desktop Chrome always rejects it.
 */
async function lockLandscape(): Promise<void> {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;
  const orientation = orientationApi();
  if (typeof orientation?.lock !== 'function') return;
  try {
    await orientation.lock('landscape');
  } catch {
    // Unsupported or refused; the match stays playable in the current orientation.
  }
}

/** Browsers release the lock when fullscreen ends; be explicit where they do not. */
function releaseLandscape(): void {
  const orientation = orientationApi();
  if (typeof orientation?.unlock !== 'function') return;
  try {
    orientation.unlock();
  } catch {
    // Nothing was locked.
  }
}

/**
 * Fullscreen needs a transient user activation, so only call this from a click
 * or key handler. Refusals (iOS, iframe policy, permission) resolve false.
 */
export async function enterDemoFullscreen(pathname = window.location.pathname): Promise<boolean> {
  if (!isDemoRoute(pathname) || !fullscreenSupported() || document.fullscreenElement) return false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await lockLandscape();
    return true;
  } catch {
    return false;
  }
}

/** Tracks fullscreen state so the pause dialog can offer a way back in. */
export function useFullscreen(): { supported: boolean; active: boolean } {
  const [supported] = useState(fullscreenSupported);
  const [active, setActive] = useState(() => document.fullscreenElement !== null);

  useEffect(() => {
    const sync = () => {
      const nowActive = document.fullscreenElement !== null;
      if (!nowActive) releaseLandscape();
      setActive(nowActive);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  return { supported, active };
}
