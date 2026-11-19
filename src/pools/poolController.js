// ============================================================================
// File: src/pools/poolController.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Buying-pool creation, listing and detail endpoints.
//
// Viva Note: A pool points at a supplier_catalogue row, not at a product.
// That single FK is what gives the pool its supplier, product, unit price and
// MOQ; target_moq is copied from min_order_qty at creation time as a snapshot
// so later catalogue edits cannot rewrite an existing pool's target.
// ============================================================================

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');
const { AppError } = require('../middleware/errorHandler');
const { validateCoordinates, formatPointWKT } = require('../utils/geoUtils');
const lifecycle = require('./poolLifecycle');
const discoveryController = require('./discoveryController');

const DEFAULT_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 90;

function formatPoolRow(row) {
  const currentQty = Number(row.current_qty);
  const targetMoq = Number(row.target_moq);
  return {
    poolId: row.pool_id,
    status: row.status,
    product: {
      productId: row.supplier_catalogue.products.product_id,
      productName: row.supplier_catalogue.products.product_name,
      unitOfMeasure: row.supplier_catalogue.products.unit_of_measure,
      category: row.supplier_catalogue.products.category
    },
    supplier: {
      supplierId: row.supplier_catalogue.suppliers.supplier_id,
      companyName: row.supplier_catalogue.suppliers.company_name
    },
    catalogueId: row.catalogue_id,
    pricePerUnit: Number(row.supplier_catalogue.price_per_unit),
    targetMoq,
    currentQty,
    progressPercentage: lifecycle.progressPercentage(currentQty, targetMoq),
    expirationTime: row.expiration_epoch
      ? new Date(Number(row.expiration_epoch) * 1000).toISOString()
      : (row.expiration_time ? new Date(row.expiration_time).toISOString() : null),
    distanceMeters: row.distance_meters !== undefined && row.distance_meters !== null
      ? Number(row.distance_meters)
      : null,
    isEligible: row.distance_meters !== undefined && row.distance_meters !== null
      ? Number(row.distance_meters) <= 5000
      : true
  };
}

async function attachExpirationEpochs(pools) {
  if (!pools || pools.length === 0) return;

  const ids = pools.map((p) => p.pool_id);
  const rows = await prisma.$queryRaw`
    SELECT pool_id, UNIX_TIMESTAMP(expiration_time) AS expiration_epoch
    FROM buying_pools
    WHERE pool_id IN (${Prisma.join(ids)})
  `;

  const epochs = new Map(rows.map((r) => [r.pool_id, r.expiration_epoch]));
  for (const pool of pools) {
    pool.expiration_epoch = epochs.get(pool.pool_id);
  }
}

const POOL_INCLUDE = {
  supplier_catalogue: {
    include: {
      products: true,
      suppliers: { select: { supplier_id: true, company_name: true, contact_email: true } }
    }
  }
};

/**
 * POST /api/pools
 * Supplier-only. Opens a new pool for one of the company's catalogue offers.
 *
 * Request: { catalogueId, latitude, longitude, durationDays? , expirationTime? }
 */
