// ============================================================================
// File: src/orders/orderRoutes.js
// Owner: Dhruv (Database & Auth) & Aggregation Engine
// Purpose: Express router for micro-orders, order history, and payment updates.
// ============================================================================

const express = require('express');
const { authenticate, requireRole } = require('../auth/authMiddleware');
const {
  placeOrder,
  getMyOrders,
  getPoolOrders,
  updatePaymentStatus
} = require('./orderController');

const router = express.Router();

// POST /api/orders — Place atomic micro-order (restaurant owners only)
router.post('/', authenticate, requireRole(['restaurant_owner']), placeOrder);

// GET /api/orders/my — Restaurant owner's micro-order history
router.get('/my', authenticate, requireRole(['restaurant_owner']), getMyOrders);

// Alternative path alias matching contract: GET /api/orders/my-orders
router.get('/my-orders', authenticate, requireRole(['restaurant_owner']), getMyOrders);

// GET /api/orders/pool/:poolId — View all orders in a pool
router.get('/pool/:poolId', authenticate, getPoolOrders);

// PATCH /api/orders/:id/payment — Update payment status (PENDING -> PAID)
router.patch('/:id/payment', authenticate, updatePaymentStatus);

module.exports = router;
