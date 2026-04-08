-- Add is_system flag to financial.accounts
-- System accounts (SYSTEM_CASH, SYSTEM_FEE, SYSTEM_SUSPENSE) use this flag
-- to distinguish them from user wallet accounts
ALTER TABLE financial.accounts
ADD COLUMN is_system BOOLEAN DEFAULT FALSE;

-- Make user_id nullable so system accounts don't need a user
ALTER TABLE financial.accounts
ALTER COLUMN user_id DROP NOT NULL;
