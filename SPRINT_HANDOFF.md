# OMNIPAY-Legacy Sprint Handoff

**Project:** OMNIPAY-Legacy — South African Digital Wallet System  
**Mentor:** Bertin's fintech fullstack guide  
**Date:** 2026-03-29  
**Continue From:** Sprint 1, Task 3 (auth routes partially built)

---

## User Instructions & Requirements

### Core Principles

1. **Explain first, then build.** Do not dump code without concept explanation.
2. **ADHD-Friendly Tutorials:** Short paragraphs, clear bullet points, visual diagrams, no walls of text.
3. **Production Standards:** Hold to fintech-grade code quality. No shortcuts.
4. **Push Back:** Challenge shortcuts and suggest better approaches.

### PDF Generation (Per Sprint)

At the end of each sprint, generate a PDF summary with:
- Sprint overview and goals
- Architecture diagrams (Mermaid format)
- Key code sections with explanations
- Database schema visualization
- Security features implemented
- Learning points and best practices
- Common pitfalls to avoid

Format: Clean, professional design suitable for portfolio or reference.

---

## Project Overview

**OMNIPAY-Legacy** is a South African digital wallet inspired by the late father's work at OmniPay division of Old Mutual, which processed government pension distributions.

**Tech Stack:**
- Node.js v24
- Express 5
- PostgreSQL 15
- ESM modules
- bcrypt, jsonwebtoken, zod, helmet, cors
- No TypeScript yet

---

## Design Decisions (Non-Negotiable)

- **Three PostgreSQL schemas:** identity, financial, audit
- **Double-entry ledger:** No balance column — balance calculated from ledger_entries
- **UUID primary keys:** gen_random_uuid()
- **TIMESTAMPTZ:** All timestamps
- **Soft deletes only:** DELETE revoked from omni_app user
- **Audit triggers:** On all critical tables
- **BIGINT cents:** All money values
- **Idempotency keys:** On all mutations

---

## Sprint 0: Complete ✅

### Database Migrations (Created & Executed)

1. `001_create_schemas.sql` — identity, financial, audit
2. `002_identity_tables.sql` — users, kyc_profiles, popia_consents
3. `003_financial_tables.sql` — system_accounts, accounts, transactions, ledger_entries
4. `004_audit_tables.sql` — audit_log with GIN indexes
5. `005_create_triggers.sql` — audit.log_changes() + 18 triggers
6. `006_permissions.sql` — omni_app restricted user

**Status:** All 6 migrations executed successfully ✅

---

## Sprint 1: In Progress

### Task 1: Database Migrations ✅

- [x] Run all 6 migrations against local PostgreSQL

### Task 2: Project Structure ✅ (COMPLETE)

Files built in `src/`:

| File | Status | Description |
|------|--------|-------------|
| `config/index.js` | ✅ | Environment loading, validation |
| `db/pool.js` | ✅ | PostgreSQL connection pool |
| `app.js` | ✅ | Express entry point |
| `middleware/errorHandler.js` | ✅ | Centralized error handling |
| `middleware/logger.js` | ✅ | Request logging |
| `middleware/authenticate.js` | ✅ | JWT verification |
| `utils/response.js` | ✅ | API response helpers |
| `utils/tokens.js` | ✅ | JWT generation/verification |

### Task 3: Auth Routes ⏳ (IN PROGRESS)

To build: `src/routes/auth.js` with:

1. **POST /register** — Create user + auto-create wallet/KYC/POPIA
2. **POST /login** — Verify credentials, return tokens
3. **POST /refresh** — Refresh access token
4. **POST /logout** — Logout

### Task 4:Auto-Create Wallet (PENDING)

On user registration, automatically create:
- `financial.accounts` (wallet account with initial balance 0)
- `identity.kyc_profiles` (KYC profile, status: pending_verification)
- `identity.popia_consents` (POPIA consent, granted: true)

All in a single database transaction for atomicity.

---

## Current Todo List

