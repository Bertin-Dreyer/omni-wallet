--  System Accounts Table
CREATE TABLE financial.system_accounts(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(15)  NOT NULL CHECK (name IN ('SYSTEM_CASH', 'SYSTEM_FEE', 'SYSTEM_SUSPENSE')) ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

--  Accounts Table
CREATE TABLE financial.accounts(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.users(id),
  account_number VARCHAR(10) NOT NULL UNIQUE,
  currency CHAR(3) DEFAULT 'ZAR' NOT NULL CHECK (currency IN ('ZAR', 'USD', 'EUR')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('ACTIVE','PENDING','SUSPENDED', 'CLOSED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

--  Transactions Table
CREATE TABLE financial.transactions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(20) NOT NULL UNIQUE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'REFUND')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency CHAR(3) DEFAULT 'ZAR' NOT NULL CHECK (currency IN ('ZAR', 'USD', 'EUR')),
  from_account_id UUID REFERENCES financial.accounts(id),
  to_account_id UUID REFERENCES financial.accounts(id),
  description TEXT,
  processed_at TIMESTAMPTZ,
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

--  Ledger Entries Table
CREATE TABLE financial.ledger_entries(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES financial.transactions(id),
  account_id UUID NOT NULL REFERENCES financial.accounts(id),
  amount_cents BIGINT NOT NULL,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
  balance_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
