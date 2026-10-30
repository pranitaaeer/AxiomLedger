import { Router } from 'express';
import { z } from 'zod';
import { handleWebhook } from './webhook.service.js';
import { pg } from '../../config/db.js';

export const webhookRouter = Router();

const schema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  payload: z.record(z.any())
});

webhookRouter.post('/webhooks/provider', async (req, res) => {
  try {
    const { eventId, eventType, payload } = schema.parse(req.body);
    const result = await handleWebhook(eventId, eventType, payload);
    res.json(result);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// --- WEBHOOK SIMULATION ENDPOINT ---
webhookRouter.post('/webhooks/simulate', async (req, res) => {
  try {
    const { transferId, amountMinor, currency } = req.body;
    
    // Fake provider event ID
    const fakeEventId = `evt_sim_${Date.now()}`;
    const providerRef = `pay_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Insert Webhook Event (Idempotent)
    await pg.query(
      `INSERT INTO webhook_events (provider_event_id, event_type, payload, processed_at)
       VALUES ($1, 'payment.settled', $2, NOW())`,
      [fakeEventId, JSON.stringify({ transferId, amountMinor })]
    );

    // 2. Insert Settlement (Provider's view of money movement)
    await pg.query(
      `INSERT INTO settlements (provider_ref, transfer_id, amount_minor, currency, status)
       VALUES ($1, $2, $3, $4, 'SETTLED')`,
      [providerRef, transferId, amountMinor, currency || 'INR']
    );

    res.json({ 
      success: true, 
      message: 'Bank settlement simulated successfully',
      providerRef 
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get transfers that need settlement (No settlement exists yet)
webhookRouter.get('/webhooks/pending', async (_req, res) => {
  try {
    const { rows } = await pg.query(`
      SELECT t.* FROM transfers t
      LEFT JOIN settlements s ON t.id = s.transfer_id
      WHERE t.status = 'SETTLED' AND s.id IS NULL
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});