// ============================================================================
// File: src/auth/authController.js
// Owner: Dhruv (Database & Auth)
// Purpose: Controller handlers for user registration, login, dual-token management
//          (JWT Access Token + Refresh Token rotation), and OAuth2/OIDC integration.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateToken,
  generateRefreshToken,
  hashToken
} = require('./authUtils');
const oidcService = require('./oidcService');

// Allowed roles as settled in DECISIONS.md
const ALLOWED_ROLES = ['restaurant_owner', 'supplier'];

/**
 * Helper to atomically generate both Access and Refresh tokens for a user.
 * Stores the SHA-256 hash of the refresh token in the database.
 */
async function issueTokenPair(user, roles) {
  const payload = {
    userId: user.user_id,
    username: user.username,
    email: user.email,
    roles
  };

  const accessToken = generateAccessToken(payload);
  const refreshData = generateRefreshToken();

  await prisma.refresh_tokens.create({
    data: {
      token_id: crypto.randomUUID(),
      user_id: user.user_id,
      token_hash: refreshData.tokenHash,
      expires_at: refreshData.expiresAt,
      revoked: false
    }
  });

  return {
    token: accessToken,        // Kept for backward compatibility with existing tests/clients
    accessToken,
    refreshToken: refreshData.rawToken,
    tokenType: 'Bearer',
    expiresIn: 900             // 15 minutes in seconds
  };
}

/**
 * Register a new user and assign roles within an atomic Prisma interactive transaction.
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
    // 2. Check for duplicate username or email
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
 * Log in an existing user, verify bcrypt password, and issue JWT Access Token + Refresh Token.
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
    const tokens = await issueTokenPair(user, roles);

    return res.status(200).json({
      success: true,
      data: {
        ...tokens,
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
 * POST /api/users/refresh
 * Exchanges a valid Refresh Token for a new Access Token with token rotation.
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'refreshToken is required'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const hashed = hashToken(refreshToken.trim());

    const storedToken = await prisma.refresh_tokens.findUnique({
      where: { token_hash: hashed },
      include: {
        users: {
          include: {
            user_roles: true
          }
        }
      }
    });

    // Verify token exists, has not been revoked, and is not expired
    if (!storedToken || storedToken.revoked || new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid, expired, or has been revoked'
        },
        timestamp: new Date().toISOString()
      });
    }

    const user = storedToken.users;
    const roles = user.user_roles.map(r => r.role_name);

    // Refresh Token Rotation: Revoke previous token and issue a fresh pair
    await prisma.refresh_tokens.update({
      where: { token_id: storedToken.token_id },
      data: { revoked: true }
    });

    const newTokens = await issueTokenPair(user, roles);

    return res.status(200).json({
      success: true,
      data: newTokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Token Refresh Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while refreshing authentication token'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/users/logout
 * Revokes the provided Refresh Token, terminating the session.
 */
async function logout(req, res) {
  const { refreshToken } = req.body;

  try {
    if (refreshToken && typeof refreshToken === 'string') {
      const hashed = hashToken(refreshToken.trim());
      await prisma.refresh_tokens.updateMany({
        where: { token_hash: hashed },
        data: { revoked: true }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Refresh token revoked.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logout Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/users/oauth/authorize
 * Initiates the OAuth2 / OpenID Connect authorization code grant flow.
 */
async function oauthAuthorize(req, res) {
  const { provider = 'google', role = 'restaurant_owner', redirect = 'false' } = req.query;

  const authData = oidcService.getAuthorizationUrl({
    provider,
    role
  });

  if (redirect === 'true') {
    return res.redirect(authData.authorizationUrl);
  }

  return res.status(200).json({
    success: true,
    data: authData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Internal JIT provisioning helper for OIDC identities.
 */
async function provisionOIDCUser({ email, name, role = 'restaurant_owner' }) {
  const cleanEmail = email.trim().toLowerCase();
  const baseUsername = (name || cleanEmail.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 30);

  let user = await prisma.users.findUnique({
    where: { email: cleanEmail },
    include: { user_roles: true }
  });

  if (!user) {
    const userId = crypto.randomUUID();
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    // Make username unique if base is taken
    let finalUsername = baseUsername;
    const existingUsername = await prisma.users.findUnique({ where: { username: finalUsername } });
    if (existingUsername) {
      finalUsername = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`;
    }

    user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          user_id: userId,
          username: finalUsername,
          email: cleanEmail,
          password_hash: passwordHash
        }
      });

      await tx.user_roles.create({
        data: {
          user_id: userId,
          role_name: role
        }
      });

      return {
        ...created,
        user_roles: [{ user_id: userId, role_name: role }]
      };
    });
  }

  const roles = user.user_roles.map(r => r.role_name);
  const tokens = await issueTokenPair(user, roles);

  return {
    ...tokens,
    user: {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      roles
    }
  };
}

/**
 * GET /api/users/oauth/callback
 * Authorization code callback handler from OAuth2/OIDC provider.
 */
async function oauthCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'OAUTH_ERROR',
        message: `Provider returned error: ${error}`
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CODE_REQUIRED',
        message: 'Authorization code is missing from callback query parameters'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const stateData = oidcService.parseOAuthState(state || '');
    const profile = await oidcService.exchangeCodeForProfile(code);
    const authResult = await provisionOIDCUser({
      email: profile.email,
      name: profile.name,
      role: stateData.role
    });

    return res.status(200).json({
      success: true,
      data: authResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[OAuth Callback Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'OAUTH_EXCHANGE_FAILED',
        message: 'Failed to complete OAuth2/OIDC authentication: ' + err.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/users/oauth/token
 * Direct authorization code exchange endpoint for Single Page Applications (SPAs).
 */
async function oauthToken(req, res) {
  const { code, state, role = 'restaurant_owner' } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CODE_REQUIRED',
        message: 'Authorization code is required'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const stateData = state ? oidcService.parseOAuthState(state) : { role };
    const profile = await oidcService.exchangeCodeForProfile(code);
    const authResult = await provisionOIDCUser({
      email: profile.email,
      name: profile.name,
      role: stateData.role || role
    });

    return res.status(200).json({
      success: true,
      data: authResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[OAuth Token Exchange Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'OAUTH_EXCHANGE_FAILED',
        message: err.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/users/oauth/mock
 * Dedicated deterministic endpoint for offline viva presentations & test automation.
 */
async function oauthMock(req, res) {
  const { email, name, role = 'restaurant_owner' } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email is required for mock OIDC sign-in'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const authResult = await provisionOIDCUser({
      email,
      name: name || email.split('@')[0],
      role
    });

    return res.status(200).json({
      success: true,
      data: authResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Mock OIDC Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message
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
  refresh,
  logout,
  oauthAuthorize,
  oauthCallback,
  oauthToken,
  oauthMock,
  getMe
};
