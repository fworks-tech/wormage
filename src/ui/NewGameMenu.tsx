import { useRef, useState } from 'react';
import type { GameSettings } from '../game/types';
import type { Bindings } from '../state/bindings';
import { ControlsDialog } from './ControlsDialog';
import { MenuBackdrop } from './MenuBackdrop';
import { SettingsDialog } from './SettingsDialog';
import { useDialogFocus } from './useDialogFocus';

type MenuPanel = 'settings' | 'controls' | null;

interface NewGameMenuProps {
  onStart: () => void;
  settings: GameSettings;
  onSaveSettings: (settings: GameSettings) => void;
  bindings: Bindings;
  onSaveBindings: (bindings: Bindings) => void;
}

/** Landing dialog for /demo: the game is one click away, the project page one link away. */
export function NewGameMenu({ onStart, settings, onSaveSettings, bindings, onSaveBindings }: NewGameMenuProps) {
  // The single-file build has no routes, so /project would leave the app.
  const hasRoutes = import.meta.env.MODE !== 'single';
  const [panel, setPanel] = useState<MenuPanel>(null);
  // The card unmounts while a panel is open; its button takes focus back afterwards.
  const lastPanel = useRef<MenuPanel>(null);
  if (panel) lastPanel.current = panel;
  const dialogRef = useDialogFocus<HTMLDivElement>(true, panel ?? 'root');

  return (
    <div className="menu-shell">
      <MenuBackdrop />
      <div
        ref={dialogRef}
        className="overlay"
        role="dialog"
        aria-modal="true"
        aria-label={panel === 'settings' ? 'Settings' : panel === 'controls' ? 'Controls' : 'New game'}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && panel) {
            event.preventDefault();
            setPanel(null);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && panel) setPanel(null);
        }}
      >
        {panel === 'settings' ? (
          <SettingsDialog settings={settings} onSave={onSaveSettings} onClose={() => setPanel(null)} />
        ) : panel === 'controls' ? (
          <ControlsDialog bindings={bindings} onSave={onSaveBindings} onClose={() => setPanel(null)} />
        ) : (
          <div className="overlay-card">
            <p className="eyebrow">Turn-based artillery · 1v1 vs CPU</p>
            <h2>New game</h2>
            <p className="muted">Three worms a side. Read the wind, carve the island, erase the other team.</p>
            <div className="overlay-actions overlay-actions-stacked">
              <button type="button" className="primary-btn" onClick={onStart} data-testid="btn-play">
                Start Game
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setPanel('controls')}
                data-testid="btn-controls"
                autoFocus={lastPanel.current === 'controls'}
              >
                Controls
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setPanel('settings')}
                data-testid="btn-settings"
                autoFocus={lastPanel.current === 'settings'}
              >
                Settings
              </button>
              {hasRoutes && (
                <a className="ghost-btn" href="/project" data-testid="btn-project">
                  See Project
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
