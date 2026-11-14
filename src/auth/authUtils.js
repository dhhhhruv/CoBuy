// ============================================================================
// File: src/auth/authUtils.js
// Owner: Dhruv (Database & Auth)
// Purpose: Cryptographic utilities for password hashing and JWT token management.
// ============================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'cobuy_development_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

// ----------------------------------------------------------------------------
// Viva Note on Hashing vs Encryption:
// Hashing is a one-way mathematical function: once plaintext is hashed, it can
// never be decrypted back to plaintext. Passwords must ALWAYS be hashed.
// Salting adds random data (salt) to the password before hashing, which ensures
// two identical passwords generate completely different hashes, defending against
// pre-computed dictionary / rainbow table attacks.
// ----------------------------------------------------------------------------

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 * @param {string} password - Raw plaintext password from user
 * @returns {Promise<string>} - The resulting irreversible password hash
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 * @param {string} password - Raw plaintext password from login attempt
 * @param {string} hash - Stored hash from the database
 * @returns {Promise<boolean>} - True if matching, false otherwise
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// ----------------------------------------------------------------------------
// Viva Note on JWT (JSON Web Tokens) vs Server Sessions:
// We use JWTs for stateless authentication. In traditional session-based auth,
// the server must store session IDs in memory or a database (like Redis).
// With JWT, the user credentials and roles are digitally signed and carried by
// the client. The server only needs to verify the cryptographic signature using
// JWT_SECRET, which requires zero database lookups for session verification.
// ----------------------------------------------------------------------------

/**
 * Generates a signed JSON Web Token containing basic user identity and roles.
 * @param {object} payload - Identity object, e.g. { userId, username, email, roles }
 * @returns {string} - Signed JWT string
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies and decodes a JSON Web Token.
 * @param {string} token - Raw JWT string from Authorization header
 * @returns {object} - Decoded payload if signature is valid
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
};

