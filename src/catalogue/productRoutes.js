// ============================================================================
// File: src/catalogue/productRoutes.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Express router for the shared PRODUCTS catalogue.
// ============================================================================

const express = require('express');
const productController = require('./productController');
const { authenticate, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

// Public: anyone can browse the base ingredient catalogue.
router.get('/', productController.listProducts);

// Supplier-only mutations.
router.post('/', authenticate, requireRole(['supplier']), productController.createProduct);
router.patch('/:id', authenticate, requireRole(['supplier']), productController.updateProduct);
router.delete('/:id', authenticate, requireRole(['supplier']), productController.deleteProduct);

module.exports = router;
