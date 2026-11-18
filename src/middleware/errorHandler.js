// ============================================================================
// File: src/middleware/errorHandler.js
// Owner: Dhruv (Database & Auth)
// Purpose: Centralized error handling and validation middleware conforming
//          strictly to docs/API_CONTRACT.md.
// ============================================================================

/**
 * Custom application error class allowing controllers to throw structured errors
 * with specific HTTP status codes and API contract error codes.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * 404 Route Not Found middleware.
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Global Express error handling middleware.
 * Maps Prisma, syntax, validation, and unexpected runtime errors into
 * the standardized API_CONTRACT error envelope.
 */
function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details
      },
      timestamp
    });
  }

  // 2. Prisma Known Request Errors
  if (err.code === 'P2002') {
    // Unique constraint violation (e.g. duplicate username, email, or order per restaurant per pool)
    const target = err.meta?.target || 'field';
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: `A record with this ${target} already exists.`
      },
      timestamp
    });
  }

  if (err.code === 'P2025') {
    // Record not found
    return res.status(404).json({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: err.meta?.cause || 'The requested resource was not found.'
      },
      timestamp
    });
  }

  if (err.code === 'P2003') {
    // Foreign key constraint failure
    return res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'The referenced foreign entity does not exist.'
      },
      timestamp
    });
  }

  // 3. JSON Syntax error from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body.'
      },
      timestamp
    });
  }

  // 4. Fallback unhandled server error
  console.error('[Unhandled Server Error]:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.'
    },
    timestamp
  });
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler
};
