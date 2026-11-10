import { DIFFICULTY } from '../game/config';
import type { SessionResult } from '../types';
import { formatDuration } from './Leaderboard';

interface ResultScreenProps {
  result: SessionResult;
  saving: boolean;
  saved: boolean;
  saveError: boolean;
  onRetry: () => void;
  onPlayAgain: () => void;
  onMenu: () => void;
}

const REASON_COPY: Record<string, string> = {
  wipeout: 'Enemy team wiped out',
  surrender: 'You called the retreat',
  time: 'Clock ran out',
};

export function ResultScreen({
  result,
  saving,
  saved,
  saveError,
  onRetry,
  onPlayAgain,
  onMenu,
}: ResultScreenProps) {
  const won = result.playerWon;
  return (
    <div className="result-shell">
      <div className="result-card" data-testid="result-screen">
        <p className="eyebrow">{won ? 'Island secured' : 'Island lost'}</p>
        <h1>{won ? 'Victory' : 'Wiped out'}</h1>
        <p className="result-reason">{REASON_COPY[result.endReason] ?? result.endReason}</p>

        <div className="score-block">
          <span className="score-value" data-testid="result-score">
            {result.score}
          </span>
          <span className="score-label">score</span>
        </div>

        <dl className="result-stats">
          <div>
            <dt>Kills</dt>
            <dd>{result.kills}</dd>
          </div>
          <div>
            <dt>Match time</dt>
            <dd>{formatDuration(result.durationSeconds)}</dd>
          </div>
          <div>
            <dt>Turn timer</dt>
            <dd>{result.config.turnSeconds}s</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{result.config.wind}</dd>
          </div>
          <div>
            <dt>Enemy</dt>
            <dd>{DIFFICULTY[result.config.difficulty].label}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd className="mono">{result.config.seed}</dd>
          </div>
        </dl>

        <div className={`save-state ${saveError ? 'save-error' : ''}`} data-testid="save-state">
          {saving && <span>Filing the after-action report…</span>}
          {!saving && saved && <span>Logged to the ranking and match history.</span>}
          {!saving && saveError && (
            <span>
              Could not reach the archive.{' '}
              <button type="button" className="link-btn" onClick={onRetry} data-testid="btn-retry-save">
                Retry
              </button>
            </span>
          )}
        </div>

        <div className="result-actions">
          <button type="button" className="primary-btn big" onClick={onPlayAgain} data-testid="btn-play-again">
            Play again
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onMenu}
            disabled={saving}
            data-testid="btn-main-menu"
          >
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
