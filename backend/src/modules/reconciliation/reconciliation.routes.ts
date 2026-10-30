import { Router } from 'express';
import { pg } from '../../config/db.js';
import { reconciliationQueue } from '../../config/queue.js';
import { runReconciliation } from './reconciliation.service.js';

export const reconciliationRouter = Router();

// trigger immediately
reconciliationRouter.post('/reconciliation/run', async (_req, res) => {
  const run = await runReconciliation();
  res.json(run);
});

// enqueue job (async)
reconciliationRouter.post('/reconciliation/enqueue', async (_req, res) => {
  const job = await reconciliationQueue.add('run', {});
  res.json({ jobId: job.id });
});

// list past runs
reconciliationRouter.get('/reconciliation/runs', async (_req, res) => {
  const { rows } = await pg.query(
    `SELECT * FROM reconciliation_runs ORDER BY run_at DESC LIMIT 20`
  );
  res.json(rows);
});

// Get latest reconciliation details
reconciliationRouter.get('/reconciliation/latest', async (_req, res) => {
  try {
    const { rows } = await pg.query(
      `SELECT * FROM reconciliation_runs ORDER BY run_at DESC LIMIT 1`
    );
    if (rows.length === 0) return res.json({ details: [] });
    
    // details column JSONB hai, usko parse karke bhej do
    res.json({ details: rows[0].details || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});