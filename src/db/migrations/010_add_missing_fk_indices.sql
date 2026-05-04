-- ============================================================================
-- MISSING FOREIGN KEY INDICES
-- ============================================================================
-- Indexes on foreign key columns for performance in JOINs and lookups.

-- Financial accounts: index on user_id (to quickly find accounts by user)
CREATE INDEX IF NOT EXISTS idx_accounts_user_id
ON financial.accounts(user_id);

-- Identity kyc_profiles: index on user_id
CREATE INDEX IF NOT EXISTS idx_kyc_profiles_user_id
ON identity.kyc_profiles(user_id);

-- Identity popia_consents: index on user_id
CREATE INDEX IF NOT EXISTS idx_popia_consents_user_id
ON identity.popia_consents(user_id);

-- Note: identity.refresh_tokens already has an index on user_id from migration 007_refresh_tokens.sql