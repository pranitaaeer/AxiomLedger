import { pg } from '../../config/db.js';

export async function getRecentTransfers() {
  const { rows } = await pg.query(`SELECT * FROM transfers ORDER BY created_at DESC LIMIT 50`);
  return rows;
}

export async function getEntriesForTransfer(transferId: string) {
  const { rows } = await pg.query(
    `SELECT * FROM entries WHERE transfer_id=$1 ORDER BY id ASC`,
    [transferId]
  );
  return rows;
}

export async function getAllAccountsWithBalances() {
  const { rows } = await pg.query(`
    SELECT 
      a.id, a.type, a.currency, a.created_at,
      COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount_minor 
                        WHEN e.direction = 'debit'  THEN -e.amount_minor 
                        ELSE 0 END), 0)::bigint AS balance_minor
    FROM accounts a
    LEFT JOIN entries e ON a.id = e.account_id
    GROUP BY a.id, a.type, a.currency, a.created_at
    ORDER BY a.created_at DESC
  `);
  return rows;
}

export async function getSettings() {
  const { rows } = await pg.query(`SELECT key, value FROM settings`);
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
}

export async function updateWebhookUrl(url: string) {
  await pg.query(
    `INSERT INTO settings (key, value) VALUES ('webhook_url', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [url]
  );
}

export async function regenerateApiKey() {
  const newKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await pg.query(
    `UPDATE settings SET value = $1, updated_at = now() WHERE key = 'api_key'`,
    [newKey]
  );
  return newKey;
}

export async function generateBulkCsv() {
  const { rows } = await pg.query(`SELECT id, type, currency FROM accounts ORDER BY created_at ASC`);
  if (rows.length < 2) throw new Error('Need at least 2 accounts');

  let csvContent = 'fromAccountId,toAccountId,amountMinor\n';
  const fromId = rows[0].id;
  for (let i = 1; i < rows.length; i++) {
    csvContent += `${fromId},${rows[i].id},50000\n`;
  }
  return csvContent;
}