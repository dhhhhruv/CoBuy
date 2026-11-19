// ============================================================================
// File: src/auth/authRoutes.js
// Owner: Dhruv (Database & Auth)
// Purpose: Router definitions for user registration, login, token rotation,
//          and OAuth2/OIDC federated identity.
// ============================================================================

const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authenticate } = require('./authMiddleware');

// 1. Standard Authentication Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// 2. OAuth2 / OpenID Connect (OIDC) Routes
router.get('/oauth/authorize', authController.oauthAuthorize);
router.get('/oauth/callback', authController.oauthCallback);
router.post('/oauth/token', authController.oauthToken);
router.post('/oauth/mock', authController.oauthMock);

// 3. Protected token verification route
router.get('/me', authenticate, authController.getMe);

module.exports = router;
