// ============================================================================
// File: src/profiles/restaurantRoutes.js
// Owner: Dhruv (Database & Auth)
// Purpose: Express routes for restaurant profiles.
// ============================================================================

const express = require('express');
const router = express.Router();
const restaurantController = require('./restaurantController');
const { authenticate, requireRole } = require('../auth/authMiddleware');

// Protected: Only authenticated restaurant owners can create or view their kitchens
router.post('/', authenticate, requireRole(['restaurant_owner']), restaurantController.createRestaurant);
router.get('/me', authenticate, requireRole(['restaurant_owner']), restaurantController.getMyRestaurants);

// Owner-only profile maintenance. The controller re-checks ownership.
router.patch('/:id', authenticate, requireRole(['restaurant_owner']), restaurantController.updateRestaurant);
router.delete('/:id', authenticate, requireRole(['restaurant_owner']), restaurantController.deleteRestaurant);

// Public/Authenticated: View a specific restaurant by ID
router.get('/:id', restaurantController.getRestaurantById);

module.exports = router;

