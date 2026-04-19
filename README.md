# Omni Wallet

South African digital wallet system built on the PERN stack.

## Tech Stack

- **Runtime:** Node.js v24
- **Framework:** Express 5
- **Database:** PostgreSQL 15
- **Modules:** ESM (`"type": "module"`)

## Project Structure

```
omni-wallet/
├── src/
│   ├── config/         # Centralised environment config
│   ├── db/             # Database pool & migrations
│   │   └── migrations/ # SQL migration files
│   ├── middleware/   # Auth, logging, error handling
│   ├── routes/        # API endpoints
│   │   ├── accounts.js      # Account management
│   │   ├── auth.js          # Authentication
│   │   └── transactions.js # Transaction handling
│   ├── utils/         # Response helpers, JWT utils
│   └── app.js         # Express app setup
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Database Schema

Three PostgreSQL schemas:
- **identity** — Users, authentication, FICA/POPIA compliance
- **financial** — Wallets, double-entry ledger, transactions
- **audit** — DB-level audit triggers

## Getting Started

1. Copy `.env.example` to `.env` and configure
2. Run migrations in `src/db/migrations/`
3. Start: `npm run dev`

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` — User registration with FICA compliance
- `POST /login` — JWT login with refresh token rotation
- `POST /refresh` — Refresh access token
- `POST /logout` — Logout and revoke refresh token

### Accounts (`/api/accounts`)
- `GET /` — List user accounts
- `POST /` — Create new account
- `GET /:id` — Get account details
- `DELETE /:id` — Close account

### Transactions (`/api/transactions`)
- `POST /deposit` — Deposit funds to wallet
- `POST /withdraw` — Withdraw funds from wallet
- `POST /transfer` — Transfer between accounts
- `GET /` — List transactions with filters

## Features

- JWT authentication with refresh token rotation
- Double-entry ledger system for financial integrity
- FICA/POPIA compliance for South African regulations
- DB-level audit triggers for transaction logging
- Rate limiting and security headers
- Input validation with Zod

## Security

- CORS protection
- Helmet.js security headers
- Rate limiting
- Bcrypt password hashing
- JWT with short-lived access tokens
- Refresh token rotation