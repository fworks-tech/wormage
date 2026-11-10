import { useState } from 'react';
import { DIFFICULTY, WEAPONS, configKeyFrom, configLabel } from '../game/config';
import type { GameSettings } from '../game/types';
import type { PlayerIdentity } from '../state/storage';
import type { SessionResult } from '../types';
import { useLeaderboard, useMatchHistory } from '../api/queries';
import { Leaderboard } from './Leaderboard';
import { MatchHistory } from './MatchHistory';
import { OptionsPanel } from './OptionsPanel';
import { WeaponIcon } from './WeaponIcon';

export type MenuTab = 'briefing' | 'ranking' | 'history' | 'options';

interface MainMenuProps {
  settings: GameSettings;
  player: PlayerIdentity;
  onStart: () => void;
  onSaveSettings: (settings: GameSettings) => void;
  lastResult?: SessionResult | null;
}

const TABS: Array<{ id: MenuTab; label: string }> = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
  { id: 'options', label: 'Options' },
];

export function MainMenu({ settings, player, onStart, onSaveSettings, lastResult }: MainMenuProps) {
  const [tab, setTab] = useState<MenuTab>('briefing');
  const [boardPage, setBoardPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const configKey = configKeyFrom(settings);
  const leaderboard = useLeaderboard(configKey, boardPage, 8);
  const history = useMatchHistory(player.id, historyPage, 8);

  const go = (next: MenuTab) => {
    setTab(next);
    if (next === 'ranking') void leaderboard.refetch();
    if (next === 'history') void history.refetch();
  };

  return (
    <div className="menu-shell">
      <header className="menu-top">
        <div className="wordmark small">
          <span className="wordmark-mark" aria-hidden>
            ☠
          </span>
          WORMAGE
        </div>
        <nav className="tabs" aria-label="Menu sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${tab === item.id ? 'tab-active' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => go(item.id)}
              data-testid={`tab-${item.id}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="menu-main">
        {tab === 'briefing' && (
          <div className="briefing-grid">
            <section className="hero-copy">
              <p className="eyebrow">Turn-based artillery · 1v1 vs CPU</p>
              <h1 className="wordmark">
                WORM<span>AGE</span>
              </h1>
              <p className="lede">
                Three worms a side. One shrinking island. Curve a rocket over the ridge, read the wind, and erase the
                ground under their boots before they do it to you.
              </p>
              <p className="demo-note" data-testid="demo-note">
                <strong>Demo build.</strong> This is the first playable version of Wormage. Campaign, progression and
                online play are on the{' '}
                <a href="https://github.com/fworks-tech/wormage/milestones" target="_blank" rel="noreferrer">
                  roadmap
                </a>
                .
              </p>
              <div className="hero-actions">
                <button type="button" className="primary-btn big" onClick={onStart} data-testid="btn-play">
                  Deploy
                </button>
                <button type="button" className="ghost-btn" onClick={() => setTab('options')}>
                  Match options
                </button>
              </div>
              {lastResult && (
                <p className="last-run mono">
                  Last drop: {lastResult.score} pts · {lastResult.playerWon ? 'victory' : 'defeat'} ·{' '}
                  {lastResult.kills} kill{lastResult.kills === 1 ? '' : 's'}
                </p>
              )}
              <dl className="rule-list">
                <div>
                  <dt>Turn timer</dt>
                  <dd>{settings.turnSeconds}s</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{settings.wind}</dd>
                </div>
                <div>
                  <dt>Enemy</dt>
                  <dd>{DIFFICULTY[settings.difficulty].label}</dd>
                </div>
                <div>
                  <dt>Board</dt>
                  <dd>{configLabel(settings)}</dd>
                </div>
              </dl>
            </section>

            <section className="hero-side">
              <div className="panel controls-panel">
                <h2>Field manual</h2>
                <ul className="controls-list">
                  <li>
                    <kbd>A</kbd>
                    <kbd>D</kbd> walk
                  </li>
                  <li>
                    <kbd>W</kbd>
                    <kbd>S</kbd> aim
                  </li>
                  <li>
                    <kbd>Space</kbd> hold to charge, release to fire
                  </li>
                  <li>
                    <kbd>J</kbd> jump/let go · <kbd>R</kbd> rope · <kbd>1-4</kbd> weapons · <kbd>E</kbd> end turn
                  </li>
                  <li>
                    Drag on the battlefield to aim and fire on touch screens.
                  </li>
                </ul>
              </div>

              <div className="panel arsenal-panel">
                <h2>Arsenal</h2>
                <ul>
                  {Object.values(WEAPONS).map((weapon) => (
                    <li key={weapon.id}>
                      <WeaponIcon id={weapon.id} />
                      <span>
                        <strong>{weapon.name}</strong>
                        <small>{weapon.blurb}</small>
                      </span>
                      <span className="mono ammo-tag">{weapon.ammo === null ? '∞' : weapon.ammo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}

        {tab === 'ranking' && (
          <Leaderboard
            data={leaderboard.data}
            loading={leaderboard.isFetching}
            error={leaderboard.isError}
            onRetry={() => void leaderboard.refetch()}
            page={boardPage}
            onPage={setBoardPage}
            localPlayerId={player.id}
            configKeyLabel={configLabel(settings)}
          />
        )}

        {tab === 'history' && (
          <MatchHistory
            data={history.data}
            loading={history.isFetching}
            error={history.isError}
            onRetry={() => void history.refetch()}
            page={historyPage}
            onPage={setHistoryPage}
          />
        )}

        {tab === 'options' && (
          <OptionsPanel
            settings={settings}
            onSave={(next) => {
              onSaveSettings(next);
              void leaderboard.refetch();
              void history.refetch();
            }}
            onClose={() => setTab('briefing')}
          />
        )}
      </main>

      <footer className="menu-foot">
        <span>React · TypeScript · PixiJS · TanStack Query · Axios · MSW</span>
        <span className="mono">v1.0.0</span>
      </footer>
    </div>
  );
}
