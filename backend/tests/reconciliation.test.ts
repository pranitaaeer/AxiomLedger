import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pg } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';

let accA: string, accB: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, settlements, webhook_events, reconciliation_runs RESTART IDENTITY CASCADE`);
  await redis.flushdb();

  const a = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'user', 'INR') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'merchant', 'INR') RETURNING id`);
  accA = a.rows[0].id;
  accB = b.rows[0].id;
});

afterAll(async () => {
  try { await pg.end(); } catch {}
  try { await redis.quit(); } catch {}
});

describe('Reconciliation Engine', () => {
  let transferId1: string;
  let transferId2: string;

  beforeAll(async () => {
    // Create 2 SETTLED transfers in our ledger
    const t1 = await request(app).post('/transfers').set('Idempotency-Key', 'recon-1')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' });
    transferId1 = t1.body.id;

    const t2 = await request(app).post('/transfers').set('Idempotency-Key', 'recon-2')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 2000, currency: 'INR' });
    transferId2 = t2.body.id;
  });

  it('flags all transfers as mismatched when no settlements exist', async () => {
    const res = await request(app).post('/reconciliation/run');
    expect(res.status).toBe(200);
    expect(res.body.total_mismatched).toBe(2); // Both missing in provider
    expect(res.body.total_matched).toBe(0);
  });

  it('matches a transfer when settlement exists', async () => {
    // Simulate bank webhook for transferId1
    await request(app).post('/webhooks/simulate')
      .send({ transferId: transferId1, amountMinor: 1000, currency: 'INR' });

    const res = await request(app).post('/reconciliation/run');
    expect(res.body.total_matched).toBe(1); // transferId1 matched
    expect(res.body.total_mismatched).toBe(1); // transferId2 still missing
  });

  it('detects amount mismatch', async () => {
    // Manually insert a settlement with WRONG amount
    await pg.query(
      `INSERT INTO settlements (provider_ref, transfer_id, amount_minor, currency, status)
       VALUES ($1, $2, $3, 'INR', 'SETTLED')`,
      [`fake-ref-${Date.now()}`, transferId2, 500] // Wrong amount (expected 2000)
    );

    const res = await request(app).post('/reconciliation/run');
    const details = res.body.details;
    
    const mismatch = details.find((d: any) => d.transferId === transferId2);
    expect(mismatch).toBeDefined();
    expect(mismatch.reason).toBe('Amount Mismatch');
    expect(mismatch.ledgerAmount).toBe('2000');
    expect(mismatch.providerAmount).toBe(500);
  });
});