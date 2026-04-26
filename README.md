# Omni Wallet System Documentation

## Project Overview

This is a financial wallet system built with Node.js, Express, and PostgreSQL. It provides a complete backend for wallet operations including user authentication, account management, and transaction processing.

## System Architecture

### Core Components
1. **Authentication System** - JWT-based authentication with refresh tokens
2. **Account Management** - User account creation and management
3. **Transaction Processing** - Financial transaction handling with double-entry accounting
4. **Security Layer** - Rate limiting, input validation, and middleware protection
5. **Database Layer** - PostgreSQL with connection pooling

## Key Files and Modules

### Routes
- `src/routes/auth.js` - Authentication endpoints (register, login, refresh, logout)
- `src/routes/accounts.js` - Account management endpoints (get account info, balance, deposit, transfer)
- `src/routes/transactions.js` - Transaction history endpoints

### Middleware
- `src/middleware/authenticate.js` - JWT authentication middleware
- `src/middleware/rateLimiter.js` - Rate limiting for security
- `src/middleware/logger.js` - Request logging
- `src/middleware/errorHandler.js` - Centralized error handling

### Database
- `src/db/pool.js` - PostgreSQL connection pooling configuration
- `src/db/schema/` - Database schema files (not included in this view)

### Utilities
- `src/utils/tokens.js` - JWT token generation and validation
- `src/utils/response.js` - Standardized API response formatting
- `src/utils/validation.js` - Input validation utilities

## Database Structure (Overview)

### Identity Schema
- `users` - User accounts with email, password hash, and status
- `refresh_tokens` - Refresh token storage for session management
- `kyc_profiles` - User KYC (Know Your Customer) information
- `popia_consents` - Privacy consent records

### Financial Schema  
- `accounts` - User financial accounts with balance management
- `transactions` - Financial transactions between accounts
- `ledger_entries` - Individual ledger entries for double-entry accounting

## Authentication Flow

### 1. Registration
- User submits name, email, and password
- Password is hashed using bcrypt
- New user record is created in the database
- KYC profile and consent records are created
- A new account is generated with a random account number
- Access and refresh tokens are generated and returned

### 2. Login
- User provides email and password
- Password is verified against stored hash
- User status is checked (must be active)
- New access and refresh tokens are generated
- Refresh token is stored in database for future validation

### 3. Token Management
- Access tokens are short-lived (typically 15 minutes)
- Refresh tokens are long-lived (typically 7 days)
- Refresh tokens are stored hashed in database with expiration
- Token refresh mechanism allows for seamless session continuation

### 4. Rate Limiting
- Authentication endpoints: 3 requests per 15 minutes per IP
- Financial endpoints: 20 requests per 15 minutes per IP
- Prevents brute force attacks and abuse

## Account Management

### Account Endpoints

#### GET /accounts/me
- Returns the user's account information
- Includes account number, currency, status, and creation timestamp

#### GET /accounts/me/balance
- Returns the user's current account balance
- Calculates balance using ledger entries with proper double-entry accounting

#### POST /accounts/deposit
- Deposits funds into the user's account
- Requires amount_cents (positive integer) and description
- Uses idempotency key to prevent duplicate deposits
- Creates ledger entries for the deposit transaction
- Returns transaction details and new balance

#### POST /accounts/transfer
- Transfers funds from user's account to another user's account
- Requires to_account_number (10-digit account number), amount_cents (positive integer), and description
- Uses idempotency key to prevent duplicate transfers
- Validates sufficient funds in sender's account
- Creates ledger entries for both sender (DEBIT) and receiver (CREDIT)
- Returns transaction details and new balance

## Transaction Processing

### Double-Entry Accounting
- Each transaction affects two accounts (sender and receiver)
- Transactions are stored with proper reference numbers
- Date filtering and pagination support for transaction history

### API Endpoints
- `GET /transactions/me` - Get user transaction history with pagination
- Supports date filtering (from/to parameters)
- Returns transaction details including amount, currency, description

## Security Features

- JWT-based authentication with proper token rotation
- Password hashing using bcrypt
- Input validation with Zod schemas
- Rate limiting to prevent abuse
- CORS protection
- Helmet.js for HTTP header security
- Centralized error handling
- Secure database connection handling

## Configuration

Configuration is managed through `src/config/index.js` which handles environment variables and settings for:
- Database connection URLs
- JWT secrets and expiration times
- CORS settings
- Application port
- Environment-specific settings

## Deployment

The application uses environment variables for configuration:
- `DB_APP_URL` - Database connection string
- `JWT_ACCESS_SECRET` - Secret for access token signing
- `JWT_REFRESH_SECRET` - Secret for refresh token signing
- `NODE_ENV` - Environment setting (production, development)

## API Response Format

All API responses follow a consistent format:
- Success responses: `{ status: true, data: {...}, message: "..." }`
- Error responses: `{ status: false, error: "..." }`

## Code Quality and Standards

- ES6+ JavaScript with modern syntax
- TypeScript type definitions (when available)
- Modular architecture with clear separation of concerns
- Comprehensive input validation
- Proper error handling and logging
- Security best practices

## Key Technical Concepts

### Pagination
- Implemented with OFFSET/LIMIT pattern
- Supports page number and limit parameters
- Returns pagination metadata for client-side UI

### Date Filtering
- Uses PostgreSQL TIMESTAMPTZ for timezone-aware dates
- Supports inclusive date ranges with 'from' and 'to' parameters
- Proper handling of date comparisons in SQL queries

### Transaction Processing
- Atomic database operations with BEGIN/COMMIT/ROLLBACK
- Double-entry accounting model
- Proper exception handling for database transactions

### Security
- Secure token management with database storage
- Session management with refresh tokens
- Rate limiting for both authentication and financial endpoints
- Input sanitization and validation

## Error Handling

- Centralized error handler middleware
- Proper HTTP status codes for different error types
- Consistent error response structure
- Detailed logging for debugging

## Performance Considerations

- Database connection pooling
- Indexing on frequently queried columns
- Efficient SQL queries with proper parameterization
- Rate limiting to prevent resource exhaustion