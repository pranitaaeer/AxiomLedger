

import { useState } from 'react';
import { apiClient } from '../api/client';

export function TransferForm({ onCreated }: { onCreated: () => void }) {
  const [fromAccountId, setFrom] = useState('');
  const [toAccountId, setTo] = useState('');
  const [amountMajor, setAmountMajor] = useState<number>(500); // User enters in rupees (₹)
  const [currency, setCurrency] = useState('INR');
  const [idempotencyKey, setKey] = useState(() => `web-${Date.now()}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Convert rupees/major units to minor units (paise) for the backend API
    const amountMinor = Math.round(amountMajor * 100);

    if (amountMinor <= 0) {
      setError('Amount 0 se zyada honi chahiye.');
      setBusy(false);
      return;
    }

    try {
      await apiClient.createTransfer({
        fromAccountId,
        toAccountId,
        amountMinor,
        currency,
        idempotencyKey,
      });
      // Reset form & generate new idempotency key for safety
      setKey(`web-${Date.now()}`);
      setFrom('');
      setTo('');
      setAmountMajor(500);
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Transfer create nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card fade-in" onSubmit={submit}>
      <div className="card-header" style={{ marginBottom: '4px' }}>
        <h2>Initiate Transfer</h2>
        <p className="muted">Create a new secure double-entry financial transaction.</p>
      </div>

      <label>
        From Account ID
        <input
          value={fromAccountId}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="e.g. acc_sender_123"
          required
        />
      </label>

      <label>
        To Account ID
        <input
          value={toAccountId}
          onChange={(e) => setTo(e.target.value)}
          placeholder="e.g. acc_receiver_456"
          required
        />
      </label>

      <div className="row">
        <label style={{ flex: 1 }}>
          Amount (₹)
          <input
            type="number"
            step="0.01"
            min="1"
            value={amountMajor}
            onChange={(e) => setAmountMajor(Number(e.target.value))}
            required
          />
        </label>
        <label style={{ width: '120px' }}>
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            required
          />
        </label>
      </div>

      <label>
        Idempotency Key (Auto-generated)
        <input
          value={idempotencyKey}
          onChange={(e) => setKey(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
          required
        />
      </label>

      {error && <div className="alert-error" style={{ padding: '8px 12px', fontSize: '13px' }}>{error}</div>}

      <button type="submit" className="full" disabled={busy} style={{ marginTop: '8px' }}>
        {busy ? 'Processing Transfer…' : 'Create Transfer ⇄'}
      </button>
    </form>
  );
}