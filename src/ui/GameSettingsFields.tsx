import { DIFFICULTY, TURN_SECONDS } from '../game/config';
import type { Difficulty, GameSettings, WindSetting } from '../game/types';

interface GameSettingsFieldsProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
}

/** The match rules shared by the project Options panel and the /demo Settings dialog. */
export function GameSettingsFields({ settings, onChange }: GameSettingsFieldsProps) {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <>
      <div className="option-row">
        <label htmlFor="turn-seconds">
          <span>Turn timer</span>
          <small>Seconds per turn. Longer turns reward repositioning.</small>
        </label>
        <div className="range-field">
          <input
            id="turn-seconds"
            type="range"
            min={TURN_SECONDS.min}
            max={TURN_SECONDS.max}
            step={TURN_SECONDS.step}
            value={settings.turnSeconds}
            onChange={(e) => update('turnSeconds', Number(e.target.value))}
            data-testid="input-turn-seconds"
          />
          <output className="mono">{settings.turnSeconds}s</output>
        </div>
      </div>

      <div className="option-row">
        <label htmlFor="wind">
          <span>Wind</span>
          <small>Gusts bend every arcing shot. Off for pure geometry.</small>
        </label>
        <select
          id="wind"
          value={settings.wind}
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
          <small>{DIFFICULTY[settings.difficulty].blurb}</small>
        </label>
        <select
          id="difficulty"
          value={settings.difficulty}
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
            checked={settings.sound}
            onChange={(e) => update('sound', e.target.checked)}
            data-testid="toggle-sound"
          />
          <span>{settings.sound ? 'On' : 'Off'}</span>
        </label>
      </div>
    </>
  );
}
