

import { useEffect, useState } from 'react';
import '../styles/SettingsPage.scss';

type Account = {
  id: string;
  type: string;
  currency: string;
  balance_minor: number;
};

export function SettingsPage() {
  // Real Data States
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // UI States
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch Real Data on load
  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(res => res.json()),
      fetch('/api/accounts').then(res => res.json())
    ]).then(([settings, accountsData]) => {
      setApiKey(settings.api_key || '');
      setWebhookUrl(settings.webhook_url || '');
      setAccounts(accountsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  // Save Webhook URL
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/settings/webhook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Regenerate API Key
  const handleRegenerateKey = async () => {
    if (!window.confirm("Are you sure? This will instantly break any existing API integrations.")) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/regenerate-key', { method: 'POST' });
      const data = await res.json();
      if (data.apiKey) setApiKey(data.apiKey);
    } finally {
      setSaving(false);
    }
  };

  // Calculate & Filter
  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance_minor), 0) / 100;
  const filteredAccounts = accounts.filter(acc => 
    acc.id.toLowerCase().includes(search.toLowerCase()) || 
    acc.type.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="dashboard-container"><p className="muted">Loading settings...</p></div>;

  return (
    <div className="settings-page fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      <div className="settings-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px' }}>Settings & Organization</h2>
        <p className="muted">Manage your accounts, API credentials, and webhook endpoints.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* SECTION 1: CONNECTED ACCOUNTS */}
        <div className="card">
          <div className="row between" style={{ marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>Connected Accounts</h3>
              <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
                Total: {accounts.length} accounts | Net Balance: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalBalance)}
              </p>
            </div>
            <input 
              type="text" 
              placeholder="Search accounts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px', width: '250px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredAccounts.map(acc => {
              const balance = Number(acc.balance_minor) / 100;
              const isNegative = balance < 0;
              return (
                <div key={acc.id} style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: `1px solid ${isNegative ? 'var(--red)' : 'var(--border)'}` }}>
                  <div className="row between" style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>
                      {acc.type}
                    </span>
                    <span className={`pill ${isNegative ? 'failed' : 'settled'}`} style={{ fontSize: '10px' }}>
                      {isNegative ? 'NEGATIVE' : 'ACTIVE'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {acc.id}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: isNegative ? 'var(--red)' : 'var(--text)' }}>
                    {acc.currency} {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: API & WEBHOOKS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* API Credentials */}
          <div className="card">
            <div className="row between">
              <h3 style={{ margin: '0 0 8px' }}>API Credentials</h3>
              <button onClick={handleRegenerateKey} className="secondary btn-small" style={{ color: 'var(--red)' }} disabled={saving}>
                Regenerate
              </button>
            </div>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              Use this secret key to authenticate server-to-server requests.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type={showKey ? 'text' : 'password'} 
                value={apiKey} 
                readOnly 
                style={{ fontFamily: 'monospace', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)' }}
              />
              <div className="row" style={{ gap: '8px' }}>
                <button className="secondary" style={{ flex: 1 }} onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide' : 'Reveal'}
                </button>
                <button 
                  className="secondary" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    alert('API Key copied!');
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Settings */}
          <div className="card">
            <h3 style={{ margin: '0 0 8px' }}>Webhook Subscriptions</h3>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              We'll send POST requests here when a bank settlement is received.
            </p>
            <form onSubmit={handleSaveWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="url" 
                value={webhookUrl} 
                onChange={(e) => setWebhookUrl(e.target.value)} 
                required
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)' }}
              />
              <div className="row between" style={{ alignItems: 'center' }}>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px' }}>
                  {saving ? 'Saving...' : 'Save Endpoint'}
                </button>
                {saved && <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 600 }}>✓ Saved to DB</span>}
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}