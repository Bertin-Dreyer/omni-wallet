// NOTE: COME BACK AND RELEARN HOW TO DO THIS

import express from 'express';
import pool from '../db/pool.js';
import { z } from 'zod';
import { success, error } from '../utils/response.js';
import { authenticateJWT } from '../middleware/authenticate.js';

const router = express.Router();

// All routes need auth
router.use(authenticateJWT);

// GET /accounts/me
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await pool.query(
      'SELECT id, account_number, currency, status, created_at FROM financial.accounts WHERE user_id = $1',
      [userId]
    );
    if (accounts.rows.length === 0) {
      return error(res, 'Account not found', 404);
    }
    return success(res, accounts.rows[0]);
  } catch (err) {
    console.error('GET /accounts/me error:', err);
    return error(res, 'Internal server error', 500);
  }
});

// GET /accounts/me/balance
router.get('/me/balance', async (req, res) => {
  try {
    const userId = req.user.id;

    const accountResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE user_id = $1',
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return error(res, 'No account found', 404);
    }

    const accountId = accountResult.rows[0].id;

    const balanceResult = await pool.query(
      `SELECT COALESCE(
        SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents
                 WHEN entry_type = 'DEBIT' THEN -amount_cents
                 ELSE 0 END), 0
      ) AS balance_cents
      FROM financial.ledger_entries
      WHERE account_id = $1`,
      [accountId]
    );

    return success(res, {
      balance_cents: parseInt(balanceResult.rows[0].balance_cents, 10),
    });
  } catch (err) {
    console.error('GET /accounts/me/balance error:', err);
    return error(res, 'Internal server error', 500);
  }
});

// POST /accounts/deposit
router.post('/deposit', async (req, res) => {
  try {
    const depositSchema = z.object({
      amount_cents: z.number().int().positive(),
      description: z.string().min(1).max(255),
    });

    const parseResult = depositSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }
    const { amount_cents, description } = parseResult.data;

    const idempotencyKey =
      req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return error(res, 'Idempotency key required', 400);
    }

    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if already used inside transaction
      const existingTx = await client.query(
        'SELECT id FROM financial.transactions WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existingTx.rows.length > 0) {
        await client.query('ROLLBACK');
        return error(res, 'Duplicate request', 409);
      }
    
      // Get user account with ownership check inside transaction
      const accountResult = await client.query(
        'SELECT id FROM financial.accounts WHERE user_id = $1 AND id = $2',
        [userId, userId] // This is wrong, need to get account id first then check ownership
      );
      
      // Actually, let me restructure this properly
      // First get the account ID for the user, then verify ownership in the same query
      const accountLookup = await client.query(
        'SELECT id FROM financial.accounts WHERE user_id = $1',
        [userId]
      );
      
      if (accountLookup.rows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'No account found', 404);
      }
      
      const userAccountId = accountLookup.rows[0].id;
      
      // Now verify ownership and lock the row
      const accountVerification = await client.query(
        'SELECT id FROM financial.accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [userAccountId, userId]
      );
      
      if (accountVerification.rows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Account not found or access denied', 404);
      }

      const sysCashResult = await pool.query(
        'SELECT id FROM financial.accounts WHERE account_number = $1',
        ['SYS-CASH']
      );
      if (sysCashResult.rows.length === 0) {
        return error(res, 'System cash account not found', 500);
      }
      const sysCashAccountId = sysCashResult.rows[0].id;

      const transactionRef = `OW-DEP-${Date.now()}`;
      const transactionResult = await client.query(
        `INSERT INTO financial.transactions
        (reference, type, status, amount_cents, from_account_id, to_account_id, description, idempotency_key)
        VALUES ($1, 'DEPOSIT', 'PENDING', $2, NULL, $3, $4, $5)
        RETURNING *`,
        [
          transactionRef,
          amount_cents,
          userAccountId,
          description,
          idempotencyKey,
        ]
      );
      const transaction = transactionResult.rows[0];

      // Get balance snapshot before the ledger entries

      const sysCashBalanceResult = await client.query(
        `SELECT COALESCE(
        SUM (CASE WHEN entry_type = 'CREDIT' THEN amount_cents WHEN entry_type = 'DEBIT' THEN -amount_cents ELSE 0 END), 0)
        AS balance_cents
        FROM financial.ledger_entries
        WHERE account_id = $1`,
        [sysCashAccountId]
      );

      const sysCashBalance = parseInt(sysCashBalanceResult.rows[0].balance_cents, 10);

      // Get user balance snapshot
      const userBalanceResult = await client.query(
        `SELECT COALESCE(
          SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents
                   WHEN entry_type = 'DEBIT' THEN -amount_cents
                   ELSE 0 END), 0
        ) AS balance_cents
        FROM financial.ledger_entries
        WHERE account_id = $1`,
        [userAccountId]
      );
      const userBalance = parseInt(userBalanceResult.rows[0].balance_cents, 10);

      // Insert ledger entries
      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'DEBIT', $3, $4)`,
        [
          transaction.id,
          sysCashAccountId,
          amount_cents,
          sysCashBalance + amount_cents,
        ]
      );

      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'CREDIT', $3, $4)`,
        [
          transaction.id,
          userAccountId,
          amount_cents,
          userBalance + amount_cents,
        ]
      );

      // Update transaction status to COMPLETED
      await client.query(
        `UPDATE financial.transactions
         SET status = 'COMPLETED', processed_at = NOW()
         WHERE id = $1`,
        [transaction.id]
      );

      // Calculate new balance for response
      const newBalance = userBalance + amount_cents;

      // Commit the transaction
      await client.query('COMMIT');

      // Return success response with transaction and new balance
      return success(
        res,
        {
          transaction: transaction,
          balance: newBalance,
        },
        'Deposit successful'
      );
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', err);
      return error(res, 'Transaction failed', 500);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /accounts/deposit error:', err);
    return error(res, 'Internal server error', 500);
  }
});

