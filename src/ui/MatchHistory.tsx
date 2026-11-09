import type { MatchRecord, Paginated } from '../api/types';
import { formatDuration, Pager } from './Leaderboard';

interface MatchHistoryProps {
  page: number;
  onPage: (page: number) => void;
  data?: Paginated<MatchRecord>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

const REASON_LABEL: Record<string, string> = {
  wipeout: 'Team wiped out',
  surrender: 'Surrendered',
  time: 'Time out',
};

export function MatchHistory({ page, onPage, data, loading, error, onRetry }: MatchHistoryProps) {
  if (error) {
    return (
      <div className="state-block" data-testid="history-error">
        <p>The archive is unreachable.</p>
        <button type="button" className="ghost-btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="state-block" data-testid="history-loading">
        <span className="loader" />
        <p>Pulling your service record…</p>
      </div>
    );
  }

  return (
    <div className="table-wrap" data-testid="match-history">
      <div className="table-meta">
        <span>Your deployments</span>
        {loading && <span className="muted">refreshing…</span>}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Score</th>
            <th className="hide-sm">Duration</th>
            <th>Outcome</th>
            <th className="hide-sm">Ruleset</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((row) => (
            <tr key={row.id}>
              <td className="mono">{new Date(row.createdAt).toLocaleDateString()}</td>
              <td className="mono">{row.score}</td>
              <td className="mono hide-sm">{formatDuration(row.durationSeconds)}</td>
              <td>{REASON_LABEL[row.endReason] ?? row.endReason}</td>
              <td className="mono hide-sm">{row.configKey}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.items.length === 0 && (
        <div className="state-block" data-testid="history-empty">
          <p>No matches on record. Your first drop is waiting.</p>
        </div>
      )}
      <Pager page={page} totalPages={data?.totalPages ?? 1} onChange={onPage} />
    </div>
  );
}
