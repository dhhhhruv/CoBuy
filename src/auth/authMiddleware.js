// ============================================================================
// File: src/auth/authMiddleware.js
// Owner: Dhruv (Database & Auth)
// Purpose: Express middleware for JWT authentication and role-based access control.
// ============================================================================

const { verifyToken } = require('./authUtils');

/**
 * Authentication Middleware:
 * Inspects incoming request headers for 'Authorization: Bearer <token>'.
 * If valid, decodes the user payload and attaches it to req.user.
 * If missing or invalid, returns HTTP 401 Unauthorized.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authorization token is required (format: Bearer <token>)'
      },
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    // Attach identity to request object for downstream controllers
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles || []
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authorization token',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Guard:
 * Viva Note on Authentication vs Authorization:
 * - Authentication verifies WHO you are (via JWT verification in authenticate()).
 * - Authorization verifies WHAT you are permitted to do (via requireRole()).
 *
 * @param {string[]} allowedRoles - List of roles permitted to access this endpoint
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: User roles could not be verified'
        },
        timestamp: new Date().toISOString()
      });
    }

    const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: Requires one of the following roles: [${allowedRoles.join(', ')}]`
        },
        timestamp: new Date().toISOString()
      });
    }

    return next();
  };
}

/**
 * Optional Authentication:
 * If Authorization header is present, decodes user into req.user.
 * If not present, proceeds without failing.
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles || []
    };
  } catch (error) {
    // In optional auth, invalid token is treated as unauthenticated
  }
  return next();
}

module.exports = {
  authenticate,
  requireRole,
  optionalAuthenticate
};

