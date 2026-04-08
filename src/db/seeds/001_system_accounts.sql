-- System Accounts Seed
-- These represent the "house" side of every transaction.
-- They must exist before any money can move through the ledger.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO financial.accounts (account_number, currency, status, is_system)
VALUES
  ('SYS-CASH', 'ZAR', 'ACTIVE', TRUE),
  ('SYS-FEE', 'ZAR', 'ACTIVE', TRUE),
  ('SYS-SUSP', 'ZAR', 'ACTIVE', TRUE)
ON CONFLICT (account_number) DO NOTHING;
