// NOTE: COME BACK AND RELEARN HOW TO DO THIS
// Key concepts to master:
// 1. Double-entry accounting: Every transaction affects TWO accounts (from and to)
// 2. Pagination: Don't load all records at once - use OFFSET/LIMIT
// 3. Date filtering with TIMESTAMPTZ: PostgreSQL handles timezone-aware dates
// 4. Query with OR: Get transactions where user is sender OR receiver
// 5. ORM-less approach: Using raw SQL with parameterized queries (no ORM layer)

// ============================================================
// TEACHING: How Pagination Works
// ============================================================
// Page 1, Limit 20: OFFSET 0, LIMIT 20 (skip 0, take 20)
// Page 2, Limit 20: OFFSET 20, LIMIT 20 (skip 20, take 20)
// Page 3, Limit 20: OFFSET 40, LIMIT 20 (skip 40, take 20)
// Formula: OFFSET = (page - 1) * limit

// ============================================================
// TEACHING: How Date Filtering Works with TIMESTAMPTZ
// ============================================================
// PostgreSQL TIMESTAMPTZ stores dates with timezone info
// When comparing dates, we use date_trunc to compare just the date part
// created_at >= '2026-01-01' AND created_at <= '2026-01-31'
// The >= and <= operators work with TIMESTAMPTZ natively

// ============================================================
// TEACHING: Query Patterns
// ============================================================
// We need: Find transactions where user is sender OR receiver
// SQL: WHERE from_account_id = $1 OR to_account_id = $1
// This is a common pattern in double-entry systems

import express from 'express';
import pool from '../db/pool.js';
import { success, error } from '../utils/response.js';
import { authenticateJWT } from '../middleware/authenticate.js';

const router = express.Router();

// All routes need authentication
router.use(authenticateJWT);

// ============================================================
// GET /transactions/me - Transaction History
// ============================================================
// Returns all transactions where user is sender OR receiver
// Query params:
//   - page: Page number (default: 1)
//   - limit: Items per page (default: 20, max: 100)
//   - from: Start date filter (YYYY-MM-DD)
//   - to: End date filter (YYYY-MM-DD)
// ============================================================
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    // STEP 1: Look up the user's account ID
    // ============================================================
    // We need the account ID to find transactions where user 
    // is sender (from_account_id) OR receiver (to_account_id)
    // Each user has ONE account in this simplified system
    const accountResult = await pool.query(
      'SELECT id FROM financial.accounts WHERE user_id = $1',
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return error(res, 'Account not found', 404);
    }

    const userAccountId = accountResult.rows[0].id;

    // STEP 2: Parse and validate pagination parameters
    // ============================================================
    // page: Current page number (1-indexed, defaults to 1)
    // limit: Number of items per page (defaults to 20, max 100)
    // If user requests page 3 with limit 20, we skip first 40 rows
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    // Enforce maximum limit to prevent loading too much data
    // This is a security best practice - prevents DoS via large page requests
    limit = Math.min(limit, 100);

    // Ensure positive values
    page = Math.max(page, 1);
    limit = Math.max(limit, 1);

    // STEP 3: Parse date filter parameters
    // ============================================================
    // from: Start date (inclusive) - filter transactions created on or after this date
    // to: End date (inclusive) - filter transactions created on or before this date
    // Using created_at which is TIMESTAMPTZ in PostgreSQL
    const fromDate = req.query.from ? req.query.from : null;
    const toDate = req.query.to ? req.query.to : null;

    // STEP 4: Build dynamic query with filters
    // ============================================================
    // We'll build the query dynamically based on which filters are present
    // This is more flexible than writing separate queries for each combination
    
    // Base query - get transactions where user is sender OR receiver
    let query = `
      SELECT 
        t.id,
        t.reference,
        t.type,
        t.status,
        t.amount_cents,
        t.currency,
        t.description,
        t.processed_at,
        t.created_at,
        -- These fields show the other party in the transaction
        CASE 
          -- If user is sender, show receiver details
          WHEN t.from_account_id = $1 THEN t.to_account_id
          -- If user is receiver, show sender details
          ELSE t.from_account_id
        END as counterparty_account_id
      FROM financial.transactions t
      WHERE (t.from_account_id = $1 OR t.to_account_id = $1)
    `;

    const queryParams = [userAccountId];
    let paramIndex = 2; // $1 is already used for userAccountId

    // Add date filter if 'from' date is provided
    // Use created_at >= fromDate (inclusive start)
    if (fromDate) {
      // Using >= with the date string works with TIMESTAMPTZ
      // PostgreSQL will compare the full timestamp
      query += ` AND t.created_at >= $${paramIndex}`;
      queryParams.push(fromDate);
      paramIndex++;
    }

    // Add date filter if 'to' date is provided
    // Use created_at < the next day (exclusive end, inclusive for entire day)
    // OR use <= toDate at 23:59:59.999 if we wanted inclusive to end of day
    if (toDate) {
      // To make 'to' inclusive for the entire day, we use the next day with <
      // For simplicity, we'll just use <= with the date (PostgreSQL handles date as midnight)
      // Actually, let's use <= with the date + 1 day approach
      query += ` AND t.created_at < $${paramIndex}::date + interval '1 day'`;
      queryParams.push(toDate);
      paramIndex++;
    }

    // STEP 5: Get total count for pagination metadata
    // ============================================================
    // We need to know total rows to calculate totalPages
    // Replace SELECT columns with COUNT(*)
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // STEP 6: Add ORDER BY and pagination (LIMIT/OFFSET)
    // ============================================================
    // ORDER BY created_at DESC: Newest transactions first
    // LIMIT: Number of rows to return
    // OFFSET: Number of rows to skip (formula: (page - 1) * limit)
    query += ` ORDER BY t.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    queryParams.push(limit, (page - 1) * limit);

    // STEP 7: Execute the query
    // ============================================================
    const result = await pool.query(query, queryParams);

    // STEP 8: Build response with pagination metadata
    // ============================================================
    // Return:
    // - data: Array of transactions
    // - pagination: Metadata for the client to handle pagination UI
    const totalPages = Math.ceil(total / limit);

    return success(res, {
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });

  } catch (err) {
    console.error('GET /transactions/me error:', err);
    return error(res, 'Internal server error', 500);
  }
});

export default router;
