// import { Router } from 'express';
// import { pg } from '../../config/db.js';

// export const ledgerRouter = Router();

// // list transfers
// ledgerRouter.get('/transfers', async (_req, res) => {
//   const { rows } = await pg.query(
//     `SELECT * FROM transfers ORDER BY created_at DESC LIMIT 50`
//   );
//   res.json(rows);
// });

// // list entries for a transfer
// ledgerRouter.get('/transfers/:id/entries', async (req, res) => {
//   const { rows } = await pg.query(
//     `SELECT * FROM entries WHERE transfer_id=$1 ORDER BY id ASC`,
//     [req.params.id]
//   );
//   res.json(rows);
// });

// // List all accounts with live balances
// ledgerRouter.get('/accounts', async (_req, res) => {
//   try {
//     const { rows } = await pg.query(`
//       SELECT 
//         a.id, 
//         a.type, 
//         a.currency, 
//         a.created_at,
//         COALESCE(
//           SUM(CASE WHEN e.direction = 'credit' THEN e.amount_minor 
//                    WHEN e.direction = 'debit'  THEN -e.amount_minor 
//                    ELSE 0 END), 
//           0
//         )::bigint AS balance_minor
//       FROM accounts a
//       LEFT JOIN entries e ON a.id = e.account_id
//       GROUP BY a.id, a.type, a.currency, a.created_at
//       ORDER BY a.created_at DESC
//     `);
//     res.json(rows);
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Export Real Accounts for CSV (Dynamic)
// ledgerRouter.get('/accounts/export-csv', async (_req, res) => {
//   try {
//     const { rows } = await pg.query(`SELECT id, type, currency FROM accounts ORDER BY created_at ASC`);

//     if (rows.length < 2) {
//       return res.status(400).json({ error: 'Need at least 2 accounts in DB to generate CSV' });
//     }

//     // CSV Header
//     let csvContent = 'fromAccountId,toAccountId,amountMinor\n';

//     const fromId = rows[0].id;

//     for (let i = 1; i < rows.length; i++) {
//       const toId = rows[i].id;
//       // Default amount 50000 (₹500) rakh rahe hain, user isko change kar sakta hai
//       csvContent += `${fromId},${toId},50000\n`;
//     }

//     res.header('Content-Type', 'text/csv');
//     res.attachment('bulk-payout-template.csv');
//     return res.send(csvContent);

//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // GET Settings
// ledgerRouter.get('/settings', async (_req, res) => {
//   try {
//     const { rows } = await pg.query(`SELECT key, value FROM settings`);
//     // Convert array of {key, value} to object
//     const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
//     res.json(settings);
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // UPDATE Webhook URL
// ledgerRouter.put('/settings/webhook', async (req, res) => {
//   const { webhookUrl } = req.body;
//   try {
//     await pg.query(
//       `INSERT INTO settings (key, value) VALUES ('webhook_url', $1)
//        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
//       [webhookUrl]
//     );
//     res.json({ success: true, message: 'Webhook URL updated' });
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // REGENERATE API Key
// ledgerRouter.post('/settings/regenerate-key', async (_req, res) => {
//   try {
//     // Generate new random key
//     const newKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
//     await pg.query(
//       `UPDATE settings SET value = $1, updated_at = now() WHERE key = 'api_key'`,
//       [newKey]
//     );
//     res.json({ success: true, apiKey: newKey });
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// });

import { Router } from 'express';
import { 
  getRecentTransfers, getEntriesForTransfer, getAllAccountsWithBalances, 
  getSettings, updateWebhookUrl, regenerateApiKey, generateBulkCsv
} from './ledger.service.js';

export const ledgerRouter = Router();

ledgerRouter.get('/transfers', async (_req, res) => {
  try {
    const transfers = await getRecentTransfers();
    res.json(transfers);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

ledgerRouter.get('/transfers/:id/entries', async (req, res) => {
  try {
    const entries = await getEntriesForTransfer(req.params.id);
    res.json(entries);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

ledgerRouter.get('/accounts', async (_req, res) => {
  try {
    const accounts = await getAllAccountsWithBalances();
    res.json(accounts);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

ledgerRouter.get('/accounts/export-csv', async (_req, res) => {
  try {
    const csv = await generateBulkCsv();
    res.header('Content-Type', 'text/csv');
    res.attachment('bulk-payout-template.csv');
    return res.send(csv);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

ledgerRouter.get('/settings', async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

ledgerRouter.put('/settings/webhook', async (req, res) => {
  try {
    await updateWebhookUrl(req.body.webhookUrl);
    res.json({ success: true, message: 'Webhook URL updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

ledgerRouter.post('/settings/regenerate-key', async (_req, res) => {
  try {
    const newKey = await regenerateApiKey();
    res.json({ success: true, apiKey: newKey });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});