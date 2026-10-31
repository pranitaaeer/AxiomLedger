import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { pg } from '../config/db.js';
import { redis } from '../config/redis.js';

let accA: string;
let accB: string;
let testTransferId: string;

beforeAll(async () => {
  // 1. Clean DB
  await pg.query(`ALTER TABLE entries DISABLE TRIGGER entries_no_delete`);
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, settlements, webhook_events, reconciliation_runs, settings RESTART IDENTITY CASCADE`);
  await pg.query(`ALTER TABLE entries ENABLE TRIGGER entries_no_delete`);
  await redis.flushdb();

  // 2. Create Test Accounts
  const a = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'user', 'INR') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id, type, currency) VALUES (gen_random_uuid(), 'merchant', 'INR') RETURNING id`);
  accA = a.rows[0].id;
  accB = b.rows[0].id;

  // 3. Insert default settings
  await pg.query(`INSERT INTO settings (key, value) VALUES ('api_key', 'test_key_123'), ('webhook_url', 'http://test.com') ON CONFLICT DO NOTHING`);
});

afterAll(async () => {
  try { await pg.end(); } catch {}
  try { await redis.quit(); } catch {}
});

// ==========================================
// 1. CORE LEDGER & IDEMPOTENCY
// ==========================================
describe('1. Core Ledger & Idempotency', () => {
  it('should create a transfer and balance the ledger', async () => {
    const res = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'test-idem-1')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SETTLED'); 
    testTransferId = res.body.id;

    const { rows } = await pg.query(`SELECT direction, amount_minor FROM entries WHERE transfer_id=$1`, [testTransferId]);
    expect(rows.length).toBe(2);
    expect(rows[0].direction).toBe('debit');
    expect(rows[1].direction).toBe('credit');
  });

  it('should prevent duplicate transfers (Idempotency)', async () => {
    const payload = { fromAccountId: accA, toAccountId: accB, amountMinor: 500, currency: 'INR' };
    
    const res1 = await request(app).post('/transfers').set('Idempotency-Key', 'test-idem-2').send(payload);
    const res2 = await request(app).post('/transfers').set('Idempotency-Key', 'test-idem-2').send(payload);
    
    expect(res1.body.id).toBe(res2.body.id); // Same ID returned
    const { rows } = await pg.query(`SELECT id FROM transfers WHERE idempotency_key='test-idem-2'`);
    expect(rows.length).toBe(1); 
  });
});

// ==========================================
// 2. AI RISK ENGINE & APPROVALS
// ==========================================
describe('2. AI Risk Engine & Approvals', () => {
  it('should flag high-value transfers for REVIEW', async () => {
    const res = await request(app)
      .post('/transfers')
      .set('Idempotency-Key', 'test-idem-risk')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 6000000, currency: 'INR' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REVIEW'); 
    expect(res.body.risk_score).toBeGreaterThanOrEqual(40);
  });

  it('should allow admin to approve a REVIEW transfer', async () => {
    const { rows } = await pg.query(`SELECT id FROM transfers WHERE status='REVIEW' LIMIT 1`);
    const reviewId = rows[0].id;

    const res = await request(app).post(`/transfers/${reviewId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SETTLED');

    const { rows: entries } = await pg.query(`SELECT * FROM entries WHERE transfer_id=$1`, [reviewId]);
    expect(entries.length).toBe(2);
  });
});

// ==========================================
// 3. REFUNDS
// ==========================================
describe('3. Refunds', () => {
  it('should process a partial refund', async () => {
    const res = await request(app)
      .post(`/transfers/${testTransferId}/refund`)
      .set('Idempotency-Key', 'test-refund-1')
      .send({ amountMinor: 500, reason: 'partial refund' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SETTLED');

    const { rows } = await pg.query(`SELECT * FROM entries WHERE transfer_id=$1`, [testTransferId]);
    expect(rows.length).toBe(4); // 2 original + 2 reverse
  });

  it('should reject over-refunding', async () => {
    const res = await request(app)
      .post(`/transfers/${testTransferId}/refund`)
      .set('Idempotency-Key', 'test-refund-2')
      .send({ amountMinor: 99999, reason: 'fraud refund' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('exceeds');
  });
});

// ==========================================
// 4. WEBHOOKS & RECONCILIATION
// ==========================================
describe('4. Webhooks & Reconciliation', () => {
  it('should simulate a bank webhook and create a settlement', async () => {
    const res = await request(app)
      .post('/webhooks/simulate')
      .send({ transferId: testTransferId, amountMinor: 1000, currency: 'INR' });

    expect(res.status).toBe(200);
    
    const { rows } = await pg.query(`SELECT * FROM settlements WHERE transfer_id=$1`, [testTransferId]);
    expect(rows.length).toBe(1);
  });

  it('should run reconciliation and match settlements', async () => {
    const res = await request(app).post('/reconciliation/run');
    expect(res.status).toBe(200);
    expect(res.body.total_matched).toBeGreaterThanOrEqual(1);
  });
});

// ==========================================
// 5. BULK PAYOUTS (NAYA TEST)
// ==========================================
describe('5. Bulk Payouts', () => {
  it('should process multiple transfers at once', async () => {
    const res = await request(app).post('/transfers/bulk').send({
      transfers: [
        { fromAccountId: accA, toAccountId: accB, amountMinor: 500, currency: 'INR' },
        { fromAccountId: accA, toAccountId: accB, amountMinor: 700, currency: 'INR' },
        { fromAccountId: accA, toAccountId: accB, amountMinor: 1000, currency: 'INR' }
      ]
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(3);
    expect(res.body.failed).toBe(0);

    // Verify DB
    const { rows } = await pg.query(`SELECT COUNT(*) FROM transfers WHERE idempotency_key LIKE 'bulk_%'`);
    expect(Number(rows[0].count)).toBe(3);
  });

  it('should handle partial failures gracefully', async () => {
    const res = await request(app).post('/transfers/bulk').send({
      transfers: [
        { fromAccountId: accA, toAccountId: accB, amountMinor: 500, currency: 'INR' },
        { fromAccountId: 'invalid-uuid', toAccountId: accB, amountMinor: 700, currency: 'INR' },
      ]
    });

    expect(res.body.success).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors.length).toBe(1);
  });
});

// ==========================================
// 6. SETTINGS API
// ==========================================
describe('6. Settings API', () => {
  it('should fetch and update settings', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(res.body.api_key).toBe('test_key_123');

    const updateRes = await request(app)
      .put('/settings/webhook')
      .send({ webhookUrl: 'https://new-url.com' });
    expect(updateRes.status).toBe(200);

    const { rows } = await pg.query(`SELECT value FROM settings WHERE key='webhook_url'`);
    expect(rows[0].value).toBe('https://new-url.com');
  });

  it('should regenerate API key', async () => {
    const res = await request(app).post('/settings/regenerate-key');
    expect(res.status).toBe(200);
    expect(res.body.apiKey).toContain('sk_live_');
    
    // Verify DB update
    const { rows } = await pg.query(`SELECT value FROM settings WHERE key='api_key'`);
    expect(rows[0].value).toBe(res.body.apiKey);
  });
});