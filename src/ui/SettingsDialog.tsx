import { useState } from 'react';
import type { GameSettings } from '../game/types';
import { GameSettingsFields } from './GameSettingsFields';

interface SettingsDialogProps {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onClose: () => void;
}

/** Match settings shared by /demo; a match freezes them when it mounts. */
export function SettingsDialog({ settings, onSave, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);

  return (
    <div className="overlay-card settings-dialog" data-testid="settings-dialog">
      <p className="eyebrow">Match</p>
      <h2>Settings</h2>
      <p className="muted">Changes apply to the next match.</p>
      <div className="dialog-form">
        <GameSettingsFields settings={draft} onChange={setDraft} />
      </div>
      <div className="overlay-actions">
        <button
          type="button"
          className="primary-btn"
          data-testid="btn-save-settings"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </button>
        <button type="button" className="ghost-btn" data-testid="btn-close-settings" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
