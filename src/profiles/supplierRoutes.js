// ============================================================================
// File: src/profiles/supplierRoutes.js
// Owner: Dhruv (Database & Auth)
// Purpose: Express routes for supplier company profiles.
// ============================================================================

const express = require('express');
const router = express.Router();
const supplierController = require('./supplierController');
const { authenticate, requireRole } = require('../auth/authMiddleware');

// Protected: Only authenticated suppliers can create or manage their company profile
router.post('/', authenticate, requireRole(['supplier']), supplierController.createSupplier);
router.get('/me', authenticate, requireRole(['supplier']), supplierController.getMySupplier);

// Owner-only profile maintenance. The controller re-checks ownership.
router.patch('/:id', authenticate, requireRole(['supplier']), supplierController.updateSupplier);
router.delete('/:id', authenticate, requireRole(['supplier']), supplierController.deleteSupplier);

// Public/Authenticated: View a specific supplier company by ID
router.get('/:id', supplierController.getSupplierById);

module.exports = router;

