import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { Transfer } from '../api/client';
import { LedgerView } from '../components/LedgerView';
import '../styles/TransactionsPage.scss';

export function TransactionsPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.listTransfers()
      .then(data => {
        setTransfers(data);
        if (data.length > 0) {
          setSelected(data[0]); // Auto select first real transfer
        }
        setError(null);
      })
      .catch((err) => {
        setError('Failed to load transactions. Please try again.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = transfers.filter(
    (t) =>
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.status.toLowerCase().includes(search.toLowerCase()) ||
      t.from_account_id.toLowerCase().includes(search.toLowerCase()) ||
      t.to_account_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="transactions-page fade-in">
      {!loading && transfers.length === 0 ? (
        <div className="card zero-db-state">
          <div className="empty-badge">DB Status: Clean & Ready</div>
          <div className="empty-illustration">
            <div className="glow-icon">💳</div>
          </div>
          <h2>No Transaction Records Found</h2>
          <p className="muted">
            The database is currently empty. Initiate your first double-entry transaction from the dashboard to get started.
          </p>
          <div className="cta-row">
            <a href="/transfers" className="btn-primary-link">
              ⚡ Create First Transfer
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="card transactions-list-card">
            <div className="row between transactions-header">
              <div>
                <h2>All Transactions</h2>
                <p className="muted">Search and audit all ledger entries.</p>
              </div>
              <span className="pill">{filtered.length} entries</span>
            </div>

            <div className="search-box-wrapper">
              <input
                className="search-input"
                placeholder="Search by ID, status, or account..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {error && (
              <div className="alert-error" style={{ marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <div className="transfer-list">
              {loading ? (
                <div className="stack" style={{ gap: 10 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty search-empty">
                  <div className="empty-icon">🔍</div>
                  <p className="empty-title">No matching transactions found</p>
                  <p className="muted">
                    No results matched "{search}". Try adjusting your search query.
                  </p>
                  <button className="secondary btn-small" onClick={() => setSearch('')}>
                    Clear Search
                  </button>
                </div>
              ) : (
                filtered.map((t) => {
                  const isSelected = selected?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`transfer-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelected(t)}
                    >
                      <div className="transfer-info">
                        <strong className="transfer-amount">
                          ₹{(t.amount_minor / 100).toFixed(2)}
                        </strong>
                        <div className="muted transfer-id-sub">{t.id}</div>
                      </div>
                      <span className={`pill ${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="stack transactions-detail-stack">
            {selected ? (
              <div className="fade-in">
                <LedgerView transfer={selected} />
              </div>
            ) : (
              <div className="card empty ledger-placeholder">
                <div className="empty-icon">📒</div>
                <p className="empty-title">Transaction Details</p>
                <p className="muted">
                  Select a transaction from the left panel to inspect its double-entry ledger view.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}