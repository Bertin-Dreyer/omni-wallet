import express from 'express';
import pool from '../db/pool.js';
import { success, error } from '../utils/response.js';
import { authenticateJWT } from '../middleware/authenticate.js';

const router = express.Router();

// All routes need auth
router.use(authenticateJWT);

// GET /accounts/me
router.get('/me', async (req, res) => {
  // 1. Get user ID from req.user (set by authenticateJWT)
  const userId = req.user.id;
  // 2. Query financial.accounts WHERE user_id = req.user.id
  const accounts = await pool.query(
    'SELECT id, account_number, currency, status, created_at FROM financial.accounts WHERE user_id = $1',
    [userId]
  );
  // 3. If no account → 404
  if (accounts.rows.length === 0) {
    return error(res, 'No accounts found', 404);
  }
  // 4. If found → return account details
  return success(res, accounts.rows[0]);
});

router.get('/me/balance', async (req, res) => {
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
    'SELECT COALESCE(SUM(amount_cents), 0) AS balance_cents FROM financial.ledger_entries WHERE account_id = $1',
    [accountId]
  );

  return success(res, {
    balance_cents: parseInt(balanceResult.rows[0].balance_cents, 10),
  });
});

export default router;
