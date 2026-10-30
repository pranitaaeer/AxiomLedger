import { pg } from '../../config/db.js';
import { assessRisk } from './risk.service.js';

export type CreateTransferInput = {
  idempotencyKey: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  currency: string;
};

export async function createTransfer(input: CreateTransferInput) {
  const client = await pg.connect();
  try {
    const risk = await assessRisk(input.fromAccountId, input.amountMinor);
    const initialStatus = risk.action === 'REVIEW' ? 'REVIEW' : 'PROCESSING';

    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const { rows: [transfer] } = await client.query(
      `INSERT INTO transfers (idempotency_key, from_account_id, to_account_id, amount_minor, currency, status, risk_score, risk_reasons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.idempotencyKey, input.fromAccountId, input.toAccountId, input.amountMinor, input.currency, initialStatus, risk.score, JSON.stringify(risk.reasons)]
    );

    if (risk.action === 'REVIEW') {
      await client.query('COMMIT');
      return { ...transfer, message: 'Transaction flagged for manual review.' };
    }

    await client.query(
      `INSERT INTO entries (transfer_id, account_id, direction, amount_minor)
       VALUES ($1, $2, 'debit', $3), ($1, $4, 'credit', $3)`,
      [transfer.id, input.fromAccountId, input.amountMinor, input.toAccountId]
    );

    await client.query(
      `UPDATE transfers SET status='SETTLED', updated_at=now() WHERE id=$1`,
      [transfer.id]
    );

    await client.query('COMMIT');
    return transfer;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBalance(accountId: string) {
  const { rows } = await pg.query(
    `SELECT
       COALESCE(SUM(CASE WHEN direction='credit' THEN amount_minor END), 0) AS credits,
       COALESCE(SUM(CASE WHEN direction='debit'  THEN amount_minor END), 0) AS debits
     FROM entries WHERE account_id=$1`,
    [accountId]
  );
  return Number(rows[0].credits) - Number(rows[0].debits);
}

// Mock AI Call
async function getAIExplanation(amount: number, reasonList: string[]) {
  // Agar real API hoti toh yahan OpenAI/Gemini call hota
  await new Promise(r => setTimeout(r, 500)); // Fake delay
  
  if (amount > 500000) return "High-value transaction detected. Pattern matches potential money laundering structure.";
  if (reasonList.includes('New device or IP address detected')) return "Login attempt from unrecognized device. Account takeover risk.";
  return "Anomaly detected based on historical user behavior patterns.";
}