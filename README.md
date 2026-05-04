# Omni Wallet

> **Omni Wallet** is the first module of **OMNIPAY-Legacy** — a personal tribute to your late father's work building the infrastructure that processed government pension distributions across South Africa for Old Mutual's OmniPay division.

A production-grade financial account system built on a double-entry ledger, where balances are **always calculated from ledger entries (never stored)**, all mutations are wrapped in explicit transaction blocks, and every financial operation includes idempotency keys with a full audit trail. Engineered to the exacting standards of real fintech infrastructure — not a tutorial project.

---

## Dependencies

### Production Dependencies
- **express** (^5.2.1): Fast, unopinionated, minimalist web framework for Node.js
- **pg** (^8.20.0): PostgreSQL client for Node.js
- **zod** (^4.3.6): TypeScript-first schema validation with static type inference
- **jsonwebtoken** (^9.0.3): JSON Web Token implementation (symmetric and asymmetric)
- **bcrypt** (^6.0.0): Password hashing library with salt rounds
- **express-rate-limit** (^8.3.1): Rate limiting middleware for Express applications
- **helmet** (^8.1.0): Security middleware that sets various HTTP headers
- **cors** (^2.8.6): Cross-origin resource sharing middleware
- **dotenv** (^17.3.1): Loads environment variables from .env file

### Development Dependencies
- **jest** (^30.3.0): JavaScript testing framework
- **supertest** (^7.2.2): HTTP assertions library for testing Express applications
- **@playwright/test** (^1.59.1): End-to-end testing framework
- **playwright** (^1.59.1): Browser automation framework
- **nodemon** (^3.1.14): Utility for automatically restarting Node.js applications

---

## Key Features

### Financial Integrity
- **True Double-Entry Ledger**: Every transaction creates two ledger entries (debit/credit); balances computed dynamically via `SUM(ledger_entries)` — no cached balances prone to drift
- **Idempotency Guarantees**: UUID-based idempotency keys on all financial endpoints prevent duplicate processing from retries
- **Explicit Transactions**: All mutations wrapped in `BEGIN; ... COMMIT;` blocks with proper isolation levels
- **Audit-First Design**: Database-level triggers capture every change to financial tables in immutable audit logs

### Enterprise Security
- **Defense-in-Depth**: Helmet.js, CORS, rate limiting, bcrypt password hashing
- **Authentication**: JWT with short-lived access tokens + HTTP-only refresh token rotation
- **Data Protection**: Generic error messages (no stack traces), parameterized queries (SQL injection prevention)
- **BOLA Prevention**: Ownership verified in every financial query (`WHERE user_id = $1`)
- **Regulatory Compliance**: FICA/POPIA-ready identity verification flows

### Technical Excellence
- **Node.js v24** + **Express 5** (ESM native) with async/await throughout
- **PostgreSQL 15** with UUID primary keys, CHECK constraints, and indexed foreign keys
- **Validation Layer**: Zod schemas for request/response validation
- **ORM-Less Approach**: Raw SQL with `$1, $2` parameterization for performance transparency and SQL visibility
- **Production Hardening**: Connection pooling, graceful shutdown, comprehensive logging

### Observability & Operability
- **Structured Logging**: Request-ID correlation, JSON-formatted logs for ELK ingestion
- **Health Checks**: Liveness/readiness endpoints
- **Database Migrations**: Version-controlled SQL with down migrations
- **Seed Data**: System accounts (SYSTEM_CASH, SYSTEM_FEE, SYSTEM_SUSPENSE) for proper double-entry balancing

---

## Technical Architecture

### Three-Schema Design
| Schema      | Purpose                                                                 |
|-------------|-------------------------------------------------------------------------|
| `identity`  | Users, authentication, FICA/POPIA compliance data (KYC/AML)             |
| `financial` | Core ledger: accounts, transactions, ledger entries, system accounts    |
| `audit`     | Immutable change logs via `pg_triggers` on all financial tables         |

