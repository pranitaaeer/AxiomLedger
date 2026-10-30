import { pg } from '../../config/db.js';

export async function handleWebhook(eventId: string, eventType: string, payload: any) {
  // 1) idempotent insert (same event id -> skip)
  const { rows } = await pg.query(
    `INSERT INTO webhook_events (provider_event_id, event_type, payload)
     VALUES ($1,$2,$3)
     ON CONFLICT (provider_event_id) DO NOTHING
     RETURNING id`,
    [eventId, eventType, payload]
  );

  if (rows.length === 0) {
    // already processed
    return { status: 'duplicate', eventId };
  }

  // 2) business logic based on event_type
  if (eventType === 'payment.settled') {
    await pg.query(
      `INSERT INTO settlements (provider_ref, transfer_id, amount_minor, currency, status)
       VALUES ($1,$2,$3,$4,'SETTLED')
       ON CONFLICT (provider_ref) DO NOTHING`,
      [payload.providerRef, payload.transferId, payload.amountMinor, payload.currency]
    );
  }

  // 3) mark processed
  await pg.query(
    `UPDATE webhook_events SET processed_at=now() WHERE provider_event_id=$1`,
    [eventId]
  );

  return { status: 'processed', eventId };
}