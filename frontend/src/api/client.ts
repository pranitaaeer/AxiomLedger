import axios from 'axios';

const baseURL = "https://axiomledger.onrender.com"; // in production

// const baseURL="/api" in local development
const api = axios.create({ baseURL });

export type Transfer = {
  id: string;
  idempotency_key: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
};

export type Entry = {
  id: number;
  transfer_id: string;
  account_id: string;
  direction: 'debit' | 'credit';
  amount_minor: number;
  created_at: string;
};

export type ReconciliationRun = {
  id: string;
  run_at: string;
  total_matched: number;
  total_mismatched: number;
  details: any;
};

export const apiClient = {
  listTransfers: () => api.get<Transfer[]>('/transfers').then((r) => r.data),

  createTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }) =>
    api
      .post<Transfer>('/transfers', data, {
        headers: { 'Idempotency-Key': data.idempotencyKey }
      })
      .then((r) => r.data),

  refund: (transferId: string, data: { amountMinor: number; reason?: string; idempotencyKey: string }) =>
    api
      .post(`/transfers/${transferId}/refund`, data, {
        headers: { 'Idempotency-Key': data.idempotencyKey }
      })
      .then((r) => r.data),

  entries: (transferId: string) =>
    api.get<Entry[]>(`/transfers/${transferId}/entries`).then((r) => r.data),

  balance: (accountId: string) =>
    api.get<{ balanceMinor: number }>(`/accounts/${accountId}/balance`).then((r) => r.data),

  runReconciliation: () => api.post<ReconciliationRun>('/reconciliation/run').then((r) => r.data),

  listReconciliations: () =>
    api.get<ReconciliationRun[]>('/reconciliation/runs').then((r) => r.data)
};