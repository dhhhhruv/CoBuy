// ============================================================================
// File: src/auth/authController.js
// Owner: Dhruv (Database & Auth)
// Purpose: Controller handlers for user registration, login, and profile lookup using Prisma ORM.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { hashPassword, comparePassword, generateToken } = require('./authUtils');

// Allowed roles as settled in DECISIONS.md
const ALLOWED_ROLES = ['restaurant_owner', 'supplier'];

/**
 * Register a new user and assign roles within an atomic Prisma interactive transaction.
 * Viva Note: prisma.$transaction ensures that if assigning roles fails, the user record
 * is automatically rolled back, preventing orphaned users in the database.
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

  const uniqueRoles = [...new Set(roles)];
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // 2. Check for duplicate username or email via Prisma
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanEmail }
        ]
      }
    });

    if (existingUser) {
      const field = existingUser.username.toLowerCase() === cleanUsername.toLowerCase() ? 'Username' : 'Email';
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

    // 4. Atomic Prisma Transaction: Create User & UserRoles
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          user_id: userId,
          username: cleanUsername,
          email: cleanEmail,
          password_hash: passwordHash
        }
      });

      for (const roleName of uniqueRoles) {
        await tx.user_roles.create({
          data: {
            user_id: userId,
            role_name: roleName
          }
        });
      }

      return user;
    });

    return res.status(201).json({
      success: true,
      data: {
        userId: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        roles: uniqueRoles,
        createdAt: newUser.created_at.toISOString()
      },
      timestamp: new Date().toISOString()
    });
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
 * Log in an existing user via Prisma, verify bcrypt password, and return a signed JWT token.
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
    // Query user by email or username, including their relation to user_roles
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      },
      include: {
        user_roles: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email/username or password'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Verify bcrypt password
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

    const roles = user.user_roles.map(r => r.role_name);

    // Issue JWT token
    const token = generateToken({
      userId: user.user_id,
      username: user.username,
      email: user.email,
      roles
    });

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
