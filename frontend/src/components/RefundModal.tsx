

import { useState } from 'react';
import { apiClient } from '../api/client';
import type { Transfer } from '../api/client';
import "../styles/RefundModal.scss"
export function RefundModal({
  transfer,
  onClose,
  onDone
}: {
  transfer: Transfer;
  onClose: () => void;
  onDone: () => void;
}) {
  // Convert minor to major for user-friendly input (e.g., 10000 paise -> 100.00 Rs)
  const maxAmountMajor = transfer.amount_minor / 100;
  const [amountMajor, setAmountMajor] = useState<number>(maxAmountMajor);
  const [reason, setReason] = useState('customer request');
  const [key, setKey] = useState(() => `refund-${Date.now()}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Convert back to minor units (paise) for backend API
    const amountMinor = Math.round(amountMajor * 100);

    if (amountMinor <= 0) {
      setError('Refund amount 0 se zyada honi chahiye.');
      setBusy(false);
      return;
    }

    if (amountMinor > transfer.amount_minor) {
      setError(`Refund amount original transfer amount (₹${maxAmountMajor}) se zyada nahi ho sakti.`);
      setBusy(false);
      return;
    }

    try {
      await apiClient.refund(transfer.id, {
        amountMinor,
        reason,
        idempotencyKey: key
      });
      onDone();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Refund fail ho gaya.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <form className="modal card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="row between" style={{ marginBottom: '4px' }}>
          <h2>Issue Refund</h2>
          <span className="pill settled">Original: ₹{maxAmountMajor.toFixed(2)}</span>
        </div>
        <p className="muted" style={{ marginBottom: '12px' }}>
          Transfer ID: <code style={{ fontSize: '12px' }}>{transfer.id}</code>
        </p>

        <label>
          Refund Amount (₹)
          <input 
            type="number" 
            step="0.01" 
            min="0.01" 
            max={maxAmountMajor} 
            value={amountMajor} 
            onChange={(e) => setAmountMajor(Number(e.target.value))} 
            required
          />
        </label>

        <label>
          Reason for Refund
          <input 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="e.g., duplicate charge, customer request"
            required
          />
        </label>

        <label>
          Idempotency Key (Auto-generated)
          <input 
            value={key} 
            onChange={(e) => setKey(e.target.value)} 
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
        </label>

        {error && <div className="alert-error" style={{ padding: '8px 12px', fontSize: '13px' }}>{error}</div>}

        <div className="row" style={{ marginTop: '8px' }}>
          <button type="button" className="secondary full" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="full" disabled={busy}>
            {busy ? 'Processing Refund…' : 'Confirm Refund'}
          </button>
        </div>
      </form>
    </div>
  );
}