import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { transferRouter } from './modules/transfers/transfer.routes.js';
import { ledgerRouter } from './modules/ledger/ledger.routes.js';
import { reconciliationRouter } from './modules/reconciliation/reconciliation.routes.js';
import { webhookRouter } from './modules/webhooks/webhook.routes.js';

dotenv.config();

export const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://frontend-5mly-ev70ioo3e-pranitaaeers-projects.vercel.app' 
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(transferRouter);
app.use(ledgerRouter);
app.use(webhookRouter);
app.use(reconciliationRouter);