async function createPool(req, res, next) {
  try {
    const { catalogueId, latitude, longitude, durationDays, expirationTime } = req.body;

    if (!catalogueId) {
      throw new AppError('catalogueId is required', 400, 'VALIDATION_ERROR');
    }

    const coordCheck = validateCoordinates(latitude, longitude);
    if (!coordCheck.valid) {
      throw new AppError(coordCheck.error, 400, 'INVALID_COORDINATES');
    }

    // Expiry: explicit timestamp wins, otherwise a bounded day duration.
    let expiresAt;
    if (expirationTime) {
      expiresAt = new Date(expirationTime);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new AppError('expirationTime must be a valid ISO timestamp', 400, 'VALIDATION_ERROR');
      }
    } else {
      const days = durationDays === undefined ? DEFAULT_DURATION_DAYS : Number(durationDays);
      if (!Number.isFinite(days) || days <= 0 || days > MAX_DURATION_DAYS) {
        throw new AppError(
          `durationDays must be between 1 and ${MAX_DURATION_DAYS}`,
          400,
          'VALIDATION_ERROR'
        );
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new AppError('A pool cannot be created with a past expiry time', 400, 'VALIDATION_ERROR');
    }

    const supplier = await prisma.suppliers.findFirst({ where: { user_id: req.user.userId } });
    if (!supplier) {
      throw new AppError(
        'No supplier profile is linked to this account. Create a supplier profile first.',
        404,
        'SUPPLIER_PROFILE_REQUIRED'
      );
    }

    const offer = await prisma.supplier_catalogue.findUnique({
      where: { catalogue_id: catalogueId },
      include: { products: true }
    });

    if (!offer) {
      throw new AppError('Catalogue offer not found', 404, 'CATALOGUE_OFFER_NOT_FOUND');
    }
    if (offer.supplier_id !== supplier.supplier_id) {
      throw new AppError('You can only create pools from your own catalogue offers', 403, 'FORBIDDEN');
    }

    const poolId = crypto.randomUUID();
    const pointWkt = formatPointWKT(coordCheck.lng, coordCheck.lat);

    // FROM_UNIXTIME keeps the stored instant exact regardless of the MySQL
    // session timezone (a raw Date parameter would be reinterpreted locally).
    const expiresAtEpoch = Math.floor(expiresAt.getTime() / 1000);

    await prisma.$executeRaw`
      INSERT INTO buying_pools (pool_id, catalogue_id, geographic_zone, status, current_qty, target_moq, expiration_time)
      VALUES (${poolId}, ${catalogueId}, ST_GeomFromText(${pointWkt}, 4326), 'ACTIVE', 0.00, ${offer.min_order_qty}, FROM_UNIXTIME(${expiresAtEpoch}))
    `;

    return res.status(201).json({
      success: true,
      data: {
        poolId,
        catalogueId,
        status: lifecycle.POOL_STATUSES.ACTIVE,
        product: {
          productId: offer.products.product_id,
          productName: offer.products.product_name,
          unitOfMeasure: offer.products.unit_of_measure
        },
        supplier: {
          supplierId: supplier.supplier_id,
          companyName: supplier.company_name
        },
        pricePerUnit: Number(offer.price_per_unit),
        // Snapshot, not a live read: later catalogue edits do not change this pool.
        targetMoq: Number(offer.min_order_qty),
        currentQty: 0,
        progressPercentage: 0,
        geographicZone: { latitude: coordCheck.lat, longitude: coordCheck.lng },
        expirationTime: expiresAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/pools
 * Public listing with optional filters: status, supplierId, catalogueId.
 * When restaurantId or latitude+longitude are supplied, distance becomes part
 * of the response and the 5 km rule applies (delegated to discovery).
 */
async function listPools(req, res, next) {
  try {
    const hasLocation =
      req.query.restaurantId !== undefined ||
      (req.query.latitude !== undefined && req.query.longitude !== undefined) ||
      (req.query.lat !== undefined && req.query.lng !== undefined);

    if (hasLocation) {
      return discoveryController.discoverNearbyPools(req, res);
    }

    // Expiry policy: sweep stale ACTIVE pools before reading them.
    await lifecycle.expireStalePools(prisma);

    const { status, supplierId, catalogueId } = req.query;
    const where = {};

    if (status) {
      const normalized = String(status).toUpperCase();
      if (!lifecycle.POOL_STATUS_VALUES.includes(normalized)) {
        throw new AppError(
          `status must be one of: ${lifecycle.POOL_STATUS_VALUES.join(', ')}`,
          400,
          'INVALID_STATUS'
        );
      }
      where.status = normalized;
    }
    if (catalogueId) where.catalogue_id = catalogueId;
    if (supplierId) {
      where.supplier_catalogue = { supplier_id: supplierId };
    }

    const pools = await prisma.buying_pools.findMany({
      where,
      include: POOL_INCLUDE,
      orderBy: { expiration_time: 'asc' }
    });

    await attachExpirationEpochs(pools);

    return res.status(200).json({
      success: true,
      data: pools.map(formatPoolRow),
      meta: { totalPoolsFound: pools.length },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/pools/:id
 * Full pool detail plus the micro-orders that make up its running total.
 */
async function getPoolById(req, res, next) {
  try {
    const { id } = req.params;

    await lifecycle.expireStalePools(prisma);

    const pool = await prisma.buying_pools.findUnique({
      where: { pool_id: id },
      include: {
        ...POOL_INCLUDE,
        micro_orders: {
          include: {
            restaurants: { select: { restaurant_id: true, business_name: true } }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!pool) {
      throw new AppError('Buying pool not found', 404, 'POOL_NOT_FOUND');
    }

    await attachExpirationEpochs([pool]);

    const orders = pool.micro_orders.map((o) => ({
      orderId: o.order_id,
      restaurantId: o.restaurant_id,
      restaurantName: o.restaurants ? o.restaurants.business_name : undefined,
      requestedQty: Number(o.requested_qty),
      pledgedAmount: Number(o.pledged_amount),
      paymentStatus: o.payment_status,
      createdAt: o.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...formatPoolRow(pool),
        supplierContactEmail: pool.supplier_catalogue.suppliers.contact_email,
        participantCount: orders.length,
        orders
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createPool,
  listPools,
  getPoolById,
  formatPoolRow
};
