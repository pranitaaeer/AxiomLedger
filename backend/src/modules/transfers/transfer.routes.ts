

import { Router } from 'express';
import { z } from 'zod';
import { idempotency } from '../../middleware/idempotency.js';
import { createTransfer, getBalance } from './transfer.service.js';
import { createRefund } from './refund.service.js';
import { pg } from '../../config/db.js';

export const transferRouter = Router();

// Zod Schemas
const createSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3)
});

const refundSchema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().optional()
});

// ==========================================
// ⚡ BULK PAYOUT (IMPORTANT: Keep this ABOVE /:id routes)
// ==========================================
transferRouter.post('/transfers/bulk', async (req, res) => {
  const { transfers } = req.body;

  if (!Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ error: 'Invalid bulk payload. Provide an array of transfers.' });
  }

  const results = {
    total: transfers.length,
    success: 0,
    failed: 0,
    errors: [] as any[]
  };

  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    try {
      if (!t.fromAccountId || !t.toAccountId || !t.amountMinor) {
        throw new Error("Missing required fields");
      }

      await createTransfer({
        idempotencyKey: `bulk_${Date.now()}_${i}`, 
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        amountMinor: Number(t.amountMinor),
        currency: t.currency || 'INR'
      });
      
      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push({
        row: i + 1,
        error: err.message,
        data: t
      });
    }
  }

  res.json(results);
});


// ==========================================
// STANDARD TRANSFER ROUTES
// ==========================================
transferRouter.post('/transfers', idempotency, async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const key = req.header('Idempotency-Key')!;
    const transfer = await createTransfer({ ...body, idempotencyKey: key });
    res.status(201).json(transfer);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

transferRouter.get('/accounts/:id/balance', async (req, res) => {
  try {
    const balance = await getBalance(req.params.id);
    res.json({ accountId: req.params.id, balanceMinor: balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// REFUND & APPROVAL ROUTES (Must be below bulk)
// ==========================================
transferRouter.post('/transfers/:id/refund', idempotency, async (req, res) => {
  try {
    const body = refundSchema.parse(req.body);
    const key = req.header('Idempotency-Key')!;
    const refund = await createRefund({
      originalTransferId: req.params.id,
      idempotencyKey: key,
      amountMinor: body.amountMinor,
      reason: body.reason
    });
    res.status(201).json(refund);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(400).json({ error: err.message });
  }
});

transferRouter.post('/transfers/:id/approve', async (req, res) => {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    const { rows: [transfer] } = await client.query(
      `SELECT * FROM transfers WHERE id=$1 AND status='REVIEW' FOR UPDATE`, 
      [req.params.id]
    );
    
    if (!transfer) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transfer not found or not in REVIEW state' });
    }

    await client.query(
      `INSERT INTO entries (transfer_id, account_id, direction, amount_minor)
       VALUES ($1, $2, 'debit', $3), ($1, $4, 'credit', $3)`,
      [transfer.id, transfer.from_account_id, transfer.amount_minor, transfer.to_account_id]
    );

    await client.query(`UPDATE transfers SET status='SETTLED' WHERE id=$1`, [transfer.id]);
    await client.query('COMMIT');
    res.json({ success: true, status: 'SETTLED', id: transfer.id });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

transferRouter.post('/transfers/:id/reject', async (req, res) => {
  try {
    const { rowCount } = await pg.query(
      `UPDATE transfers SET status='FAILED', failure_reason='Rejected by Risk Team' 
       WHERE id=$1 AND status='REVIEW'`, 
      [req.params.id]
    );
    if (rowCount === 0) return res.status(400).json({ error: 'Transfer not in review' });
    res.json({ success: true, status: 'FAILED' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});