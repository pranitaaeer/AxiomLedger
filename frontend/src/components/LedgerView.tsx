import { useEffect, useMemo, useState } from 'react';
import { apiClient, type Entry, type Transfer } from '../api/client';
import "../styles/_ledger.scss"
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const formatMinor = (minor: number) => inr.format(minor / 100);

type Check = 'ok' | 'bad' | 'neutral';

export function LedgerView({ transfer }: { transfer: Transfer }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setEntries([]);

    apiClient
      .entries(transfer.id)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transfer.id]);

  const { debit, credit } = useMemo(() => {
    const sum = (dir: 'debit' | 'credit') =>
      entries
        .filter((e) => e.direction === dir)
        .reduce((s, e) => s + Number(e.amount_minor), 0);
    return { debit: sum('debit'), credit: sum('credit') };
  }, [entries]);

  const check: Check = entries.length === 0 ? 'neutral' : debit === credit ? 'ok' : 'bad';

  const checkText: Record<Check, string> = {
    ok: '✓ Debits = Credits',
    bad: '✕ Ledger unbalanced',
    neutral: 'No entries to verify',
  };

  return (
    <div className="card ledger-card">
      <div className="row between">
        <div>
          <h2>Ledger entries</h2>
          <p className="muted mono">Transfer · {transfer.id.slice(0, 8)}</p>
        </div>
        <span className={`pill ${String(transfer.status).toLowerCase()}`}>{transfer.status}</span>
      </div>

      {loading ? (
        <div className="stack" style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-sm" />
          ))}
        </div>
      ) : error ? (
        <div className="alert-error">Entries load nahi ho paayi. Dobara transfer select karo.</div>
      ) : entries.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Is transfer ki koi entry nahi mili</p>
          <p className="muted">Shayad abhi ledger mein post nahi hua.</p>
        </div>
      ) : (
        <>
          <div className="ledger-totals">
            <div className="ledger-total debit">
              <span className="muted">Total debit</span>
              <strong>{formatMinor(debit)}</strong>
            </div>
            <div className="ledger-total credit">
              <span className="muted">Total credit</span>
              <strong>{formatMinor(credit)}</strong>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Account</th>
                  <th>Direction</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{String(e.id).slice(0, 8)}</td>
                    <td className="mono">{e.account_id.slice(0, 8)}</td>
                    <td>
                      <span className={`dir-tag ${e.direction}`}>{e.direction}</span>
                    </td>
                    <td className={`num ${e.direction}`}>{formatMinor(Number(e.amount_minor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && <div className={`invariant ${check}`}>{checkText[check]}</div>}
    </div>
  );
}