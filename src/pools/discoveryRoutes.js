// ============================================================================
// File: src/pools/discoveryRoutes.js
// Owner: Dhruv (Database & Auth)
// Purpose: Express routes for buying pool spatial discovery within 5 km.
// ============================================================================

const express = require('express');
const router = express.Router();
const discoveryController = require('./discoveryController');
const { optionalAuthenticate } = require('../auth/authMiddleware');

// Discovery endpoint: supports query parameters (latitude, longitude) or authenticated user restaurant
router.get('/discover', optionalAuthenticate, discoveryController.discoverNearbyPools);

module.exports = router;

