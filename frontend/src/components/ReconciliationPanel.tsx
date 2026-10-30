

import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { ReconciliationRun } from '../api/client';

export function ReconciliationPanel({ refreshKey }: { refreshKey: number }) {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiClient.listReconciliations()
      .then(data => setRuns(data))
      .catch(err => setError(err.message));
  };

  useEffect(() => { 
    load(); 
  }, [refreshKey]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.runReconciliation(); // REAL API CALL
      await load(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to run reconciliation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card recon-card fade-in">
      <div className="row between recon-header">
        <div>
          <h2>Reconciliation Engine</h2>
          <p className="muted">Automated ledger auditing and payment gateway reconciliation.</p>
        </div>
        <button type="button" className="recon-run-btn" onClick={run} disabled={busy}>
          {busy ? (
            <span className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="spinner" /> Running Audit…
            </span>
          ) : (
            '⚡ Run Reconciliation'
          )}
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="recon-list">
        {runs.length === 0 ? (
          <div className="empty" style={{ padding: '32px 0', textAlign: 'center' }}>
            <div className="empty-icon">🛡️</div>
            <p className="empty-title">No audit runs recorded yet</p>
            <p className="muted">Click the button above to trigger your first reconciliation check.</p>
          </div>
        ) : (
          runs.map((r) => {
            const hasMismatches = r.total_mismatched > 0;
            return (
              <div key={r.id} className={`recon-run-item ${hasMismatches ? 'has-mismatch' : 'all-matched'}`}>
                <div className="recon-info">
                  <div className="recon-timestamp">
                    <span className="recon-dot" />
                    {new Date(r.run_at).toLocaleString()}
                  </div>
                  <span className="recon-id">Run ID: #{String(r.id).slice(0, 6)}</span>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="pill settled">✓ {r.total_matched} matched</span>
                  {hasMismatches && (
                    <span className="pill failed">! {r.total_mismatched} mismatched</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}