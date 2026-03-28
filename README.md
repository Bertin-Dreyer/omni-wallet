# OMNIPAY-Legacy: Omni Wallet

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
│   ├── middleware/    # Auth, logging, error handling
│   ├── routes/        # API endpoints
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

## Features

- JWT authentication with refresh token rotation
- Double-entry ledger system
- FICA/POPIA compliance
- DB-level audit triggers
