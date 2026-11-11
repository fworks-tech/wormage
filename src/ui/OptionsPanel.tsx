import { useState } from 'react';
import type { GameSettings } from '../game/types';
import { getScenario, resetMockData, setScenario } from '../api/mockServer';
import type { MockScenario } from '../api/types';
import { GameSettingsFields } from './GameSettingsFields';

interface OptionsPanelProps {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onClose: () => void;
}

export function OptionsPanel({ settings, onSave, onClose }: OptionsPanelProps) {
  const [draft, setDraft] = useState<GameSettings>(settings);
  const [scenario, setScenarioState] = useState<MockScenario>(getScenario());
  const [saved, setSaved] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);

  return (
    <div className="panel options-panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Loadout</p>
          <h2>Match options</h2>
        </div>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Back
        </button>
      </header>

      <GameSettingsFields
        settings={draft}
        onChange={(next) => {
          setDraft(next);
          setSaved(false);
        }}
      />

      <div className="option-row option-row-split">
        <label htmlFor="scenario">
          <span>Demo network</span>
          <small>Force loading, empty and error states from the mock API.</small>
        </label>
        <select
          id="scenario"
          value={scenario}
          onChange={(e) => {
            const next = e.target.value as MockScenario;
            setScenario(next);
            setScenarioState(next);
          }}
          data-testid="select-scenario"
        >
          <option value="normal">Normal</option>
          <option value="slow">Slow link</option>
          <option value="empty">Empty archives</option>
          <option value="error">Upstream down</option>
        </select>
      </div>

      <footer className="panel-foot">
        {resetNote && <span className="muted">{resetNote}</span>}
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            resetMockData();
            setResetNote('Mock archive reset');
          }}
        >
          Reset demo data
        </button>
        <button
          type="button"
          className="primary-btn"
          data-testid="btn-save-options"
          onClick={() => {
            onSave(draft);
            setSaved(true);
            setResetNote(null);
          }}
        >
          {saved ? 'Saved' : 'Save options'}
        </button>
      </footer>
    </div>
  );
}
