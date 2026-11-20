// ============================================================================
// File: src/auth/authUtils.js
// Owner: Dhruv (Database & Auth)
// Purpose: Cryptographic utilities for password hashing, JWT access tokens,
//          cryptographically hashed refresh tokens, and OAuth2/OIDC claims.
// ============================================================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Known placeholder values that must never sign real tokens.
const PLACEHOLDER_JWT_SECRETS = new Set([
  'cobuy_development_secret_key_change_in_production',
  'replace_with_a_long_random_secret',
  'your_jwt_secret_key',
  'secret'
]);

/**
 * Resolves the JWT signing secret.
 * Production fails fast on a missing/placeholder/short secret; development uses
 * a random per-process secret so a cloned repo never signs tokens with a
 * publicly known key.
 */
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const unusable = !secret || secret.length < 32 || PLACEHOLDER_JWT_SECRETS.has(secret);

  if (!unusable) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Auth] JWT_SECRET is missing, a known placeholder, or shorter than 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  console.warn(
    '[Auth] JWT_SECRET is missing or a placeholder. Using a random per-process secret for this ' +
    'development run; tokens stop working on restart. Set JWT_SECRET in .env.'
  );
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7', 10);
const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generates a signed short-lived JWT Access Token containing user identity and roles.
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

/**
 * Backward compatibility wrapper for generateAccessToken.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies and decodes a JSON Web Token.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Hashes an opaque token using SHA-256 for secure database storage.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates an opaque, cryptographically random Refresh Token and its SHA-256 hash.
 * Storing only the hash prevents token theft if the database is compromised.
 */
function generateRefreshToken(days = REFRESH_TOKEN_DAYS) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash,
    expiresAt
  };
}

/**
 * Generates a random state string for OAuth2 CSRF protection.
 */
function generateOAuthState() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateToken,
  verifyToken,
  hashToken,
  generateRefreshToken,
  generateOAuthState
};
