// import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// import request from 'supertest';
// import { app } from '../src/app.js';
// import { pg } from '../src/config/db.js';
// import { redis } from '../src/config/redis.js';

// beforeAll(async () => {
//   await pg.query(`TRUNCATE webhook_events, settlements RESTART IDENTITY CASCADE`);
//   await redis.flushdb();
// });

// afterAll(async () => {
//   try { await pg.end(); } catch {}
//   try { await redis.quit(); } catch {}
// });

// describe('Webhooks', () => {
//   it('same event id processed only once', async () => {
//     const payload = { eventId: 'evt-1', eventType: 'payment.settled',
//       payload: { providerRef: 'prov-1', amountMinor: 500, currency: 'INR' } };

//     const r1 = await request(app).post('/webhooks/provider').send(payload);
//     const r2 = await request(app).post('/webhooks/provider').send(payload);

//     expect(r1.body.status).toBe('processed');
//     expect(r2.body.status).toBe('duplicate');

//     const { rows } = await pg.query(`SELECT COUNT(*) FROM webhook_events`);
//     expect(Number(rows[0].count)).toBe(1);
//   });
// });

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pg } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';

let transferId: string;

beforeAll(async () => {
  await pg.query(`TRUNCATE entries, refunds, transfers, accounts, webhook_events, settlements, reconciliation_runs RESTART IDENTITY CASCADE`);
  await redis.flushdb();
  const a = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'user') RETURNING id`);
  const b = await pg.query(`INSERT INTO accounts (owner_id,type) VALUES (gen_random_uuid(),'merchant') RETURNING id`);
  
  const t = await request(app).post('/transfers')
    .set('Idempotency-Key', 'webhook-orig')
    .send({ fromAccountId: a.rows[0].id, toAccountId: b.rows[0].id, amountMinor: 1000, currency: 'INR' });
  transferId = t.body.id;
});

afterAll(async () => { try { await pg.end(); } catch {} try { await redis.quit(); } catch {} });

describe('Webhooks & Reconciliation', () => {
  it('simulates bank webhook and creates settlement', async () => {
    const res = await request(app).post('/webhooks/simulate')
      .send({ transferId, amountMinor: 1000, currency: 'INR' });

    expect(res.status).toBe(200);
    const { rows } = await pg.query(`SELECT * FROM settlements WHERE transfer_id=$1`, [transferId]);
    expect(rows.length).toBe(1);
  });

  it('reconciliation matches the settlement', async () => {
    const res = await request(app).post('/reconciliation/run');
    expect(res.status).toBe(200);
    expect(res.body.total_matched).toBeGreaterThanOrEqual(1);
  });
});