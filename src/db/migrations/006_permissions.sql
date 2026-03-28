-- ============================================================================
-- PERMISSIONS MIGRATION
-- ============================================================================
-- ⚠️  WARNING: Never run this file directly.
-- Create the omni_app user manually using the password from your .env file:
--   CREATE USER omni_app WITH PASSWORD 'your_password_from_env';
-- Then run this file to grant permissions.
-- ============================================================================

-- Create the restricted application database user
-- The password placeholder <DB_APP_PASSWORD> should be replaced with the actual
-- password from your .env file when creating this user manually
CREATE USER omni_app WITH PASSWORD '<DB_APP_PASSWORD>';

-- Grant USAGE on all schemas so the application can access objects within them
GRANT USAGE ON SCHEMA identity TO omni_app;
GRANT USAGE ON SCHEMA financial TO omni_app;
GRANT USAGE ON SCHEMA audit TO omni_app;

-- ============================================================================
-- IDENTITY SCHEMA PERMISSIONS
-- ============================================================================
-- The identity schema contains user data, KYC profiles, and POPIA consents.
-- The application needs full CRUD access to manage users and their compliance data.

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity TO omni_app;

-- Revoke DELETE to enforce soft-delete patterns — hard deletes are not allowed
-- in a compliant financial system. All deletions should set a status flag instead.
REVOKE DELETE ON ALL TABLES IN SCHEMA identity FROM omni_app;

-- Grant sequence access for UUID generation (gen_random_uuid() uses sequences)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO omni_app;

-- ============================================================================
-- FINANCIAL SCHEMA PERMISSIONS
-- ============================================================================
-- The financial schema contains wallet accounts and transactions.
-- The application needs to create and update financial records but should never
-- delete them — financial records must be retained for audit and compliance.

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA financial TO omni_app;

-- Revoke DELETE to prevent hard deletes of financial data.
-- All financial data must be retained for regulatory compliance and auditing.
REVOKE DELETE ON ALL TABLES IN SCHEMA financial FROM omni_app;

-- Grant sequence access for ID generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA financial TO omni_app;

-- ============================================================================
-- AUDIT SCHEMA PERMISSIONS
-- ============================================================================
-- The audit schema contains immutable audit logs.
-- The application should only be able to INSERT new audit entries — never modify
-- or delete existing audit records, as they form the authoritative audit trail.

GRANT INSERT ON audit.audit_log TO omni_app;

-- Ensure default permissions are set for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA identity
  GRANT SELECT, INSERT, UPDATE ON TABLES TO omni_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA identity
  GRANT USAGE, SELECT ON SEQUENCES TO omni_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA financial
  GRANT SELECT, INSERT, UPDATE ON TABLES TO omni_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA financial
  GRANT USAGE, SELECT ON SEQUENCES TO omni_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  GRANT INSERT ON TABLES TO omni_app;
