import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pg } from '../config/db.js';
import { redis } from '../config/redis.js';
import { assertLedgerBalanced } from '../utils/invariant.js';

let accA: string;
let accB: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, transfers, accounts RESTART IDENTITY CASCADE`);
  await redis.flushdb();

  const a = await pg.query(
    `INSERT INTO accounts (owner_id, type) VALUES (gen_random_uuid(), 'user') RETURNING id`
  );
  const b = await pg.query(
    `INSERT INTO accounts (owner_id, type) VALUES (gen_random_uuid(), 'merchant') RETURNING id`
  );
  accA = a.rows[0].id;
  accB = b.rows[0].id;
});

afterAll(async () => {
  try {
    await pg.end();
  } catch (e: any) {
    if (!/more than once/.test(e.message)) throw e;
  }
  try {
    await redis.quit();
  } catch {}
});

describe('Ledger invariants', () => {
  it('debits === credits after 50 transfers', async () => {
    for (let i = 0; i < 50; i++) {
      await request(app)
        .post('/transfers')
        .set('Idempotency-Key', `test-${i}`)
        .send({
          fromAccountId: accA,
          toAccountId: accB,
          amountMinor: 100 + i,
          currency: 'INR'
        });
    }
    const { debit, credit } = await assertLedgerBalanced();
    expect(debit).toBe(credit);
  });

  it('idempotency key prevents duplicate transfers', async () => {
    const payload = {
      fromAccountId: accA,
      toAccountId: accB,
      amountMinor: 500,
      currency: 'INR'
    };
    const r1 = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'same-key')
      .send(payload);
    const r2 = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'same-key')
      .send(payload);

    expect(r1.status).toBe(201);
    expect(r2.body.id).toBe(r1.body.id);

    const { rows } = await pg.query(
      `SELECT COUNT(*) FROM transfers WHERE idempotency_key='same-key'`
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('entries cannot be updated', async () => {
    const { rows } = await pg.query(`SELECT id FROM entries LIMIT 1`);
    await expect(
      pg.query(`UPDATE entries SET amount_minor=1 WHERE id=$1`, [rows[0].id])
    ).rejects.toThrow(/immutable/);
  });
});