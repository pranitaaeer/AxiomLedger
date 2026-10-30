import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { runReconciliation } from './reconciliation.service.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

connection.on('error', (err) => {
  console.error('Worker Redis Error:', err.message);
});

export const reconciliationWorker = new Worker(
  'reconciliation',
  async () => {
    const run = await runReconciliation();
    console.log(`✅ Reconciliation: ${run.total_matched} matched, ${run.total_mismatched} mismatched`);
    return run;
  },
  { connection }
);

reconciliationWorker.on('failed', (job, err) => {
  console.error(`Reconciliation job ${job?.id} failed:`, err);
});