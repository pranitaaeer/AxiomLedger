CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('user', 'merchant', 'platform', 'external')),
  currency     CHAR(3) NOT NULL DEFAULT 'INR',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   TEXT UNIQUE NOT NULL,
  from_account_id   UUID NOT NULL REFERENCES accounts(id),
  to_account_id     UUID NOT NULL REFERENCES accounts(id),
  amount_minor      BIGINT NOT NULL CHECK (amount_minor > 0),
  currency          CHAR(3) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROCESSING','SETTLED','FAILED','REVERSED')),
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id             BIGSERIAL PRIMARY KEY,
  transfer_id    UUID NOT NULL REFERENCES transfers(id),
  account_id     UUID NOT NULL REFERENCES accounts(id),
  direction      TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount_minor   BIGINT NOT NULL CHECK (amount_minor > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION block_entry_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'entries are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entries_no_update ON entries;
CREATE TRIGGER entries_no_update BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION block_entry_mutation();

DROP TRIGGER IF EXISTS entries_no_delete ON entries;
CREATE TRIGGER entries_no_delete BEFORE DELETE ON entries
  FOR EACH ROW EXECUTE FUNCTION block_entry_mutation();

CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_transfer ON entries(transfer_id);
-- refunds: ek transfer ke against multiple refunds ho sakte hain
CREATE TABLE IF NOT EXISTS refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_transfer_id UUID NOT NULL REFERENCES transfers(id),
  idempotency_key     TEXT UNIQUE NOT NULL,
  amount_minor        BIGINT NOT NULL CHECK (amount_minor > 0),
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'SETTLED'
                      CHECK (status IN ('PENDING','SETTLED','FAILED')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- webhook_events: provider events idempotently store
CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT UNIQUE NOT NULL,
  event_type        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- settlements: provider's view of money movement (for reconciliation)
CREATE TABLE IF NOT EXISTS settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_ref     TEXT UNIQUE NOT NULL,
  transfer_id      UUID REFERENCES transfers(id),
  amount_minor     BIGINT NOT NULL,
  currency         CHAR(3) NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('SETTLED','FAILED','REFUNDED')),
  settled_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reconciliation_runs: audit of every reconciliation run
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_matched   INT NOT NULL DEFAULT 0,
  total_mismatched INT NOT NULL DEFAULT 0,
  details         JSONB
);

-- settings: store global configuration like API keys and webhook URLs
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users: Authentication ke liye
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default values if they don't exist
INSERT INTO settings (key, value) 
VALUES 
  ('api_key', 'sk_live_' || encode(gen_random_bytes(16), 'hex')),
  ('webhook_url', 'https://api.axiomledger.internal/webhooks/bank')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_refunds_original ON refunds(original_transfer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_transfer ON settlements(transfer_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_run_at ON reconciliation_runs(run_at);

-- === PHASE 3: AI RISK ENGINE UPGRADES ===

-- 1. Naye columns add karo risk engine ke liye
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS risk_reasons JSONB DEFAULT '[]';

-- 2. Purana status check constraint hatao aur naya lagao (jisme REVIEW allow ho)
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_status_check;
ALTER TABLE transfers ADD CONSTRAINT transfers_status_check 
  CHECK (status IN ('PENDING','PROCESSING','SETTLED','FAILED','REVERSED','REVIEW'));