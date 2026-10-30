import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pg } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';
import { assertLedgerBalanced } from '../src/utils/invariant.js';

let accA: string, accB: string, transferId: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, webhook_events, settlements RESTART IDENTITY CASCADE`);
  await redis.flushdb();
  const a = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'user') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'merchant') RETURNING id`);
  accA = a.rows[0].id; accB = b.rows[0].id;

  const t = await request(app).post('/transfers')
    .set('Idempotency-Key', 'orig-001')
    .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' });
  transferId = t.body.id;
});

afterAll(async () => { try { await pg.end(); } catch {} try { await redis.quit(); } catch {} });

describe('Refunds', () => {
  it('refund creates reverse entries and stays balanced', async () => {
    const r = await request(app).post(`/transfers/${transferId}/refund`)
      .set('Idempotency-Key', 'refund-001')
      .send({ amountMinor: 400, reason: 'partial refund' });

    expect(r.status).toBe(201);
    const { debit, credit } = await assertLedgerBalanced();
    expect(debit).toBe(credit);
  });

  it('refund cannot exceed original amount', async () => {
    const r = await request(app).post(`/transfers/${transferId}/refund`)
      .set('Idempotency-Key', 'refund-002')
      .send({ amountMinor: 9999 });
    expect(r.status).toBe(400);
  });

  it('idempotent refund does not duplicate', async () => {
    await request(app).post(`/transfers/${transferId}/refund`).set('Idempotency-Key', 'refund-003').send({ amountMinor: 100 });
    await request(app).post(`/transfers/${transferId}/refund`).set('Idempotency-Key', 'refund-003').send({ amountMinor: 100 });

    const { rows } = await pg.query(`SELECT COUNT(*) FROM refunds WHERE idempotency_key='refund-003'`);
    expect(Number(rows[0].count)).toBe(1);
  });
});