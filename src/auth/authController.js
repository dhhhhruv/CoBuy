// ============================================================================
// File: src/auth/authController.js
// Owner: Dhruv (Database & Auth)
// Purpose: Controller handlers for user registration, login, and profile lookup.
// ============================================================================

const crypto = require('crypto');
const { pool } = require('../db/connection');
const { hashPassword, comparePassword, generateToken } = require('./authUtils');

// Allowed roles as settled in DECISIONS.md
const ALLOWED_ROLES = ['restaurant_owner', 'supplier'];

/**
 * Register a new user and assign roles within an ACID database transaction.
 * Viva Note: Inserting into USERS and USER_ROLES happens inside an atomic transaction.
 * If role insertion fails, the user record is rolled back, preventing orphaned users.
 */
async function register(req, res) {
  const { username, email, password, roles } = req.body;

  // 1. Input Validation
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Username is required and must be at least 3 characters long'
      },
      timestamp: new Date().toISOString()
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'A valid email address is required'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password is required and must be at least 6 characters long'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Roles must be a non-empty array containing valid roles (restaurant_owner, supplier)'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Ensure all submitted roles are permitted by schema constraints
  const invalidRoles = roles.filter(role => !ALLOWED_ROLES.includes(role));
  if (invalidRoles.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ROLE',
        message: `Invalid role(s) specified: [${invalidRoles.join(', ')}]. Allowed roles: [${ALLOWED_ROLES.join(', ')}]`
      },
      timestamp: new Date().toISOString()
    });
  }

  // Deduplicate roles if duplicate values were passed in array
  const uniqueRoles = [...new Set(roles)];

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 2. Check for duplicate username or email
  try {
    const [existingUsers] = await pool.query(
      'SELECT user_id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [cleanUsername, cleanEmail]
    );

    if (existingUsers.length > 0) {
      const match = existingUsers[0];
      const field = match.username.toLowerCase() === cleanUsername.toLowerCase() ? 'Username' : 'Email';
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_USER',
          message: `${field} is already registered. Please choose another or log in.`
        },
        timestamp: new Date().toISOString()
      });
    }

    // 3. Hash password with bcrypt
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    // 4. Atomic Transaction: Insert into USERS and USER_ROLES
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert primary user row
      await connection.query(
        'INSERT INTO users (user_id, username, email, password_hash) VALUES (?, ?, ?, ?)',
        [userId, cleanUsername, cleanEmail, passwordHash]
      );

      // Insert role mappings into USER_ROLES
      for (const roleName of uniqueRoles) {
        await connection.query(
          'INSERT INTO user_roles (user_id, role_name) VALUES (?, ?)',
          [userId, roleName]
        );
      }

      await connection.commit();

      return res.status(201).json({
        success: true,
        data: {
          userId,
          username: cleanUsername,
          email: cleanEmail,
          roles: uniqueRoles,
          createdAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[Registration Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during registration. Please try again.'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Log in an existing user, verify bcrypt password, and return a signed JWT token.
 */
async function login(req, res) {
  const { email, username, password } = req.body;

  const identifier = (email || username || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email/username and password are required'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 1. Query user by email or username
    const [users] = await pool.query(
      'SELECT user_id, username, email, password_hash, created_at FROM users WHERE email = ? OR username = ? LIMIT 1',
      [identifier.toLowerCase(), identifier]
    );

    if (users.length === 0) {
      // Viva Note on Security: Return a generic error message rather than "User not found".
      // This prevents username enumeration attacks where an attacker probes to see which emails exist.
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email/username or password'
        },
        timestamp: new Date().toISOString()
      });
    }

    const user = users[0];

    // 2. Compare password against stored bcrypt hash
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email/username or password'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 3. Fetch user's assigned roles from USER_ROLES table
    const [roleRows] = await pool.query(
      'SELECT role_name FROM user_roles WHERE user_id = ?',
      [user.user_id]
    );

    const roles = roleRows.map(r => r.role_name);

    // 4. Generate signed JWT token
    const tokenPayload = {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      roles
    };

    const token = generateToken(tokenPayload);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
          roles
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login. Please try again.'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get profile information of the currently authenticated user.
 */
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  register,
  login,
  getMe
};

