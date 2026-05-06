-- ============================================================================
-- MISSING INDICES FOR PERFORMANCE
-- ============================================================================
-- These indices optimize frequent query patterns identified in the codebase:
-- - Balance calculations (ledger_entries.account_id)
-- - Transaction lookups by account (transactions.from/to_account_id)

-- Ledger entries: optimize balance calculations and transaction lookups
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id
ON financial.ledger_entries(account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id
ON financial.ledger_entries(transaction_id);

-- Transactions: optimize lookups by sender/receiver account
CREATE INDEX IF NOT EXISTS idx_transactions_from_account
ON financial.transactions(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_to_account
ON financial.transactions(to_account_id);

-- Note: 
-- - transactions.idempotency_key already has a UNIQUE index from migration 003_financial_tables.sql
-- - identity.refresh_tokens already has indices on token_hash, expires_at, and user_id from migration 007_refresh_tokens.sql