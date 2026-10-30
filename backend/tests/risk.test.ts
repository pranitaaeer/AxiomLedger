import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pg } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';

let accA: string, accB: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts RESTART IDENTITY CASCADE`);
  await redis.flushdb();
  const a = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'user') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'merchant') RETURNING id`);
  accA = a.rows[0].id; accB = b.rows[0].id;
});

afterAll(async () => { try { await pg.end(); } catch {} try { await redis.quit(); } catch {} });

describe('AI Risk Engine', () => {
  it('flags high-value transfers for REVIEW', async () => {
    const res = await request(app).post('/transfers')
      .set('Idempotency-Key', 'risk-001')
      .send({ fromAccountId: accA, toAccountId: accB, amountMinor: 6000000, currency: 'INR' }); // ₹60,000

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REVIEW');
    expect(res.body.risk_score).toBeGreaterThanOrEqual(40);
    expect(res.body.risk_reasons).toContain('🤖 AI analysis mocked for testing.');
  });

  it('allows admin to approve a REVIEW transfer', async () => {
    const { rows } = await pg.query(`SELECT id FROM transfers WHERE status='REVIEW' LIMIT 1`);
    const reviewId = rows[0].id;

    const res = await request(app).post(`/transfers/${reviewId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SETTLED');

    const { rows: entries } = await pg.query(`SELECT * FROM entries WHERE transfer_id=$1`, [reviewId]);
    expect(entries.length).toBe(2); // 1 debit, 1 credit created upon approval
  });
});