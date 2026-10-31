
import { useState } from 'react';

type BulkResult = {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
};

export function BulkPayout() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      const data = lines.slice(1).map(line => {
        const [fromAccountId, toAccountId, amountMinor] = line.split(',');
        return {
          fromAccountId: fromAccountId?.trim(),
          toAccountId: toAccountId?.trim(),
          amountMinor: Number(amountMinor?.trim()),
          currency: 'INR'
        };
      }).filter(t => t.fromAccountId && t.toAccountId && !isNaN(t.amountMinor));

      setParsedData(data);
    };
    reader.readAsText(uploadedFile);
  };

  const handleProcess = async () => {
    if (parsedData.length === 0) return;
    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('https://axiomledger.onrender.com/transfers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfers: parsedData })
      });
      
      if (!res.ok) throw new Error("Bulk API failed");
      
      const data = await res.json();
      setResult(data);
      window.dispatchEvent(new Event('refresh-data'));

    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  // NAYA FUNCTION: Backend se real CSV download karo
  const downloadRealCSV = async () => {
    try {
      const res = await fetch('https://axiomledger.onrender.com/accounts/export-csv');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to download');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'real-bulk-payout.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("⚠️ " + err.message);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      
      <div className="hero" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px' }}>📦 Bulk Payouts</h2>
          <p className="muted" style={{ margin: 0 }}>Upload a CSV to process multiple transfers at once.</p>
        </div>
        {/* Button name change kiya */}
        <button className="secondary" onClick={downloadRealCSV}>⬇ Download Real Accounts CSV</button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        
        <div className="card">
          <h2>1. Upload CSV File</h2>
          <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
            Format: <code>fromAccountId, toAccountId, amountMinor</code>
          </p>

          <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '32px 20px', textAlign: 'center', background: 'var(--bg-input)' }}>
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} id="csv-upload" />
            <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '32px' }}>📄</span>
              <span style={{ fontWeight: 600 }}>{file ? file.name : 'Click to select CSV file'}</span>
              <span className="muted" style={{ fontSize: '12px' }}>Only .csv files are supported</span>
            </label>
          </div>

          {parsedData.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <button onClick={handleProcess} disabled={busy} className="full" style={{ height: '48px', fontSize: '15px' }}>
                {busy ? 'Processing Transfers...' : `🚀 Process ${parsedData.length} Transfers`}
              </button>
            </div>
          )}
        </div>

        <div className="stack">
          {result && (
            <div className="card fade-in" style={{ borderLeft: '4px solid var(--primary)' }}>
              <h2>Execution Results</h2>
              <div className="row" style={{ gap: '16px', marginTop: '16px' }}>
                <div style={{ flex: 1, padding: '16px', background: 'var(--green-bg)', borderRadius: '8px', color: 'var(--green)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800 }}>{result.success}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Successful</div>
                </div>
                <div style={{ flex: 1, padding: '16px', background: 'var(--red-bg)', borderRadius: '8px', color: 'var(--red)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800 }}>{result.failed}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Failed</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontWeight: 700, color: 'var(--red)', fontSize: '13px' }}>Error Details:</p>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {result.errors.map((e, i) => (
                      <li key={i}>Row {e.row}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {parsedData.length > 0 && !result && (
            <div className="card">
              <h2>Preview ({parsedData.length} rows)</h2>
              <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '12px' }}>
                <table className="ledger-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr><th>From</th><th>To</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {parsedData.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace' }}>{t.fromAccountId.slice(0, 8)}...</td>
                        <td style={{ fontFamily: 'monospace' }}>{t.toAccountId.slice(0, 8)}...</td>
                        <td style={{ fontWeight: 'bold' }}>₹{(t.amountMinor / 100).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}