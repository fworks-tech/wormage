import type { LeaderboardRow, Paginated } from '../api/types';

interface LeaderboardProps {
  page: number;
  onPage: (page: number) => void;
  data?: Paginated<LeaderboardRow>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  localPlayerId: string;
  configKeyLabel: string;
}

export function Leaderboard({
  page,
  onPage,
  data,
  loading,
  error,
  onRetry,
  localPlayerId,
  configKeyLabel,
}: LeaderboardProps) {
  if (error) {
    return (
      <div className="state-block" data-testid="leaderboard-error">
        <p>The ranking uplink is down.</p>
        <button type="button" className="ghost-btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="state-block" data-testid="leaderboard-loading">
        <span className="loader" />
        <p>Fetching the board…</p>
      </div>
    );
  }

  return (
    <div className="table-wrap" data-testid="leaderboard">
      <div className="table-meta">
        <span>Board: {configKeyLabel}</span>
        {loading && <span className="muted">refreshing…</span>}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Commander</th>
            <th>Score</th>
            <th className="hide-sm">Kills</th>
            <th className="hide-sm">Time</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((row) => (
            <tr key={`${row.playerId}-${row.rank}`} className={row.playerId === localPlayerId ? 'row-me' : ''}>
              <td className="mono">{row.rank}</td>
              <td>
                <span className="player-cell">
                  {row.playerName}
                  {row.playerId === localPlayerId && <em>you</em>}
                </span>
              </td>
              <td className="mono">{row.score}</td>
              <td className="mono hide-sm">{row.kills}</td>
              <td className="mono hide-sm">{formatDuration(row.durationSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.items.length === 0 && (
        <div className="state-block" data-testid="leaderboard-empty">
          <p>No runs recorded for this ruleset yet. Be the first.</p>
        </div>
      )}
      <Pager page={page} totalPages={data?.totalPages ?? 1} onChange={onPage} />
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pager">
      <button type="button" className="ghost-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </button>
      <span className="mono">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="ghost-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        data-testid="pager-next"
      >
        Next
      </button>
    </div>
  );
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
