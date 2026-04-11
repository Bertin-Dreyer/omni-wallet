// NOTE: COME BACK AND RELEARN HOW TO DO THIS
// This file handles transaction operations for Omni-Wallet

import express from 'express';
import pool from '../db/pool.js';
import { z } from 'zod';
import { success, error } from '../utils/response.js';
import { authenticateJWT } from '../middleware/authenticate.js';

const router = express.Router();

// All routes need authentication
// This ensures req.user.id is available for BOLA protection
router.use(authenticateJWT);

// POST /transactions/transfer
// Sends money from one user to another
// Creates two ledger entries: DEBIT sender, CREDIT receiver
router.post('/transfer', async (req, res) => {
  try {
    // ============================================================
    // STEP 1: Input Validation with Zod
    // ============================================================
    // Zod validates the request body against our schema
    // to_account_number: 10-digit South African account number
    // amount_cents: positive integer (cents, not rand)
    // description: optional note for the transaction

    const transferSchema = z.object({
      to_account_number: z.string().min(10).max(10), // South African account numbers are 10 digits
      amount_cents: z.number().int().positive(), // Must be positive (no negative transfers!)
      description: z.string().min(1).max(255), // Description between 1-255 characters
    });

    const parseResult = transferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }

    // Extract validated data from the parsed result
    // This is safe to use because Zod has validated it
    const { to_account_number, amount_cents, description } = parseResult.data;

    // ============================================================
    // STEP 2: Idempotency Key Check
    // ============================================================
    // Idempotency keys prevent duplicate transfers if a request is retried
    // Header can be "Idempotency-Key" or "x-idempotency-key"
    // If a key has been used before, reject the request (409 Conflict)

    const idempotencyKey =
      req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return error(res, 'Idempotency key required', 400);
    }

    // Check if this idempotency key has been used before
    const existingTx = await pool.query(
      'SELECT id FROM financial.transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existingTx.rows.length > 0) {
      return error(res, 'Duplicate request', 409);
    }

    // ============================================================
    // STEP 3: Get Sender and Receiver Account IDs
    // ============================================================
    // req.user.id comes from the JWT token (set by authenticateJWT middleware)
    // We NEVER trust account IDs from request body - that's a security vulnerability!
    // to_account_number is fine to use from body - we validate it exists

    const userId = req.user.id;

    // ... STEP 3 CONTINUES HERE ...
    // - Get sender's account ID from their user_id
    const senderResult = await pool.query(
      `SELECT id FROM financial.accounts WHERE user_id = $1`,
      [userId]
    );

    if (senderResult.rows.length === 0) {
      return error(res, 'Sender account not found', 404);
    }

    const senderAccountId = senderResult.rows[0].id;

    // TODO: (STEP 3)
    // - Get receiver's account ID from to_account_number
    const receiverResult = await pool.query(
      `SELECT id FROM financial.accounts WHERE account_number = $1`,
      [to_account_number]
    );

    // TODO: (STEP 3)
    // - Verify receiver exists

    if (receiverResult.rows.length === 0) {
      return error(res, 'Receiver account not found', 404);
    }

    const receiverAccountId = receiverResult.rows[0].id;

    if (senderAccountId === receiverAccountId) {
      return error(res, 'Cannot transfer to your own account', 400);
    }

    const balanceResult = await pool.query(
      `SELECT COALESCE (
      SUM(CASE
      WHEN entry_type = 'CREDIT' THEN amount_cents
      WHEN entry_type = 'DEBIT' THEN -amount_cents
      ELSE 0 END), 0)
      AS balance_cents
      FROM financial.ledger_entries
      WHERE account_id = $1` ,
      [senderAccountId]
    );

    const senderBalance = balanceResult.rows[0].balance_cents;

    // Check if sender has enough money
    if (senderBalance < amount_cents) {
      return error(res, 'Insufficient funds', 400);
    }

  } catch (err) {
    console.error('POST /transactions/transfer error:', err);
    return error(res, 'Internal server error', 500);
  }
});

export default router;
