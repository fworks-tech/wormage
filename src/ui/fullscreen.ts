import { useEffect, useState } from 'react';

/** Matches App.tsx: `/project` is the informational page, everything else plays. */
export const isDemoRoute = (pathname: string): boolean => !pathname.startsWith('/project');

const fullscreenSupported = (): boolean =>
  typeof document !== 'undefined' &&
  document.fullscreenEnabled === true &&
  typeof document.documentElement.requestFullscreen === 'function';

/**
 * Fullscreen needs a transient user activation, so only call this from a click
 * or key handler. Refusals (iOS, iframe policy, permission) resolve false.
 */
export async function enterDemoFullscreen(pathname = window.location.pathname): Promise<boolean> {
  if (!isDemoRoute(pathname) || !fullscreenSupported() || document.fullscreenElement) return false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
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
    const sync = () => setActive(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  return { supported, active };
}
