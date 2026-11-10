export type BindAction =
  | 'left'
  | 'right'
  | 'aimUp'
  | 'aimDown'
  | 'fire'
  | 'jump'
  | 'rope'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4'
  | 'endTurn'
  | 'pause';

export type Bindings = Record<BindAction, string>;

export interface BindingAction {
  id: BindAction;
  label: string;
  group: 'Movement' | 'Combat' | 'System';
}

export const BINDING_ACTIONS: readonly BindingAction[] = [
  { id: 'left', label: 'Walk left', group: 'Movement' },
  { id: 'right', label: 'Walk right', group: 'Movement' },
  { id: 'aimUp', label: 'Aim up / reel in', group: 'Movement' },
  { id: 'aimDown', label: 'Aim down / reel out', group: 'Movement' },
  { id: 'jump', label: 'Jump / let go', group: 'Movement' },
  { id: 'rope', label: 'Rope', group: 'Movement' },
  { id: 'fire', label: 'Fire', group: 'Combat' },
  { id: 'weapon1', label: 'Bazooka', group: 'Combat' },
  { id: 'weapon2', label: 'Grenade', group: 'Combat' },
  { id: 'weapon3', label: 'Shotgun', group: 'Combat' },
  { id: 'weapon4', label: 'Dynamite', group: 'Combat' },
  { id: 'endTurn', label: 'End turn', group: 'Combat' },
  { id: 'pause', label: 'Pause', group: 'System' },
];

export const DEFAULT_BINDINGS: Bindings = {
  left: 'KeyA',
  right: 'KeyD',
  aimUp: 'KeyW',
  aimDown: 'KeyS',
  jump: 'KeyJ',
  rope: 'KeyR',
  fire: 'Space',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  weapon3: 'Digit3',
  weapon4: 'Digit4',
  endTurn: 'KeyE',
  pause: 'KeyP',
};

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: '⌫',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
  Quote: "'",
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

export function keyLabel(code: string): string {
  if (NAMED_KEYS[code]) return NAMED_KEYS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Merge stored values over the defaults; anything malformed falls back. */
export function sanitizeBindings(raw: unknown): Bindings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_BINDINGS };
  for (const { id } of BINDING_ACTIONS) {
    const value = source[id];
    if (typeof value === 'string' && value.length > 0) next[id] = value;
  }
  return next;
}

/** Move a code onto one action, swapping it with the action that already had it. */
export function assignBinding(bindings: Bindings, id: BindAction, code: string): Bindings {
  const next = { ...bindings };
  const conflict = BINDING_ACTIONS.find((action) => action.id !== id && next[action.id] === code);
  if (conflict) next[conflict.id] = bindings[id];
  next[id] = code;
  return next;
}