// ============================================================
// POST /accounts/transfer
// ============================================================
// NOTE: COME BACK AND RELEARN HOW TO DO THIS - STUDY THIS CAREFULLY
// Transfers money from one user to another
// Creates two ledger entries: DEBIT sender, CREDIT receiver

router.post('/transfer', async (req, res) => {
  try {
    // STEP 1: Input Validation with Zod
    // Validates: to_account_number (10 digits), amount_cents (positive), description
    const transferSchema = z.object({
      to_account_number: z.string().regex(/^\d{10}$/),
      amount_cents: z.number().int().positive(),
      description: z.string().min(1).max(255),
    });

    const parseResult = transferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }
    const { to_account_number, amount_cents, description } = parseResult.data;

    // STEP 2: Idempotency Key Check
    // Prevents duplicate transfers if request is retried
    const idempotencyKey =
      req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return error(res, 'Idempotency key required', 400);
    }

    // STEP 3: Get Sender Account ID
    const userId = req.user.id;

    const senderResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE user_id = $1',
      [userId]
    );
    if (senderResult.rows.length === 0) {
      return error(res, 'Sender account not found', 404);
    }
    const senderAccountId = senderResult.rows[0].id;

    // Get receiver's account by account_number
    const receiverResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE account_number = $1',
      [to_account_number]
    );
    if (receiverResult.rows.length === 0) {
      return error(res, 'Receiver account not found', 404);
    }
    const receiverAccountId = receiverResult.rows[0].id;

    // Prevent self-transfer
    if (senderAccountId === receiverAccountId) {
      return error(res, 'Cannot transfer to your own account', 400);
    }

    // STEP 4: Database Transaction with Idempotency Check Inside
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check idempotency inside transaction to prevent TOCTOU race condition
      const existingTx = await client.query(
        'SELECT id FROM financial.transactions WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existingTx.rows.length > 0) {
        await client.query('ROLLBACK');
        return error(res, 'Duplicate request', 409);
      }

      // Verify sender account ownership and lock row
      const senderVerification = await client.query(
        'SELECT id FROM financial.accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [senderAccountId, userId]
      );
      if (senderVerification.rows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Sender account not found or access denied', 404);
      }

      // Get sender balance for validation
      const balanceResult = await client.query(
        `SELECT COALESCE(
           SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents
                   WHEN entry_type = 'DEBIT' THEN -amount_cents
                   ELSE 0 END), 0
         ) AS balance_cents
         FROM financial.ledger_entries
         WHERE account_id = $1`,
        [senderAccountId]
      );
      const senderBalance = parseInt(balanceResult.rows[0].balance_cents, 10);

      if (senderBalance < amount_cents) {
        await client.query('ROLLBACK');
        return error(res, 'Insufficient funds', 400);
      }

      // STEP 5a: Create Transaction Record
      const transactionRef = `OW-XF-${Date.now()}`;
      const transactionResult = await client.query(
        `INSERT INTO financial.transactions
        (reference, type, status, amount_cents, from_account_id, to_account_id, description, idempotency_key)
        VALUES ($1, 'TRANSFER', 'PENDING', $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          transactionRef,
          amount_cents,
          senderAccountId,
          receiverAccountId,
          description,
          idempotencyKey,
        ]
      );
      const transaction = transactionResult.rows[0];

      // STEP 5b: Get Balance Snapshots Before Ledger Entries
      const senderBalanceResult = await client.query(
        `SELECT COALESCE(
           SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents
                   WHEN entry_type = 'DEBIT' THEN -amount_cents
                   ELSE 0 END), 0
         ) AS balance_cents
         FROM financial.ledger_entries
         WHERE account_id = $1`,
        [senderAccountId]
      );
      const senderBalanceBefore = parseInt(senderBalanceResult.rows[0].balance_cents, 10);

      const receiverBalanceResult = await client.query(
        `SELECT COALESCE(
           SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents
                   WHEN entry_type = 'DEBIT' THEN -amount_cents
                   ELSE 0 END), 0
         ) AS balance_cents
         FROM financial.ledger_entries
         WHERE account_id = $1`,
        [receiverAccountId]
      );
      const receiverBalanceBefore = parseInt(receiverBalanceResult.rows[0].balance_cents, 10);

      // STEP 5c: Insert Ledger Entries (Double-Entry)
      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'DEBIT', $3, $4)`,
        [
          transaction.id,
          senderAccountId,
          amount_cents,
          senderBalanceBefore - amount_cents,
        ]
      );

      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'CREDIT', $3, $4)`,
        [
          transaction.id,
          receiverAccountId,
          amount_cents,
          receiverBalanceBefore + amount_cents,
        ]
      );

      // STEP 5d: Update Transaction Status to COMPLETED
      await client.query(
        `UPDATE financial.transactions
         SET status = 'COMPLETED', processed_at = NOW()
         WHERE id = $1`,
        [transaction.id]
      );

      await client.query('COMMIT');

      const newBalance = senderBalanceBefore - amount_cents;
      return success(
        res,
        {
          transaction: transaction,
          balance: newBalance,
        },
        'Transfer successful'
      );
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return error(res, 'Duplicate request', 409);
      }
      console.error('Transfer transaction error:', err);
      return error(res, 'Transfer failed', 500);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /accounts/transfer error:', err);
    return error(res, 'Internal server error', 500);
  }
});

export default router;