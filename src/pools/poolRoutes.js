// ============================================================================
// File: src/pools/poolRoutes.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Express router for pool discovery, creation, listing and detail.
// ============================================================================

const express = require('express');
const poolController = require('./poolController');
const discoveryController = require('./discoveryController');
const { authenticate, requireRole, optionalAuthenticate } = require('../auth/authMiddleware');

const router = express.Router();

/**
 * GET /api/pools/discover
 * 5 km discovery for a restaurantId or latitude/longitude pair.
 * (Owned by Dhruv; reused unchanged.)
 */
router.get('/discover', optionalAuthenticate, discoveryController.discoverNearbyPools);

/**
 * GET /api/pools/nearby?lat=&lng=&radius=
 * Contract alias used by the frontend. `lat`/`lng` are normalised onto the
 * canonical `latitude`/`longitude` query parameters before discovery runs.
 */
router.get('/nearby', optionalAuthenticate, (req, res, next) => {
  if (req.query.lat !== undefined && req.query.latitude === undefined) {
    req.query.latitude = req.query.lat;
  }
  if (req.query.lng !== undefined && req.query.longitude === undefined) {
    req.query.longitude = req.query.lng;
  }
  return discoveryController.discoverNearbyPools(req, res, next);
});

/**
 * POST /api/pools
 * Supplier-only pool creation from one of the company's catalogue offers.
 */
router.post('/', authenticate, requireRole(['supplier']), poolController.createPool);

/**
 * GET /api/pools
 * Listing with optional status/supplier/catalogue filters. Location filters
 * switch the response to distance-aware discovery.
 */
router.get('/', optionalAuthenticate, poolController.listPools);

/**
 * GET /api/pools/:id
 * Kept last so it cannot shadow /discover or /nearby.
 */
router.get('/:id', optionalAuthenticate, poolController.getPoolById);

module.exports = router;
