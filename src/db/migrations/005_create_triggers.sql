-- ============================================================================
-- AUDIT TRIGGERS
-- Automatically logs all changes to critical tables into audit.audit_log
-- Fires AFTER INSERT, UPDATE, or DELETE on each monitored table
-- ============================================================================

-- Trigger Function
-- Single function used by all triggers
-- TG_TABLE_NAME and TG_OP are PostgreSQL built-ins
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit.audit_log (
    table_name,
    operation,
    old_data,
    new_data
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END
  );

  -- Return OLD on DELETE, NEW on INSERT/UPDATE
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- IDENTITY SCHEMA TRIGGERS
-- ============================================================================

CREATE TRIGGER users_audit
AFTER INSERT OR UPDATE OR DELETE ON identity.users
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER kyc_profiles_audit
AFTER INSERT OR UPDATE OR DELETE ON identity.kyc_profiles
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER popia_consents_audit
AFTER INSERT OR UPDATE OR DELETE ON identity.popia_consents
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

-- ============================================================================
-- FINANCIAL SCHEMA TRIGGERS
-- ============================================================================

CREATE TRIGGER accounts_audit
AFTER INSERT OR UPDATE OR DELETE ON financial.accounts
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER transactions_audit
AFTER INSERT OR UPDATE OR DELETE ON financial.transactions
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER ledger_entries_audit
AFTER INSERT OR UPDATE OR DELETE ON financial.ledger_entries
FOR EACH ROW EXECUTE FUNCTION audit.log_changes();
