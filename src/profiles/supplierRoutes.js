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

// Public/Authenticated: View a specific supplier company by ID
router.get('/:id', supplierController.getSupplierById);

module.exports = router;

