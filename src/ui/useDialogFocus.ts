import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into an open dialog, keeps Tab inside it and restores focus when
 * it closes. `focusKey` reruns the trap when the dialog swaps its contents,
 * such as the pause card opening Settings.
 */
export function useDialogFocus<T extends HTMLElement>(active: boolean, focusKey: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    items()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      // A panel swap unmounts the button that opened it; only restore live nodes.
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [active, focusKey]);

  return ref;
}
