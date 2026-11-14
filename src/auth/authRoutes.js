// ============================================================================
// File: src/auth/authRoutes.js
// Owner: Dhruv (Database & Auth)
// Purpose: Router definitions for user authentication and profile verification.
// ============================================================================

const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticate } = require('./authMiddleware');

// Public authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected token verification route
router.get('/me', authenticate, authController.getMe);

module.exports = router;

