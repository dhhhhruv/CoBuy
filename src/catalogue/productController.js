// ============================================================================
// File: src/catalogue/productController.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: CRUD for the shared PRODUCTS catalogue (base ingredient definitions).
//
// Viva Note: PRODUCTS stores what an ingredient IS (name, unit, category).
// It deliberately stores no price: the same product is offered by many
// suppliers at different prices, so price belongs to supplier_catalogue.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { AppError } = require('../middleware/errorHandler');

const EMAIL_UNIT_MAX = 20;

function formatProduct(product) {
  return {
    productId: product.product_id,
    productName: product.product_name,
    unitOfMeasure: product.unit_of_measure,
    category: product.category
  };
}

/**
 * GET /api/products
 * Public list of base products. Includes how many supplier offers exist so the
 * supplier UI can show which ingredients already have competing offers.
 */
async function listProducts(req, res, next) {
  try {
    const products = await prisma.products.findMany({
      orderBy: { product_name: 'asc' },
      include: { _count: { select: { supplier_catalogue: true } } }
    });

    return res.status(200).json({
      success: true,
      data: products.map((p) => ({
        ...formatProduct(p),
        supplierOfferCount: p._count.supplier_catalogue
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/products
 * Supplier-only: adds a base product definition if it does not already exist.
 * If a product with the same name and unit exists, the existing row is returned
 * with 200 instead of creating a duplicate definition.
 */
async function createProduct(req, res, next) {
  try {
    const { productName, unitOfMeasure, category } = req.body;

    if (!productName || typeof productName !== 'string' || productName.trim().length === 0) {
      throw new AppError('productName is required', 400, 'VALIDATION_ERROR');
    }
    if (!unitOfMeasure || typeof unitOfMeasure !== 'string' || unitOfMeasure.trim().length === 0) {
      throw new AppError('unitOfMeasure is required (e.g. "kg", "litre")', 400, 'VALIDATION_ERROR');
    }
    if (unitOfMeasure.trim().length > EMAIL_UNIT_MAX) {
      throw new AppError(`unitOfMeasure must be ${EMAIL_UNIT_MAX} characters or fewer`, 400, 'VALIDATION_ERROR');
    }

    const name = productName.trim();
    const unit = unitOfMeasure.trim().toLowerCase();

    const existing = await prisma.products.findFirst({
      where: { product_name: name, unit_of_measure: unit }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        data: formatProduct(existing),
        message: 'Product already exists in the shared catalogue',
        timestamp: new Date().toISOString()
      });
    }

    const created = await prisma.products.create({
      data: {
        product_id: crypto.randomUUID(),
        product_name: name,
        unit_of_measure: unit,
        category: category ? String(category).trim() : null
      }
    });

    return res.status(201).json({
      success: true,
      data: formatProduct(created),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/products/:id
 * Supplier-only: correct the display name, unit or category of a base product.
 */
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { productName, unitOfMeasure, category } = req.body;

    const existing = await prisma.products.findUnique({ where: { product_id: id } });
    if (!existing) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const data = {};
    if (productName !== undefined) {
      if (typeof productName !== 'string' || productName.trim().length === 0) {
        throw new AppError('productName cannot be empty', 400, 'VALIDATION_ERROR');
      }
      data.product_name = productName.trim();
    }
    if (unitOfMeasure !== undefined) {
      if (typeof unitOfMeasure !== 'string' || unitOfMeasure.trim().length === 0) {
        throw new AppError('unitOfMeasure cannot be empty', 400, 'VALIDATION_ERROR');
      }
      data.unit_of_measure = unitOfMeasure.trim().toLowerCase();
    }
    if (category !== undefined) {
      data.category = category === null ? null : String(category).trim();
    }

    if (Object.keys(data).length === 0) {
      throw new AppError('No updatable fields supplied', 400, 'VALIDATION_ERROR');
    }

    const updated = await prisma.products.update({ where: { product_id: id }, data });

    return res.status(200).json({
      success: true,
      data: formatProduct(updated),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/products/:id
 * Supplier-only. Refused while any supplier offer references the product,
 * because supplier_catalogue.product_id uses ON DELETE RESTRICT.
 */
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    const offerCount = await prisma.supplier_catalogue.count({ where: { product_id: id } });
    if (offerCount > 0) {
      throw new AppError(
        `Cannot delete product: ${offerCount} supplier offer(s) still reference it`,
        409,
        'PRODUCT_IN_USE'
      );
    }

    await prisma.products.delete({ where: { product_id: id } });

    return res.status(200).json({
      success: true,
      data: { productId: id, deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct
};
