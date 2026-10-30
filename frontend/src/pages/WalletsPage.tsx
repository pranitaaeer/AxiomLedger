import { useEffect, useState } from 'react';
import '../styles/WalletsPage.scss';

type Account = {
  id: string;
  type: string;
  currency: string;
  balance_minor: number;
  created_at: string;
};

export function WalletsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Real API call to fetch accounts with live balance
    fetch('/api/accounts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch accounts');
        return res.json();
      })
      .then((data) => {
        setAccounts(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="wallets-page fade-in">
      <div className="row between wallets-header">
        <div>
          <h2>All Accounts & Wallets</h2>
          <p className="muted">Monitor balances and status across all ledger accounts.</p>
        </div>
        <span className="pill">{accounts.length} accounts</span>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '16px' }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div className="wallets-grid-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: '140px' }} />
          ))}
        </div>
      )}

      {!loading && !error && accounts.length === 0 && (
        <div className="card zero-wallets-state">
          <div className="empty-icon">👛</div>
          <p className="empty-title">No Accounts Found</p>
          <p className="muted">There are no wallets configured in the ledger yet.</p>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="grid-3">
          {accounts.map((acc) => {
            const balance = Number(acc.balance_minor) / 100;
            const isNegative = balance < 0;
            return (
              <div
                key={acc.id}
                className={`card wallet-card ${isNegative ? 'negative-card' : ''}`}
              >
                <div className="row between">
                  <span className="wallet-type">
                    {acc.type.toUpperCase()} Account
                  </span>
                  <span className={`pill ${isNegative ? 'failed' : 'settled'}`}>
                    {isNegative ? 'Negative' : 'Active'}
                  </span>
                </div>
                
                {/* Full ID dikhane ke liye (taaki copy karke test kar sako) */}
                <div className="wallet-id" title={acc.id} style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0' }}>
                  {acc.id}
                </div>

                <div className="wallet-balance" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {acc.currency} {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}