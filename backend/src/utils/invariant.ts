import { pg } from '../config/db.js';

export async function assertLedgerBalanced() {
  const { rows } = await pg.query(`
    SELECT
      COALESCE(SUM(CASE WHEN direction='debit'  THEN amount_minor END), 0) AS debit_total,
      COALESCE(SUM(CASE WHEN direction='credit' THEN amount_minor END), 0) AS credit_total
    FROM entries
  `);
  const debit = Number(rows[0].debit_total);
  const credit = Number(rows[0].credit_total);
  if (debit !== credit) {
    throw new Error(`Ledger invariant broken: debit=${debit} credit=${credit}`);
  }
  return { debit, credit };
}