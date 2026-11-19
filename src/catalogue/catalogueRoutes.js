// ============================================================================
// File: src/catalogue/catalogueRoutes.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Express router for SUPPLIER_CATALOGUE offers.
// ============================================================================

const express = require('express');
const catalogueController = require('./catalogueController');
const { authenticate, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

// Public: kitchens compare offers across suppliers.
router.get('/', catalogueController.listCatalogue);

// Supplier-only: own offers and mutations. /me must precede /:id routes.
router.get('/me', authenticate, requireRole(['supplier']), catalogueController.getMyCatalogue);
router.post('/', authenticate, requireRole(['supplier']), catalogueController.createOffer);
router.patch('/:id', authenticate, requireRole(['supplier']), catalogueController.updateOffer);
router.delete('/:id', authenticate, requireRole(['supplier']), catalogueController.deleteOffer);

module.exports = router;