```
[x] Sprint 0: Migration files written
[x] Sprint 1, Task 1: Run all 6 migrations against local PostgreSQL
[x] Sprint 1, Task 2: Set up Node.js project structure (app.js, pool.js, config)
[-] Sprint 1, Task 3: Build authentication routes (register, login, refresh, logout)
[ ] Sprint 1, Task 4: Auto-create wallet account, KYC profile, POPIA consent on registration
[ ] Sprint 1, Task 5: Review and validate Sprint 1 deliverables
```

---

## Database Schema Reference

### identity Schema Tables

- `users`: id (UUID), email, password_hash, first_name, last_name, phone_number, status, idempotency_key, created_at, updated_at
- `kyc_profiles`: id (UUID), user_id (FK), status, document_type, document_number, address, verification_level, created_at, updated_at
- `popia_consents`: id (UUID), user_id (FK), consent_type, granted, consent_date, expiry_date, created_at

### financial Schema Tables

- `accounts`: id (UUID), user_id (FK), account_type, status, idempotency_key, created_at, updated_at
- `transactions`: id (UUID), account_id (FK), transaction_type, amount_cents, reference, status, idempotency_key, created_at, updated_at
- `ledger_entries`: id (UUID), transaction_id (FK), account_id (FK), entry_type, amount_cents, created_at

### audit Schema Table

- `audit_log`: id (UUID), schema_name, table_name, operation, old_values (JSONB), new_values (JSONB), changed_by, changed_at

---

## Key Files to Build Next

### src/routes/auth.js

Should include:

```javascript
// Imports
import express from 'express';
import bcrypt from 'bcrypt';
import { generateTokens, verifyToken } from '../utils/tokens.js';
import pool from '../db/pool.js';
import { success, created, error, unauthorized } from '../utils/response.js';

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  // 1. Validate request body (email, password, name, phone)
  // 2. Hash password with bcrypt
  // 3. Insert into identity.users
  // 4. Transaction: create wallet + KYC + POPIA
  // 5. Generate tokens
  // 6. Return tokens + user ID
});

// POST /login
router.post('/login', async (req, res) => {
  // 1. Validate credentials
  // 2. Find user by email
  // 3. Verify password with bcrypt.compare()
  // 4. Generate tokens
  // 5. Return tokens
});

// POST /refresh
router.post('/refresh', async (req, res) => {
  // 1. Verify refresh token
  // 2. Generate new access token
  // 3. Return new access token
});

// POST /logout
router.post('/logout', (req, res) => {
  // Client-side token removal is standard
  // Optionally track token invalidation
  // Return success
});

export default router;
```

---

## Authentication Flow

```
Registration:
1. User submits: email, password, firstName, lastName, phone
2. Server validates with Zod
3. Hash password: bcrypt.hash(password, 10)
4. INSERT identity.users (idempotency_key prevents duplicates)
5. Transaction:
   - INSERT financial.accounts (wallet, balance: 0)
   - INSERT identity.kyc_profiles (status: pending_verification)
   - INSERT identity.popia_consents (granted: true)
6. Generate JWT tokens
7. Return: { accessToken, refreshToken, userId }

Login:
1. User submits: email, password
2. Find identity.users by email
3. bcrypt.compare(password, user.password_hash)
4. Generate JWT tokens
5. Return: { accessToken, refreshToken }
```

---

## Important Implementation Notes

