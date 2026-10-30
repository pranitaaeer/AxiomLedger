
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import "../styles/_balance-badge.scss"

type Status = 'loading' | 'ok' | 'empty' | 'error';

const LABELS: Record<Exclude<Status, 'ok'>, string> = {
  loading: 'Checking…',
  empty: 'No reconciliation yet',
  error: 'Status unavailable',
};

export function BalanceBadge({ refreshKey }: { refreshKey: number }) {
  const [status, setStatus] = useState<Status>('loading');
  const [matched, setMatched] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .listReconciliations()
      .then((runs) => {
        if (cancelled) return;
        if (runs.length === 0) {
          setMatched(0);
          setStatus('empty');
          return;
        }
        setMatched(runs[0].total_matched ?? 0);
        setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const label =
    status === 'ok' ? `Reconciled · ${matched.toLocaleString()} matched` : LABELS[status];

  return (
    <div
      className={`balance-badge ${status}`}
      role="status"
      aria-live="polite"
      title="Based on the latest reconciliation run"
    >
      <span className="dot" />
      <span className="balance-label">{label}</span>
    </div>
  );
}