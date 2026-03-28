-- Audit Log Table
CREATE TABLE audit.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);


-- GIN Indexing
CREATE INDEX idx_audit_log_new_data ON audit.audit_log USING GIN (new_data);
CREATE INDEX idx_audit_log_old_data ON audit.audit_log USING GIN (old_data);
CREATE INDEX idx_audit_log_table_name ON audit.audit_log (table_name);
CREATE INDEX idx_audit_log_changed_at ON audit.audit_log (changed_at);
