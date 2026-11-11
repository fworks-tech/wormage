import { useEffect, useState } from 'react';
import {
  assignBinding,
  BINDING_ACTIONS,
  bindingMessage,
  DEFAULT_BINDINGS,
  keyLabel,
  parseKeyCode,
  type BindAction,
  type Bindings,
} from '../state/bindings';

interface ControlsDialogProps {
  bindings: Bindings;
  onSave: (bindings: Bindings) => void;
  onClose: () => void;
}

const GROUPS = ['Movement', 'Combat', 'System'] as const;

/** Rebinding screen shared by /demo and the pause card. Escape stays fixed. */
export function ControlsDialog({ bindings, onSave, onClose }: ControlsDialogProps) {
  const [draft, setDraft] = useState(bindings);
  const [capturing, setCapturing] = useState<BindAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setCapturing(null);
        setNotice(null);
        return;
      }
      if (event.code === 'Tab') {
        // Focus navigation keeps working; Tab is never a binding.
        setCapturing(null);
        setNotice(null);
        return;
      }
      // Capture phase so the game's window listener never sees the new key.
      event.preventDefault();
      event.stopPropagation();
      const code = parseKeyCode(event.code);
      if (!code) {
        setNotice(bindingMessage(event.code));
        return;
      }
      setDraft((current) => assignBinding(current, capturing, code));
      setCapturing(null);
      setNotice(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing]);

  return (
    <div className="overlay-card controls-dialog" data-testid="controls-dialog">
      <p className="eyebrow">Input</p>
      <h2>Controls</h2>
      <p className="muted">Click a key, press a replacement. Esc cancels; a key already in use swaps.</p>
      {notice && (
        <p className="binding-message" role="status" data-testid="binding-error">
          {notice}
        </p>
      )}
      <div className="binding-groups">
        {GROUPS.map((group) => (
          <section key={group} className="binding-group">
            <h3>{group}</h3>
            {BINDING_ACTIONS.filter((action) => action.group === group).map((action) => (
              <div className="binding-row" key={action.id}>
                <span>{action.label}</span>
                <button
                  type="button"
                  className={`binding-key ${capturing === action.id ? 'binding-capture' : ''}`}
                  onClick={() => {
                    setCapturing(action.id);
                    setNotice(null);
                  }}
                  aria-label={`Change ${action.label}, currently ${keyLabel(draft[action.id])}`}
                  data-testid={`binding-${action.id}`}
                >
                  {capturing === action.id ? 'Press a key…' : keyLabel(draft[action.id])}
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="controls-note">
        Mouse: drag from the worm to aim, release to fire. Touch: tap to aim, drag to fire, hold FIRE to charge.
        Arrow keys stay fixed movement aliases. Single modifiers and browser keys are not accepted. Escape cancels
        capture and toggles pause outside fullscreen; it cannot be rebound.
      </p>
      <div className="overlay-actions">
        <button
          type="button"
          className="ghost-btn"
          data-testid="btn-reset-bindings"
          onClick={() => setDraft({ ...DEFAULT_BINDINGS })}
        >
          Reset
        </button>
        <button
          type="button"
          className="primary-btn"
          data-testid="btn-save-bindings"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </button>
        <button type="button" className="ghost-btn" data-testid="btn-close-bindings" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
