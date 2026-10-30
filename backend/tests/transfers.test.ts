import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pg } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';

let accA: string, accB: string;

beforeAll(async () => {
  // Clean DB
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, settlements, webhook_events, reconciliation_runs RESTART IDENTITY CASCADE`);
  await redis.flushdb();

  // Create test accounts
  const a = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'user', 'INR') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'merchant', 'INR') RETURNING id`);
  accA = a.rows[0].id;
  accB = b.rows[0].id;
});

afterAll(async () => {
  try { await pg.end(); } catch {}
  try { await redis.quit(); } catch {}
});

describe('Transfer Service', () => {
  it('creates a successful low-risk transfer', async () => {
    const res = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'transfer-test-1')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 5000, currency: 'INR' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SETTLED');

    // Verify entries
    const { rows } = await pg.query(`SELECT * FROM entries WHERE transfer_id=$1`, [res.body.id]);
    expect(rows.length).toBe(2); // 1 debit, 1 credit
    expect(rows[0].direction).toBe('debit');
    expect(rows[1].direction).toBe('credit');
  });

  it('flags high-value transfers for REVIEW', async () => {
    const res = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'transfer-test-2')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 6000000, currency: 'INR' }); // ₹60,000

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REVIEW');
    expect(res.body.risk_score).toBeGreaterThanOrEqual(40);
  });

  it('returns the same transfer for duplicate idempotency keys', async () => {
    const payload = { fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' };
    
    const first = await request(app).post('/transfers').set('Idempotency-Key', 'transfer-idem-1').send(payload);
    const second = await request(app).post('/transfers').set('Idempotency-Key', 'transfer-idem-1').send(payload);

    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id); // Same ID returned
  });

  it('rejects invalid transfer payload', async () => {
    const res = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'transfer-invalid')
      .send({ fromAccountId: 'not-a-uuid', toAccountId: accB, amountMinor: 1000, currency: 'INR' });

    expect(res.status).toBe(400);
  });
});