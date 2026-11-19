// ============================================================================
// File: src/catalogue/catalogueController.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: CRUD for SUPPLIER_CATALOGUE - the junction table that turns a
//          supplier/product many-to-many relationship into one commercial
//          offer per supplier per product (price_per_unit, min_order_qty).
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { AppError } = require('../middleware/errorHandler');

function formatOffer(offer) {
  return {
    catalogueId: offer.catalogue_id,
    supplierId: offer.supplier_id,
    supplierName: offer.suppliers ? offer.suppliers.company_name : undefined,
    productId: offer.product_id,
    productName: offer.products ? offer.products.product_name : undefined,
    unitOfMeasure: offer.products ? offer.products.unit_of_measure : undefined,
    category: offer.products ? offer.products.category : undefined,
    pricePerUnit: Number(offer.price_per_unit),
    minOrderQty: Number(offer.min_order_qty)
  };
}

const INCLUDE_RELATIONS = {
  products: true,
  suppliers: { select: { company_name: true } }
};

/**
 * Resolves the SUPPLIER row owned by the logged-in user (Decision 2.1).
 * Prevents a supplier from reading or editing another company's offers.
 */
async function resolveOwnedSupplier(req) {
  const supplier = await prisma.suppliers.findFirst({
    where: { user_id: req.user.userId }
  });

  if (!supplier) {
    throw new AppError(
      'No supplier profile is linked to this account. Create a supplier profile first.',
      404,
      'SUPPLIER_PROFILE_REQUIRED'
    );
  }
  return supplier;
}

function parsePositiveDecimal(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400, 'VALIDATION_ERROR');
  }
  return Number(parsed.toFixed(2));
}

/**
 * GET /api/catalogue
 * Public list of every supplier offer. Optional filters: supplierId, productId.
 */
async function listCatalogue(req, res, next) {
  try {
    const { supplierId, productId } = req.query;

    const where = {};
    if (supplierId) where.supplier_id = supplierId;
    if (productId) where.product_id = productId;

    const offers = await prisma.supplier_catalogue.findMany({
      where,
      include: INCLUDE_RELATIONS,
      orderBy: { price_per_unit: 'asc' }
    });

    return res.status(200).json({
      success: true,
      data: offers.map(formatOffer),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/catalogue/me
 * Supplier-only: the authenticated company's own offers.
 */
async function getMyCatalogue(req, res, next) {
  try {
    const supplier = await resolveOwnedSupplier(req);

    const offers = await prisma.supplier_catalogue.findMany({
      where: { supplier_id: supplier.supplier_id },
      include: INCLUDE_RELATIONS,
      orderBy: { price_per_unit: 'asc' }
    });

    return res.status(200).json({
      success: true,
      data: offers.map(formatOffer),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/catalogue
 * Supplier-only: publishes a commercial offer for a base product.
 * Enforces UNIQUE(supplier_id, product_id) with an explicit 409 message so the
 * UI can tell the supplier to edit the existing offer instead of duplicating it.
 */
async function createOffer(req, res, next) {
  try {
    const supplier = await resolveOwnedSupplier(req);
    const { productId, pricePerUnit, minOrderQty } = req.body;

    if (!productId) {
      throw new AppError('productId is required', 400, 'VALIDATION_ERROR');
    }

    const price = parsePositiveDecimal(pricePerUnit, 'pricePerUnit');
    const moq = parsePositiveDecimal(minOrderQty, 'minOrderQty');

    const product = await prisma.products.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new AppError('Product not found in the shared catalogue', 404, 'PRODUCT_NOT_FOUND');
    }

    const duplicate = await prisma.supplier_catalogue.findUnique({
      where: {
        supplier_id_product_id: {
          supplier_id: supplier.supplier_id,
          product_id: productId
        }
      }
    });

    if (duplicate) {
      throw new AppError(
        'Your company already has an offer for this product. Update the existing offer instead.',
        409,
        'DUPLICATE_CATALOGUE_OFFER'
      );
    }

    const created = await prisma.supplier_catalogue.create({
      data: {
        catalogue_id: crypto.randomUUID(),
        supplier_id: supplier.supplier_id,
        product_id: productId,
        price_per_unit: price,
        min_order_qty: moq
      },
      include: INCLUDE_RELATIONS
    });

    return res.status(201).json({
      success: true,
      data: formatOffer(created),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/catalogue/:id
 * Supplier-only: changes price and/or MOQ on an offer the company owns.
 * Existing pools keep their own target_moq snapshot (Decision 6.2), so editing
 * an offer never rewrites the history of pools already created from it.
 */
async function updateOffer(req, res, next) {
  try {
    const supplier = await resolveOwnedSupplier(req);
    const { id } = req.params;
    const { pricePerUnit, minOrderQty } = req.body;

    const offer = await prisma.supplier_catalogue.findUnique({
      where: { catalogue_id: id },
      include: INCLUDE_RELATIONS
    });

    if (!offer) {
      throw new AppError('Catalogue offer not found', 404, 'CATALOGUE_OFFER_NOT_FOUND');
    }
    if (offer.supplier_id !== supplier.supplier_id) {
      throw new AppError('You can only edit your own catalogue offers', 403, 'FORBIDDEN');
    }

    const data = {};
    if (pricePerUnit !== undefined) data.price_per_unit = parsePositiveDecimal(pricePerUnit, 'pricePerUnit');
    if (minOrderQty !== undefined) data.min_order_qty = parsePositiveDecimal(minOrderQty, 'minOrderQty');

    if (Object.keys(data).length === 0) {
      throw new AppError('Supply pricePerUnit and/or minOrderQty', 400, 'VALIDATION_ERROR');
    }

    const updated = await prisma.supplier_catalogue.update({
      where: { catalogue_id: id },
      data,
      include: INCLUDE_RELATIONS
    });

    return res.status(200).json({
      success: true,
      data: formatOffer(updated),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/catalogue/:id
 * Supplier-only. Refused while buying pools reference the offer, because
 * buying_pools.catalogue_id uses ON DELETE RESTRICT.
 */
async function deleteOffer(req, res, next) {
  try {
    const supplier = await resolveOwnedSupplier(req);
    const { id } = req.params;

    const offer = await prisma.supplier_catalogue.findUnique({ where: { catalogue_id: id } });
    if (!offer) {
      throw new AppError('Catalogue offer not found', 404, 'CATALOGUE_OFFER_NOT_FOUND');
    }
    if (offer.supplier_id !== supplier.supplier_id) {
      throw new AppError('You can only delete your own catalogue offers', 403, 'FORBIDDEN');
    }

    const poolCount = await prisma.buying_pools.count({ where: { catalogue_id: id } });
    if (poolCount > 0) {
      throw new AppError(
        `Cannot delete offer: ${poolCount} buying pool(s) were created from it`,
        409,
        'CATALOGUE_OFFER_IN_USE'
      );
    }

    await prisma.supplier_catalogue.delete({ where: { catalogue_id: id } });

    return res.status(200).json({
      success: true,
      data: { catalogueId: id, deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCatalogue,
  getMyCatalogue,
  createOffer,
  updateOffer,
  deleteOffer,
  formatOffer
};
