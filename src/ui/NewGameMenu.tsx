interface NewGameMenuProps {
  onStart: () => void;
}

/** Landing dialog for /demo: the game is one click away, the project page one link away. */
export function NewGameMenu({ onStart }: NewGameMenuProps) {
  return (
    <div className="menu-shell">
      <div className="overlay" role="dialog" aria-modal="true" aria-label="New game">
        <div className="overlay-card">
          <p className="eyebrow">Turn-based artillery · 1v1 vs CPU</p>
          <h2>New game</h2>
          <p className="muted">Three worms a side. Read the wind, carve the island, erase the other team.</p>
          <div className="overlay-actions">
            <button type="button" className="primary-btn" onClick={onStart} data-testid="btn-play">
              Start Game
            </button>
            <a className="ghost-btn" href="/project" data-testid="btn-project">
              See Project
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
