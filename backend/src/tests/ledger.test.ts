import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pg } from '../config/db.js';
import { redis } from '../config/redis.js';
import { assertLedgerBalanced } from '../utils/invariant.js';

let accA: string, accB: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, webhook_events, settlements RESTART IDENTITY CASCADE`);
  await redis.flushdb();
  const a = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'user') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'merchant') RETURNING id`);
  accA = a.rows[0].id; accB = b.rows[0].id;
});

afterAll(async () => { try { await pg.end(); } catch {} try { await redis.quit(); } catch {} });

describe('Core Ledger', () => {
  it('creates a balanced double-entry transfer', async () => {
    const res = await request(app).post('/transfers')
      .set('Idempotency-Key', 'ledger-001')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' });
    
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SETTLED');
    
    const { debit, credit } = await assertLedgerBalanced();
    expect(debit).toBe(credit);
  });

  it('idempotency key prevents duplicate transfers', async () => {
    const payload = { fromAccountId: accA, toAccountId: accB, amountMinor: 500, currency: 'INR' };
    await request(app).post('/transfers').set('Idempotency-Key', 'idem-001').send(payload);
    await request(app).post('/transfers').set('Idempotency-Key', 'idem-001').send(payload);

    const { rows } = await pg.query(`SELECT COUNT(*) FROM transfers WHERE idempotency_key='idem-001'`);
    expect(Number(rows[0].count)).toBe(1);
  });
});