

import { pg } from '../../config/db.js';

export async function runReconciliation() {
  // 1. Ledger side: Fetch all SETTLED transfers
  const { rows: ledgerTransfers } = await pg.query(
    `SELECT id, amount_minor FROM transfers WHERE status = 'SETTLED'`
  );

  // 2. Provider side: Fetch all SETTLED settlements
  const { rows: providerSettlements } = await pg.query(
    `SELECT transfer_id, amount_minor FROM settlements WHERE status = 'SETTLED'`
  );

  // Map provider data for fast lookup
  const providerMap = new Map(
    providerSettlements.map((s) => [s.transfer_id, Number(s.amount_minor)])
  );

  let matched = 0;
  const mismatches: any[] = [];

  // 3. Compare Ledger against Provider
  for (const t of ledgerTransfers) {
    const providerAmount = providerMap.get(t.id);

    if (providerAmount === undefined) {
      mismatches.push({ 
        transferId: t.id, 
        reason: 'Missing in Provider (Bank has no record)' 
      });
    } else if (providerAmount !== Number(t.amount_minor)) {
      mismatches.push({ 
        transferId: t.id, 
        reason: 'Amount Mismatch',
        ledgerAmount: t.amount_minor,
        providerAmount
      });
    } else {
      matched++;
      providerMap.delete(t.id); // Remove from map to track extras
    }
  }

  // 4. Any settlements left in map are extra (Provider has them, but Ledger doesn't)
  for (const [transferId, amount] of providerMap.entries()) {
    mismatches.push({ 
      transferId, 
      reason: 'Missing in Ledger (Bank settled, but not in our system)',
      providerAmount: amount
    });
  }

  // 5. Save the audit run to DB
  const { rows: [run] } = await pg.query(
    `INSERT INTO reconciliation_runs (total_matched, total_mismatched, details)
     VALUES ($1, $2, $3) RETURNING *`,
    [matched, mismatches.length, JSON.stringify(mismatches)]
  );

  return run;
}