# Payment Backend — Auditable Ledger + AI Risk Engine

A production-grade payment backend built with **Node.js + Express + PostgreSQL + Redis** (Phase 1 of a larger system). It implements a **double-entry ledger**, **idempotent transfer APIs**, and **database-level immutability** for audit integrity.

> **Core principle:** Ledger correctness is deterministic. AI may flag fraud, but it never decides where money moves.

## 🎯 What This Solves

Payment systems break in subtle ways:
- Same request retried → money moves twice
- Partial failure mid-transfer → ledger unbalanced
- Provider webhook arrives twice → duplicate settlement
- Audit trail edited → compliance failure

This project enforces correctness at every layer:
- **Double-entry accounting** — every transfer creates two entries (debit + credit), always balanced
- **Idempotency keys** — same request returns the same result, money moves once
- **Immutable entries** — Postgres triggers block any UPDATE/DELETE on ledger entries
- **Serializable isolation** — transfers run in `SERIALIZABLE` transaction level

## 🏗 Architecture
┌─────────────┐ ┌──────────────┐ ┌─────────────┐
│ Client │─────▶│ Express │─────▶│ PostgreSQL │
│ (REST) │ │ + Redis │ │ (ledger) │
└─────────────┘ │ (idempotency)│ └─────────────┘
└──────────────┘
│
▼
┌──────────────┐
│ MongoDB │ (planned: audit logs, risk events)
└──────────────┘


**Why Postgres for the ledger?**
- Multi-row ACID transactions
- `SERIALIZABLE` isolation for correctness
- `BIGINT` for money (never floats)
- Triggers for immutable append-only entries

**Why Redis?**
- Idempotency key store (24h TTL)
- Request locking (concurrent same-key requests serialize)

## ✅ What Works Today (Phase 1)

- [x] Double-entry ledger schema
- [x] Idempotent `POST /transfers`
- [x] Immutable entries (trigger-enforced)
- [x] `SERIALIZABLE` transfer transactions
- [x] Balance derivation from entries
- [x] Invariant test suite (3/3 passing)

## 🧪 Test Evidence
✓ debits === credits after 50 transfers
✓ idempotency key prevents duplicate transfers
✓ entries cannot be updated


The invariant test runs 50 transfers and asserts `sum(debits) === sum(credits)`.

## 🚀 Quick Start

```bash
# 1. Start dependencies
docker run -d --name pg-ledger -p 5432:5432 \
  -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=ledger postgres:16
docker run -d --name redis-ledger -p 6379:6379 redis:7

# 2. Setup
cp .env.example .env
npm install
npm run migrate

# 3. Run
npm run dev          # http://localhost:4000
npm test             # runs invariant suite

```

# 📡 API
POST /transfers
Idempotency-Key: demo-001
Content-Type: application/json

{
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amountMinor": 5000,
  "currency": "INR"
}
Response: 201 Created with transfer object. Retry with the same key returns the original transfer (no duplicate).

GET /accounts/:id/balance
Returns derived balance (credits − debits) for an account.

GET /transfers
Lists recent transfers.

GET /transfers/:id/entries
Lists ledger entries for a transfer.

# Database Schema (key ideas)
accounts — identity + type, no balance column (balance is always derived)

transfers — state machine (PENDING → PROCESSING → SETTLED | FAILED | REVERSED)

entries — append-only double-entry rows, immutability enforced by trigger

# Roadmap
□ Refunds + reversals (Phase 2)
□ Provider webhook processing with idempotency (Phase 2)
□ BullMQ reconciliation workers (Phase 2)
□ Rule-based risk engine + human review queue (Phase 3)
□ React dashboard (Phase 4)

# 📝 License
MIT

text

---