### Core Financial Tables
```sql
-- Accounts belong to users, hold currency-specific balances (calculated)
CREATE TABLE financial.accounts(
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES identity.users(id),
  account_number VARCHAR(10) UNIQUE,
  currency CHAR(3) CHECK (currency IN ('ZAR','USD','EUR')),
  status VARCHAR(10) -- ACTIVE/PENDING/SUSPENDED/CLOSED
);

-- Financial movements with idempotency keys
CREATE TABLE financial.transactions(
  id UUID PRIMARY KEY,
  reference VARCHAR(20) UNIQUE,
  type VARCHAR(10) CHECK (type IN ('DEPOSIT','WITHDRAWAL','TRANSFER','REFUND')),
  status VARCHAR(10) CHECK (status IN ('PENDING','COMPLETED','FAILED')),
  amount_cents BIGINT CHECK (amount_cents > 0),
  idempotency_key UUID UNIQUE, -- Critical for retry safety
  from_account_id UUID REFERENCES financial.accounts(id),
  to_account_id UUID REFERENCES financial.accounts(id),
  processed_at TIMESTAMPTZ
);

-- The source of truth: never store balances, always calculate
CREATE TABLE financial.ledger_entries(
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES financial.transactions(id),
  account_id UUID REFERENCES financial.accounts(id),
  amount_cents BIGINT, -- Negative for credits, positive for debits (or vice versa per convention)
  entry_type VARCHAR(10) CHECK (entry_type IN ('DEBIT','CREDIT')),
  balance_cents BIGINT -- Running balance after this entry (for reporting efficiency)
);
```

### Transaction Flow Example
1. User initiates deposit: `POST /accounts/deposit` with idempotency key
2. Service validates, begins transaction:
   ```sql
   BEGIN;
   INSERT INTO financial.transactions (...) VALUES (...);
   INSERT INTO financial.ledger_entries (transaction_id, account_id, amount_cents, entry_type, balance_cents)
     VALUES (txn_id, user_account_id, +amount, 'CREDIT', new_balance);
   INSERT INTO financial.ledger_entries (transaction_id, account_id, amount_cents, entry_type, balance_cents)
     VALUES (txn_id, system_cash_account_id, -amount, 'DEBIT', system_new_balance);
   COMMIT;
   ```
3. Balance query: `SELECT SUM(amount_cents) FROM financial.ledger_entries WHERE account_id = $1`

---

## Security Deep Dive

### Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    User->>API: POST /auth/login {email, password}
    API->>DB: Verify credentials (bcrypt)
    DB-->>API: User record
    API->>API: Generate access token (15min) + refresh token (7d)
    API-->>User: {access_token, refresh_token}
    User->>API: POST /accounts/deposit {Bearer access_token}
    API->>API: Validate JWT signature & expiry
    API->>DB: Verify user_id owns target account
    API->>DB: Insert transaction with idempotency check
    API-->>User: 201 {transaction_id}
