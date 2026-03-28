--  Tables in identities

--  Users
CREATE TABLE identity.users(
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL DEFAULT '',
  status       VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')) ,   -- active, suspended, closed
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- KYC Profiles
CREATE TABLE identity.kyc_profiles(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.users(id),
  status VARCHAR(10) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'UNDER_REVIEW', 'SUSPENDED')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- POPIA Consents
CREATE TABLE identity.popia_consents(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.users(id),
  consented_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET NOT NULL,
  policy_version VARCHAR(10) NOT NULL
);
