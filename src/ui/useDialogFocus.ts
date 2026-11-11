import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into an open dialog, keeps it there and returns it to where it
 * came from when the dialog closes. `focusKey` reruns the trap when the dialog
 * swaps its contents, such as the pause card opening Settings.
 */
export function useDialogFocus<T extends HTMLElement>(active: boolean, focusKey: string) {
  const ref = useRef<T | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) {
      wasActive.current = false;
      return;
    }
    // A panel swap is not a new dialog; keep the target from the first open.
    if (!wasActive.current) returnTo.current = document.activeElement as HTMLElement | null;
    wasActive.current = true;

    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    // Panel content that mounts with its own autoFocus keeps it.
    if (!node.contains(document.activeElement)) items()[0]?.focus();

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
    // Tab is not the only way out: anything focused behind the dialog comes back.
    const onFocusIn = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) items()[0]?.focus();
    };
    node.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      node.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      // A panel swap leaves the overlay mounted; only a close returns focus.
      if (!node.isConnected && returnTo.current?.isConnected) returnTo.current.focus();
    };
  }, [active, focusKey]);

  return ref;
}
