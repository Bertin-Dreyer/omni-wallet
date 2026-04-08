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
  } catch (error) {}
});

export default router;