1. **Use database transactions** for register (wallet + KYC + POPIA must all succeed or all fail)
2. **bcrypt** for password hashing (cost factor 10)
3. **Zod** for input validation (see if time permits but it's in package.json)
4. **Idempotency key** on registration (prevent duplicate accounts)
5. **Access token:** 15 minutes expiry
6. **Refresh token:** 7 days expiry

---

## GitHub Repository

**URL:** https://github.com/Bertin-Dreyer/omni-wallet.git

---

## End of Sprint PDF Generation

When Sprint 1 is complete, the mentor (next agent) should generate a PDF using the frontend-design skill with:
- Project overview
- Database schema diagrams (3-schema structure)
- Authentication flow diagram
- Key code sections explained
- Security features
- Learning points

The PDF should be ADHD-friendly: short sections, bullet points, visual examples.
**Project:** OMNIPAY-Legacy — South African Digital Wallet System  
**Mentor:** Bertin's fintech fullstack guide  
**Date:** 2026-03-29  
**Continue From:** Sprint 1, Task 3 (auth routes partially built)

---

## User Instructions & Requirements

### Core Principles

1. **Explain first, then build.** Do not dump code without concept explanation.
2. **ADHD-Friendly Tutorials:** Short paragraphs, clear bullet points, visual diagrams, no walls of text.
3. **Production Standards:** Hold to fintech-grade code quality. No shortcuts.
4. **Push Back:** Challenge shortcuts and suggest better approaches.

### PDF Generation (Per Sprint)

At the end of each sprint, generate a PDF summary with:
- Sprint overview and goals
- Architecture diagrams (Mermaid format)
- Key code sections with explanations
- Database schema visualization
- Security features implemented
- Learning points and best practices
- Common pitfalls to avoid

Format: Clean, professional design suitable for portfolio or reference.

---

## Project Overview

**OMNIPAY-Legacy** is a South African digital wallet inspired by the late father's work at OmniPay division of Old Mutual, which processed government pension distributions.

**Tech Stack:**
- Node.js v24
- Express 5
- PostgreSQL 15
- ESM modules
- bcrypt, jsonwebtoken, zod, helmet, cors
- No TypeScript yet

---

## Design Decisions (Non-Negotiable)

- **Three PostgreSQL schemas:** identity, financial, audit
- **Double-entry ledger:** No balance column — balance calculated from ledger_entries
- **UUID primary keys:** gen_random_uuid()
- **TIMESTAMPTZ:** All timestamps
- **Soft deletes only:** DELETE revoked from omni_app user
- **Audit triggers:** On all critical tables
- **BIGINT cents:** All money values
- **Idempotency keys:** On all mutations

---

## Sprint 0: Complete ✅

### Database Migrations (Created & Executed)

1. `001_create_schemas.sql` — identity, financial, audit
2. `002_identity_tables.sql` — users, kyc_profiles, popia_consents
3. `003_financial_tables.sql` — system_accounts, accounts, transactions, ledger_entries
4. `004_audit_tables.sql` — audit_log with GIN indexes
5. `005_create_triggers.sql` — audit.log_changes() + 18 triggers
6. `006_permissions.sql` — omni_app restricted user

**Status:** All 6 migrations executed successfully ✅

---

## Sprint 1: In Progress

### Task 1: Database Migrations ✅

- [x] Run all 6 migrations against local PostgreSQL

### Task 2: Project Structure ✅ (COMPLETE)

Files built in `src/`:

| File | Status | Description |
|------|--------|-------------|
| `config/index.js` | ✅ | Environment loading, validation |
| `db/pool.js` | ✅ | PostgreSQL connection pool |
| `app.js` | ✅ | Express entry point |
| `middleware/errorHandler.js` | ✅ | Centralized error handling |
| `middleware/logger.js` | ✅ | Request logging |
| `middleware/authenticate.js` | ✅ | JWT verification |
| `utils/response.js` | ✅ | API response helpers |
| `utils/tokens.js` | ✅ | JWT generation/verification |

### Task 3: Auth Routes ⏳ (IN PROGRESS)

To build: `src/routes/auth.js` with:

1. **POST /register** — Create user + auto-create wallet/KYC/POPIA
2. **POST /login** — Verify credentials, return tokens
3. **POST /refresh** — Refresh access token
4. **POST /logout** — Logout

### Task 4:Auto-Create Wallet (PENDING)

On user registration, automatically create:
- `financial.accounts` (wallet account with initial balance 0)
- `identity.kyc_profiles` (KYC profile, status: pending_verification)
- `identity.popia_consents` (POPIA consent, granted: true)

All in a single database transaction for atomicity.

---

## Current Todo List

```
[x] Sprint 0: Migration files written
[x] Sprint 1, Task 1: Run all 6 migrations against local PostgreSQL
[x] Sprint 1, Task 2: Set up Node.js project structure (app.js, pool.js, config)
[-] Sprint 1, Task 3: Build authentication routes (register, login, refresh, logout)
[ ] Sprint 1, Task 4: Auto-create wallet account, KYC profile, POPIA consent on registration
[ ] Sprint 1, Task 5: Review and validate Sprint 1 deliverables
```

---

## Database Schema Reference

### identity Schema Tables

- `users`: id (UUID), email, password_hash, first_name, last_name, phone_number, status, idempotency_key, created_at, updated_at
- `kyc_profiles`: id (UUID), user_id (FK), status, document_type, document_number, address, verification_level, created_at, updated_at
- `popia_consents`: id (UUID), user_id (FK), consent_type, granted, consent_date, expiry_date, created_at

### financial Schema Tables

- `accounts`: id (UUID), user_id (FK), account_type, status, idempotency_key, created_at, updated_at
- `transactions`: id (UUID), account_id (FK), transaction_type, amount_cents, reference, status, idempotency_key, created_at, updated_at
- `ledger_entries`: id (UUID), transaction_id (FK), account_id (FK), entry_type, amount_cents, created_at

### audit Schema Table

- `audit_log`: id (UUID), schema_name, table_name, operation, old_values (JSONB), new_values (JSONB), changed_by, changed_at

---

## Key Files to Build Next

### src/routes/auth.js

Should include:

```javascript
// Imports
import express from 'express';
import bcrypt from 'bcrypt';
import { generateTokens, verifyToken } from '../utils/tokens.js';
import pool from '../db/pool.js';
import { success, created, error, unauthorized } from '../utils/response.js';

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  // 1. Validate request body (email, password, name, phone)
  // 2. Hash password with bcrypt
  // 3. Insert into identity.users
  // 4. Transaction: create wallet + KYC + POPIA
  // 5. Generate tokens
  // 6. Return tokens + user ID
});

// POST /login
router.post('/login', async (req, res) => {
  // 1. Validate credentials
  // 2. Find user by email
  // 3. Verify password with bcrypt.compare()
  // 4. Generate tokens
  // 5. Return tokens
});

// POST /refresh
router.post('/refresh', async (req, res) => {
  // 1. Verify refresh token
  // 2. Generate new access token
  // 3. Return new access token
});

// POST /logout
router.post('/logout', (req, res) => {
  // Client-side token removal is standard
  // Optionally track token invalidation
  // Return success
});

export default router;
```

---

## Authentication Flow

```
Registration:
1. User submits: email, password, firstName, lastName, phone
2. Server validates with Zod
3. Hash password: bcrypt.hash(password, 10)
4. INSERT identity.users (idempotency_key prevents duplicates)
5. Transaction:
   - INSERT financial.accounts (wallet, balance: 0)
   - INSERT identity.kyc_profiles (status: pending_verification)
   - INSERT identity.popia_consents (granted: true)
6. Generate JWT tokens
7. Return: { accessToken, refreshToken, userId }

Login:
1. User submits: email, password
2. Find identity.users by email
3. bcrypt.compare(password, user.password_hash)
4. Generate JWT tokens
5. Return: { accessToken, refreshToken }
```

---

## Important Implementation Notes

1. **Use database transactions** for register (wallet + KYC + POPIA must all succeed or all fail)
2. **bcrypt** for password hashing (cost factor 10)
3. **Zod** for input validation (see if time permits but it's in package.json)
4. **Idempotency key** on registration (prevent duplicate accounts)
5. **Access token:** 15 minutes expiry
6. **Refresh token:** 7 days expiry

---

## GitHub Repository

**URL:** https://github.com/Bertin-Dreyer/omni-wallet.git

---

## End of Sprint PDF Generation

When Sprint 1 is complete, the mentor (next agent) should generate a PDF using the frontend-design skill with:
- Project overview
- Database schema diagrams (3-schema structure)
- Authentication flow diagram
- Key code sections explained
- Security features
- Learning points

The PDF should be ADHD-friendly: short sections, bullet points, visual examples.
