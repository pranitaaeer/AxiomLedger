


import type { Transfer } from '../api/client';
import '../styles/TransferList.scss';

export function TransferList({
  transfers,
  onSelect
}: {
  transfers: Transfer[];
  onSelect: (t: Transfer) => void;
}) {
  if (transfers.length === 0) {
    return <p className="muted" style={{ padding: '12px 0' }}>No transfers yet. Create one above.</p>;
  }
  
  return (
    <div className="transfer-list fade-in">
      {transfers.map((t) => (
        <button 
          key={t.id} 
          type="button" 
          className="transfer-row" 
          onClick={() => onSelect(t)}
        >
          <div className="transfer-info">
            <strong className="transfer-amount">
              ₹{(t.amount_minor / 100).toFixed(2)}
            </strong>
            <div className="transfer-accounts muted">
              <span>{t.from_account_id.slice(0, 8)}...</span>
              <span className="transfer-arrow">→</span>
              <span>{t.to_account_id.slice(0, 8)}...</span>
            </div>
          </div>
          <span className={`pill ${t.status.toLowerCase()}`}>
            {t.status}
          </span>
        </button>
      ))}
    </div>
  );
}