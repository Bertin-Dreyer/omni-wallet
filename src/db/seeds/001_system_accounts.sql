-- System Accounts Seed
-- These represent the "house" side of every transaction.
-- They must exist before any money can move through the ledger.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO financial.system_accounts (name, description)
VALUES 
  ('SYSTEM_CASH', 'Real cash flowing in/out of the business'),
  ('SYSTEM_FEE', 'Fees collected from transactions'),
  ('SYSTEM_SUSPENSE', 'Temporary holding for failed or pending transactions')
ON CONFLICT DO NOTHING;
