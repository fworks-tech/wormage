import { useState } from 'react';
import { DIFFICULTY, TURN_SECONDS } from '../game/config';
import type { Difficulty, GameSettings, WindSetting } from '../game/types';
import { getScenario, resetMockData, setScenario } from '../api/mockServer';
import type { MockScenario } from '../api/types';

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

  const inputId = 'turn-seconds';

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

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

      <div className="option-row">
        <label htmlFor={inputId}>
          <span>Turn timer</span>
          <small>Seconds per turn. Longer turns reward repositioning.</small>
        </label>
        <div className="range-field">
          <input
            id={inputId}
            type="range"
            min={TURN_SECONDS.min}
            max={TURN_SECONDS.max}
            step={TURN_SECONDS.step}
            value={draft.turnSeconds}
            onChange={(e) => update('turnSeconds', Number(e.target.value))}
            data-testid="input-turn-seconds"
          />
          <output className="mono">{draft.turnSeconds}s</output>
        </div>
      </div>

      <div className="option-row">
        <label htmlFor="wind">
          <span>Wind</span>
          <small>Gusts bend every arcing shot. Off for pure geometry.</small>
        </label>
        <select
          id="wind"
          value={draft.wind}
          onChange={(e) => update('wind', e.target.value as WindSetting)}
          data-testid="select-wind"
        >
          <option value="off">Off</option>
          <option value="light">Light</option>
          <option value="strong">Strong</option>
        </select>
      </div>

      <div className="option-row">
        <label htmlFor="difficulty">
          <span>Enemy skill</span>
          <small>{DIFFICULTY[draft.difficulty].blurb}</small>
        </label>
        <select
          id="difficulty"
          value={draft.difficulty}
          onChange={(e) => update('difficulty', e.target.value as Difficulty)}
          data-testid="select-difficulty"
        >
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((key) => (
            <option key={key} value={key}>
              {DIFFICULTY[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="option-row">
        <label htmlFor="sound">
          <span>Sound</span>
          <small>Synthesized effects. No audio files, no downloads.</small>
        </label>
        <label className="switch">
          <input
            id="sound"
            type="checkbox"
            checked={draft.sound}
            onChange={(e) => update('sound', e.target.checked)}
          />
          <span>{draft.sound ? 'On' : 'Off'}</span>
        </label>
      </div>

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

// temp
