

import { useEffect, useState } from 'react';
import { ReconciliationPanel } from '../components/ReconciliationPanel';

type Transfer = {
  id: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
};

type MismatchDetail = {
  transferId: string;
  reason: string;
  ledgerAmount?: number;
  providerAmount?: number;
};

export function ReconciliationPage() {
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mismatches, setMismatches] = useState<MismatchDetail[]>([]);

  // 1. Fetch pending transfers & mismatches on load
  const loadData = async () => {
    try {
      // Fetch pending transfers
      const pendingRes = await fetch('https://axiomledger.onrender.com/webhooks/pending');
      const pendingData = await pendingRes.json();
      setPendingTransfers(pendingData);
      if (pendingData.length > 0 && !selectedId) {
        setSelectedId(pendingData[0].id);
      }

      // Fetch mismatches from latest reconciliation run
      const mismatchRes = await fetch('https://axiomledger.onrender.com/reconciliation/latest');
      const mismatchData = await mismatchRes.json();
      setMismatches(mismatchData.details || []);

    } catch (err) {
      console.error("Failed to load data", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  // 2. Handle Simulate Webhook
  const handleSimulate = async () => {
    if (!selectedId) return;
    setSimulating(true);
    setMessage(null);

    const transfer = pendingTransfers.find(t => t.id === selectedId);
    if (!transfer) return;

    try {
      // Send fake webhook
      const simRes = await fetch('https://axiomledger.onrender.com/webhooks/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: transfer.id,
          amountMinor: transfer.amount_minor,
          currency: transfer.currency
        })
      });

      if (!simRes.ok) throw new Error("Simulation failed");
      
      const data = await simRes.json();
      setMessage({ text: `✅ Bank settlement received! Ref: ${data.providerRef}`, type: 'success' });
      
      // Auto-run reconciliation immediately after webhook
      await fetch('https://axiomledger.onrender.com/reconciliation/run', { method: 'POST' });
      
      // Refresh the page data
      setSelectedId('');
      setRefreshKey(k => k + 1);

    } catch (err: any) {
      setMessage({ text: `❌ Error: ${err.message}`, type: 'error' });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="dashboard-container">
      
      {/* HEADER */}
      <div className="hero" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px' }}>⚖️ Reconciliation Center</h2>
          <p className="muted" style={{ margin: 0 }}>
            Match internal ledger transfers with external bank settlements.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        
        {/* LEFT: SIMULATE WEBHOOK PANEL */}
        <div className="card">
          <h2>📡 Simulate Bank Webhook</h2>
          <p className="muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
            Select a settled transfer to simulate an incoming bank settlement webhook for it.
          </p>

          {pendingTransfers.length === 0 ? (
            <div className="empty" style={{ padding: '32px 0', textAlign: 'center' }}>
              <div className="empty-icon">📭</div>
              <p className="empty-title">No pending settlements</p>
              <p className="muted">All settled transfers have already been reconciled with the bank.</p>
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Select Transfer to Settle
                <select 
                  value={selectedId} 
                  onChange={e => setSelectedId(e.target.value)} 
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)' }}
                >
                  {pendingTransfers.map(t => (
                    <option key={t.id} value={t.id}>
                      ₹{(t.amount_minor / 100).toLocaleString()} — {t.id.slice(0, 8)} ({new Date(t.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </label>

              <button 
                onClick={handleSimulate} 
                disabled={simulating} 
                style={{ marginTop: '16px', height: '48px', fontSize: '15px', fontWeight: 700, background: 'var(--primary)', color: 'var(--primary-text)', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
              >
                {simulating ? 'Transmitting Webhook...' : '📡 Send Settlement Webhook'}
              </button>
            </>
          )}

          {message && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: message.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)', color: message.type === 'success' ? 'var(--green)' : 'var(--red)', fontSize: '13px', fontWeight: 600 }}>
              {message.text}
            </div>
          )}
        </div>

        {/* RIGHT: RECONCILIATION ENGINE */}
        <div className="stack">
          <ReconciliationPanel refreshKey={refreshKey} />
        </div>

      </div>

      {/* NAYA SECTION: INVESTIGATION QUEUE */}
      {mismatches.length > 0 && (
        <div className="card fade-in" style={{ marginTop: '24px', borderLeft: '4px solid var(--red)' }}>
          <div className="row between" style={{ marginBottom: '16px' }}>
            <div>
              <h2 style={{ color: 'var(--red)', margin: '0 0 4px' }}>🔍 Investigation Queue ({mismatches.length})</h2>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                These transactions are present in the ledger but missing from bank settlements. Manual review required.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {mismatches.map((m, i) => (
              <div key={i} className="row between" style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>{m.transferId}</strong>
                  <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>{m.reason}</div>
                </div>
                {m.ledgerAmount !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Ledger Amt</div>
                    <strong style={{ color: 'var(--red)' }}>₹{(m.ledgerAmount / 100).toLocaleString()}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}