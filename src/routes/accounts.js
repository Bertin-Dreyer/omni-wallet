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
      return error(res, 'No accounts found', 404);
    }
    return success(res, accounts.rows[0]);
  } catch (err) {
    console.error('GET /accounts/me error:', err);
    return error(res, 'Internal server error', 500);
  }
});

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

    // Check if already used
    const existingTx = await pool.query(
      'SELECT id FROM financial.transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existingTx.rows.length > 0) {
      return error(res, 'Duplicate request', 409);
    }

    const userId = req.user.id;
    const accountResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE user_id = $1',
      [userId]
    );
    if (accountResult.rows.length === 0) {
      return error(res, 'No account found', 404);
    }
    const userAccountId = accountResult.rows[0].id;

    const sysCashResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE account_number = $1',
      ['SYS-CASH']
    );
    if (sysCashResult.rows.length === 0) {
      return error(res, 'System cash account not found', 500);
    }
    const sysCashAccountId = sysCashResult.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const transactionRef = `OW-DEP-${Date.now()}`;
      const transactionResult = await client.query(
        `INSERT INTO financial.transactions
        (reference, type, status, amount_cents, from_account_id, to_account_id, description, idempotency_key)
        VALUES ($1, 'DEPOSIT', 'PENDING', $2, NULL, $3, $4, $5)
        RETURNING *`,
        [transactionRef, amount_cents, userAccountId, description, idempotencyKey]
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

      const sysCashBalance = sysCashBalanceResult.rows[0].balance_cents;

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
      const userBalance = userBalanceResult.rows[0].balance_cents;

      // Insert ledger entries
      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'DEBIT', $3, $4)`,
        [transaction.id, sysCashAccountId, amount_cents, sysCashBalance + amount_cents]
      );

      await client.query(
        `INSERT INTO financial.ledger_entries
         (transaction_id, account_id, entry_type, amount_cents, balance_cents)
         VALUES ($1, $2, 'CREDIT', $3, $4)`,
        [transaction.id, userAccountId, amount_cents, userBalance + amount_cents]
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
      return success(res, {
        transaction: transaction,
        balance: newBalance
      }, 201);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      return error(res, 'Transaction failed', 500);
    } finally {
      client.release();
    }
  } catch (error) {
      console.error('POST /accounts/deposit error:', error);
      return error(res, 'Internal server error', 500);
  }
});

export default router;