```

### Critical Protections
- **Rate Limiting**: Per-IP and per-user limits on financial endpoints (`financialLimiter` middleware)
- **Header Security**: Helmet with strict CSP, HSTS, XSS protection
- **Error Handling**: Centralized handler returns generic messages in production (`Internal server error`)
- **Data Minimization**: JWTs contain only user ID + roles; no PII in tokens
- **Timeouts**: Database statement timeouts, connection idle timeouts

---

## API Reference

### Base URL: `/api`
All endpoints require JWT Bearer token in `Authorization` header (except auth routes).

#### Authentication (`/api/auth`)
| Method | Endpoint    | Description                                  |
|--------|-------------|----------------------------------------------|
| `POST` | `/register` | User signup with FICA compliance check       |
| `POST` | `/login`    | Email/password login → access + refresh tokens |
| `POST` | `/refresh`  | Rotate refresh token for new access token    |
| `POST` | `/logout`   | Invalidate refresh token                     |

**POST /auth/register**
- **Schema**: `{ name: string, email: string, password: string }`
- **Response**: `{ status: true, message: "Registration successful", data: { user: {...}, accessToken: string, refreshToken: string } }`

**POST /auth/login**
- **Schema**: `{ email: string, password: string }`
- **Response**: `{ status: true, message: "Login successful", data: { user: {...}, accessToken: string, refreshToken: string } }`

**POST /auth/refresh**
- **Schema**: `{ refreshToken: string }`
- **Response**: `{ status: true, message: "Token refreshed", data: { accessToken: string, refreshToken: string } }`

#### Accounts (`/api/accounts`)
| Method | Endpoint    | Description                          |
|--------|-------------|--------------------------------------|
| `GET`  | `/me`       | Get user's account details           |
| `GET`  | `/me/balance`| Get calculated balance               |
| `POST` | `/deposit`  | Fund wallet (requires idempotency key)|
| `POST` | `/transfer` | Transfer between accounts            |

**GET /accounts/me**
- **Response**: `{ status: true, message: "OK", data: { id, account_number, currency, status, created_at } }`

**GET /accounts/me/balance**
- **Response**: `{ status: true, message: "OK", data: { balance_cents: number } }`

**POST /accounts/deposit**
- **Headers**: `Idempotency-Key: <uuid>`
- **Schema**: `{ amount_cents: number, description: string }`
- **Response**: `{ status: true, message: "Deposit successful", data: { transaction: {...}, balance: number } }`

**POST /accounts/transfer**
- **Headers**: `Idempotency-Key: <uuid>`
- **Schema**: `{ to_account_number: string, amount_cents: number, description: string }`
- **Response**: `{ status: true, message: "Transfer successful", data: { transaction: {...}, balance: number } }`

#### Transactions (`/api/transactions`)
| Method | Endpoint    | Description                          |
|--------|-------------|--------------------------------------|
| `GET`  | `/me`       | Transaction history with filters     |

**GET /transactions/me**
- **Query Params**: `page=1&limit=20&from=2026-01-01&to=2026-01-31`
- **Response**: `{ status: true, message: "OK", data: { transactions: [...], pagination: { page, limit, total, totalPages, hasNextPage, hasPrevPage } } }`

---

## Getting Started

### Prerequisites
- Node.js v24.x
- PostgreSQL 15.x
- Git

### Installation
```bash
# Clone repository
git clone https://github.com/your-org/omni-wallet.git
cd omni-wallet

# Install dependencies
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and JWT secrets

# Run migrations (creates schemas, tables, indexes, triggers)
npm run migrate

# Seed system accounts
npm run seed

# Start development server
npm run dev
```

### Environment Variables
| Variable          | Type | Required | Description                                  | Default/Example                     |
|-------------------|------|----------|----------------------------------------------|-------------------------------------|
| `PORT`            | int  | Yes      | Server port                                  | `3000`                              |
| `NODE_ENV`        | str  | Yes      | Environment mode                             | `development`                       |
| `DATABASE_URL`    | str  | Yes      | Superuser DB URL for migrations              | `postgresql://postgres:pass@localhost:5432/omnipay_legacy` |
| `DB_APP_USER`     | str  | Yes      | Restricted app user                          | `omni_app`                          |
| `DB_APP_PASSWORD` | str  | Yes      | App user password                            | `your_strong_password_here`         |
| `DB_APP_URL`      | str  | Yes      | App DB URL                                   | `postgresql://omni_app:pass@localhost:5432/omnipay_legacy` |
| `JWT_ACCESS_SECRET`| str | Yes      | Access token secret (64+ chars)             | `your_64_character_random_string_here` |
| `JWT_REFRESH_SECRET`| str| Yes     | Refresh token secret (64+ chars, different)| `different_64_character_random_string_here` |
| `JWT_ACCESS_EXPIRES_IN`| str| No   | Access token expiry                          | `15m`                               |
| `JWT_REFRESH_EXPIRES_IN`| str| No   | Refresh token expiry                         | `7d`                                |
| `CORS_ORIGIN`     | str  | Yes      | Allowed CORS origins                         | `http://localhost:5173`             |

