import { z } from 'zod';

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

/** Arrow keys are always available for these actions and are never stored. */
export const MOVEMENT_ALIASES = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  aimUp: 'ArrowUp',
  aimDown: 'ArrowDown',
} as const;

export type MovementAliasAction = keyof typeof MOVEMENT_ALIASES;

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
]);

const ALIAS_CODES = new Set<string>(Object.values(MOVEMENT_ALIASES));

// Keys the page cannot own: the browser or a dialog consumes them first.
const UNSUPPORTED_CODES = new Set(['Escape', 'Tab', 'F5', 'F12', 'ContextMenu', 'Unidentified']);

export type BindingRejection = 'modifier' | 'alias' | 'unsupported';

const REJECTION_MESSAGES: Record<BindingRejection, string> = {
  modifier: 'Press a regular key, not a modifier on its own.',
  alias: 'Arrow keys are fixed movement aliases.',
  unsupported: 'That key is reserved by the browser.',
};

const KEY_CODE = z
  .string()
  .min(1)
  .max(32)
  // Every KeyboardEvent.code starts with a capital letter (KeyA, Digit1, IntlBackslash).
  .regex(/^[A-Z][A-Za-z0-9]*$/, { message: 'Not a KeyboardEvent.code' })
  .refine((code) => bindingRejection(code) === null, { message: 'Reserved key code' });

/** Why a captured or stored code cannot become a binding, if it cannot. */
export function bindingRejection(code: string): BindingRejection | null {
  if (MODIFIER_CODES.has(code)) return 'modifier';
  if (ALIAS_CODES.has(code)) return 'alias';
  if (UNSUPPORTED_CODES.has(code)) return 'unsupported';
  return null;
}

export function bindingMessage(code: string): string {
  const rejection = bindingRejection(code);
  return rejection ? REJECTION_MESSAGES[rejection] : 'That key cannot be used.';
}

/** Validates an untrusted code from a keyboard event or stored JSON. */
export function parseKeyCode(raw: unknown): string | null {
  const parsed = KEY_CODE.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Backspace: '⌫',
  Insert: 'Ins',
  Delete: 'Del',
  Tab: 'Tab',
  CapsLock: 'Caps',
  NumLock: 'Num Lock',
  ScrollLock: 'Scroll Lock',
  PrintScreen: 'PrtSc',
  Pause: 'Pause',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
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
  NumpadAdd: '+',
  NumpadSubtract: '−',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
  NumpadComma: ',',
  IntlBackslash: '\\',
  IntlYen: '¥',
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
  if (/^F\d{1,2}$/.test(code)) return code;
  // Codes without a friendly name still read better as words than as identifiers.
  return code.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

const STORED_BINDINGS = z.record(z.unknown());

/** Merge stored values over the defaults; anything malformed or reserved falls back. */
export function sanitizeBindings(raw: unknown): Bindings {
  const parsed = STORED_BINDINGS.safeParse(raw);
  const source: Record<string, unknown> = parsed.success && !Array.isArray(raw) ? parsed.data : {};
  const next = { ...DEFAULT_BINDINGS };
  for (const { id } of BINDING_ACTIONS) {
    const code = parseKeyCode(source[id]);
    if (code) next[id] = code;
  }
  return next;
}

/** Move a code onto one action, swapping it with the action that already had it. */
export function assignBinding(bindings: Bindings, id: BindAction, rawCode: string): Bindings {
  const code = parseKeyCode(rawCode);
  if (!code) return bindings;
  const next = { ...bindings };
  const conflict = BINDING_ACTIONS.find((action) => action.id !== id && next[action.id] === code);
  if (conflict) next[conflict.id] = bindings[id];
  next[id] = code;
  return next;
}
