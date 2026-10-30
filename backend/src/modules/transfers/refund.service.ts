import { pg } from '../../config/db.js';

export type RefundInput = {
  originalTransferId: string;
  idempotencyKey: string;
  amountMinor: number;
  reason?: string;
};

export async function createRefund(input: RefundInput) {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    // 1) original transfer fetch
    const { rows: [original] } = await client.query(
      `SELECT * FROM transfers WHERE id=$1`,
      [input.originalTransferId]
    );
    if (!original) throw new Error('Original transfer not found');
    if (original.status !== 'SETTLED') {
      throw new Error(`Cannot refund transfer in status ${original.status}`);
    }

    // 2) already refunded amount check
    const { rows: [sum] } = await client.query(
      `SELECT COALESCE(SUM(amount_minor),0)::bigint AS refunded FROM refunds
       WHERE original_transfer_id=$1 AND status='SETTLED'`,
      [input.originalTransferId]
    );
    const alreadyRefunded = Number(sum.refunded);
    if (alreadyRefunded + input.amountMinor > Number(original.amount_minor)) {
      throw new Error('Refund amount exceeds original transfer amount');
    }

    // 3) refund row
    const { rows: [refund] } = await client.query(
      `INSERT INTO refunds (original_transfer_id, idempotency_key, amount_minor, reason, status)
       VALUES ($1,$2,$3,$4,'SETTLED') RETURNING *`,
      [input.originalTransferId, input.idempotencyKey, input.amountMinor, input.reason ?? null]
    );

    // 4) reverse entries: original debit -> new credit; original credit -> new debit
    await client.query(
      `INSERT INTO entries (transfer_id, account_id, direction, amount_minor)
       VALUES ($1,$2,'credit',$4), ($1,$3,'debit',$4)`,
      [original.id, original.from_account_id, original.to_account_id, input.amountMinor]
    );

    await client.query('COMMIT');
    return refund;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}