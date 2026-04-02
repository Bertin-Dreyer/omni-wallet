import express from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { randomInt } from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db/pool.js';
import { generateTokens, verifyToken, hashToken } from '../utils/tokens.js';
import { created, success, error, unauthorized } from '../utils/response.js';
import { config } from '../config/index.js';

const router = express.Router();

// --- Rate Limiting ---

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, error: 'Too many requests, please try again later' },
});

router.use(authLimiter);

// --- Validation Schemas ---

const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// --- Helpers ---

function getRefreshTokenExpirySeconds() {
  const match = config.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60;
  const [, value, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(value, 10) * (multipliers[unit] || 86400);
}

async function storeRefreshToken(client, userId, token) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + getRefreshTokenExpirySeconds() * 1000);
  await client.query(
    `INSERT INTO identity.refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function revokeRefreshToken(client, token) {
  const tokenHash = hashToken(token);
  await client.query(
    `UPDATE identity.refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function findValidRefreshToken(token) {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM identity.refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

// --- POST /auth/register ---

router.post('/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }

    const { name, email, password } = parseResult.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO identity.users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, status, created_at`,
        [name, email, passwordHash]
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO identity.kyc_profiles (user_id) VALUES ($1)`,
        [user.id]
      );

      await client.query(
        `INSERT INTO identity.popia_consents (user_id, ip_address, policy_version)
         VALUES ($1, $2, $3)`,
        [user.id, req.ip || '127.0.0.1', '1.0']
      );

      const accountNumber = (1000000000 + randomInt(0, 9000000000)).toString();
      await client.query(
        `INSERT INTO financial.accounts (user_id, account_number, status)
         VALUES ($1, $2, $3)`,
        [user.id, accountNumber, 'ACTIVE']
      );

      const { accessToken, refreshToken } = generateTokens(user.id);
      await storeRefreshToken(client, user.id, refreshToken);

      await client.query('COMMIT');

      return created(res, {
        user: { id: user.id, name: user.name, email: user.email, status: user.status },
        accessToken,
        refreshToken,
      }, 'Registration successful');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return error(res, 'Email already registered', 409);
    }
    console.error('Registration error:', err);
    return error(res, 'Registration failed');
  }
});

// --- POST /auth/login ---

router.post('/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }

    const { email, password } = parseResult.data;

    const result = await pool.query(
      `SELECT id, name, email, password_hash, status
       FROM identity.users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return unauthorized(res, 'Invalid credentials');
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return unauthorized(res, 'Invalid credentials');
    }

    if (user.status !== 'active') {
      return unauthorized(res, 'Account is not active');
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await storeRefreshToken(pool, user.id, refreshToken);

    return success(res, {
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed');
  }
});

// --- POST /auth/refresh ---

router.post('/refresh', async (req, res) => {
  try {
    const parseResult = refreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.issues[0].message, 400);
    }

    const { refreshToken } = parseResult.data;

    const stored = await findValidRefreshToken(refreshToken);
    if (!stored) {
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    const decoded = verifyToken(refreshToken, config.jwt.refreshSecret);

    await revokeRefreshToken(pool, refreshToken);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.sub);
    await storeRefreshToken(pool, decoded.sub, newRefreshToken);

    return success(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Invalid or expired refresh token');
    }
    console.error('Refresh error:', err);
    return error(res, 'Token refresh failed');
  }
});

// --- POST /auth/logout ---

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(pool, refreshToken);
    }
    return success(res, null, 'Logout successful');
  } catch (err) {
    console.error('Logout error:', err);
    return success(res, null, 'Logout successful');
  }
});

export default router;