### Database Setup
1. Create PostgreSQL database: `omnipay_legacy`
2. Create superuser: `postgres` with password
3. Create restricted user: `omni_app` with password
4. Grant permissions as per `006_permissions.sql`
5. Run migrations in order

---

## Usage Examples

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
# Returns { accessToken, refreshToken }
```

### Deposit Funds
```bash
curl -X POST http://localhost:3000/api/accounts/deposit \
  -H "Authorization: Bearer <accessToken>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_cents": 10000,
    "description": "Initial deposit"
  }'
```

### Check Balance
```bash
curl -X GET http://localhost:3000/api/accounts/me/balance \
  -H "Authorization: Bearer <accessToken>"
```

### Transfer Funds
```bash
curl -X POST http://localhost:3000/api/accounts/transfer \
  -H "Authorization: Bearer <accessToken>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "to_account_number": "1234567890",
    "amount_cents": 5000,
    "description": "Payment for services"
  }'
```

### Transaction History
```bash
curl -X GET "http://localhost:3000/api/transactions/me?page=1&limit=10&from=2026-01-01" \
  -H "Authorization: Bearer <accessToken>"
```

---

## Development Practices

### Code Quality
- **ESLint** + **Prettier** configured for consistent formatting
- **Type Safety**: JSDoc comments + implicit typing (consider migrating to TypeScript v5.x)
- **Testing Strategy**: Unit tests with Jest (WIP), integration tests with Supertest
- **Database Testing**: Transactions wrapped in test rollbacks

### Key Architectural Decisions
1. **Raw SQL over ORM**: 
   - Performance predictability for financial operations
   - Full visibility into executed queries for auditability
   - Avoids ORM leakage and unexpected query patterns
   
2. **Explicit Transaction Management**:
   - No automatic commits; every mutation controlled
   - Proper isolation levels (`READ COMMITTED`) to prevent anomalies
   - Savepoints for nested operations where needed

3. **Ledger-Centric Balance Calculation**:
   - Eliminates balance drift from application bugs
   - Enables point-in-time balance reconstruction
   - Supports complex financial reporting (FIFO/LIFO, etc.)

4. **Idempotency as First-Class Concern**:
   - UUID v4 keys generated client-side or server-side
   - Unique constraint on `transactions.idempotency_key`
   - Safe retries without financial risk

---

## Why This Matters for Technical Leads

### Beyond the Tutorial
Most fintech demos showcase surface-level features. Omni Wallet implements the **invisible infrastructure** that prevents financial loss:
- **Idempotency** solves the $1B+ problem of duplicate payments in distributed systems
- **Double-entry ledgering** provides mathematical proof of money conservation
- **Database-level auditing** satisfies regulators (SARB, PCI-DSS) without application logging gaps
- **Explicit transactions** prevent the lost-update anomaly that corrupted balances at scale

### Production-Ready Patterns
- **Defensive Financial Math**: All calculations in `BIGINT` cents to avoid floating-point errors
- **Fail-Fast Validation**: Zod schemas reject invalid requests before hitting the DB
- **Observable Transactions**: Every financial operation logs to audit table with user context
- **Operational Simplicity**: Single process, externalized config, no hidden state

### Team Onboarding Value
The codebase includes **teaching comments** in critical sections (see `src/routes/transactions.js`) explaining:
- Why pagination uses `OFFSET/LIMIT` with enforcement of max limits
- How `TIMESTAMPTZ` enables accurate cross-zone date filtering
- Query patterns for double-entry systems (sender OR receiver lookups)
- This accelerates ramp-up for engineers new to fintech principles

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

> **Omni Wallet** isn't just code — it's a ledger of integrity, built to honor a legacy of financial trust. Every line reflects the principle that in fintech, correctness isn't optional; it's the foundation.