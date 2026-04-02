-- Refresh Tokens Table
-- Stores hashed refresh tokens for revocation support.
-- Without this, JWT refresh tokens cannot be invalidated before expiry.

CREATE TABLE identity.refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);

-- Index for fast token lookup during refresh
CREATE INDEX idx_refresh_tokens_token_hash ON identity.refresh_tokens(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX idx_refresh_tokens_expires_at ON identity.refresh_tokens(expires_at);

-- Index for user token lookup
CREATE INDEX idx_refresh_tokens_user_id ON identity.refresh_tokens(user_id);
