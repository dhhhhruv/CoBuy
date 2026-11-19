// ============================================================================
// File: src/profiles/restaurantController.js
// Owner: Dhruv (Database & Auth)
// Purpose: Restaurant profile CRUD operations using Prisma ORM.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { validateCoordinates, formatPointWKT } = require('../utils/geoUtils');

/**
 * Create a new restaurant profile.
 * Viva Note: owner_id comes strictly from req.user.userId (from JWT),
 * NEVER from req.body, preventing identity spoofing.
 */
async function createRestaurant(req, res) {
  const { businessName, latitude, longitude, walletBalance = 0.00, addressText } = req.body;

  if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Business name is required'
      },
      timestamp: new Date().toISOString()
    });
  }

  const coordCheck = validateCoordinates(latitude, longitude);
  if (!coordCheck.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_COORDINATES',
        message: coordCheck.error
      },
      timestamp: new Date().toISOString()
    });
  }

  const cleanName = businessName.trim();
  const balance = parseFloat(walletBalance) || 0.00;
  const address = addressText ? addressText.trim() : null;
  const restaurantId = crypto.randomUUID();
  const pointWkt = formatPointWKT(coordCheck.lng, coordCheck.lat);

  try {
    // Viva Note: Since Prisma marks MySQL POINT as Unsupported,
    // we use prisma.$executeRaw with tagged templates (SQL injection safe)
    // to insert the spatial POINT with SRID 4326.
    await prisma.$executeRaw`
      INSERT INTO restaurants (restaurant_id, owner_id, business_name, location_coord, wallet_balance, address_text)
      VALUES (${restaurantId}, ${req.user.userId}, ${cleanName}, ST_GeomFromText(${pointWkt}, 4326), ${balance}, ${address})
    `;

    return res.status(201).json({
      success: true,
      data: {
        restaurantId,
        ownerId: req.user.userId,
        businessName: cleanName,
        location: {
          latitude: coordCheck.lat,
          longitude: coordCheck.lng
        },
        walletBalance: balance.toFixed(2),
        addressText: address
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Create Restaurant Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create restaurant profile',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get all restaurants owned by the currently authenticated user.
 */
async function getMyRestaurants(req, res) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 
        restaurant_id AS restaurantId,
        owner_id AS ownerId,
        business_name AS businessName,
        ST_X(location_coord) AS longitude,
        ST_Y(location_coord) AS latitude,
        wallet_balance AS walletBalance,
        address_text AS addressText
      FROM restaurants
      WHERE owner_id = ${req.user.userId}
    `;

    const formatted = rows.map(r => ({
      restaurantId: r.restaurantId,
      ownerId: r.ownerId,
      businessName: r.businessName,
      location: {
        latitude: Number(r.latitude),
        longitude: Number(r.longitude)
      },
      walletBalance: Number(r.walletBalance).toFixed(2),
      addressText: r.addressText
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Get My Restaurants Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve restaurant profiles'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get a specific restaurant by ID.
 */
async function getRestaurantById(req, res) {
  const { id } = req.params;

  try {
    const rows = await prisma.$queryRaw`
      SELECT 
        restaurant_id AS restaurantId,
        owner_id AS ownerId,
        business_name AS businessName,
        ST_X(location_coord) AS longitude,
        ST_Y(location_coord) AS latitude,
        wallet_balance AS walletBalance,
        address_text AS addressText
      FROM restaurants
      WHERE restaurant_id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: `Restaurant with ID '${id}' was not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    const r = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        restaurantId: r.restaurantId,
        ownerId: r.ownerId,
        businessName: r.businessName,
        location: {
          latitude: Number(r.latitude),
          longitude: Number(r.longitude)
        },
        walletBalance: Number(r.walletBalance).toFixed(2),
        addressText: r.addressText
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Get Restaurant By ID Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve restaurant profile'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * PATCH /api/restaurants/:id
 * Owner-only partial update. Scalar fields go through Prisma; the POINT column
 * is rewritten with ST_GeomFromText so SRID 4326 is preserved.
 */
async function updateRestaurant(req, res, next) {
  const { id } = req.params;
  const { businessName, addressText, walletBalance, latitude, longitude } = req.body;

  try {
    const existing = await prisma.restaurants.findUnique({ where: { restaurant_id: id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESTAURANT_NOT_FOUND', message: `Restaurant with ID '${id}' was not found` },
        timestamp: new Date().toISOString()
      });
    }

    // Authorization: ownership comes from the JWT, never from the body.
    if (existing.owner_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only edit your own kitchen profile.' },
        timestamp: new Date().toISOString()
      });
    }

    const data = {};

    if (businessName !== undefined) {
      if (typeof businessName !== 'string' || businessName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Business name cannot be empty' },
          timestamp: new Date().toISOString()
        });
      }
      data.business_name = businessName.trim();
    }

    if (addressText !== undefined) {
      data.address_text = addressText === null ? null : String(addressText).trim();
    }

    if (walletBalance !== undefined) {
      const balance = Number(walletBalance);
      if (!Number.isFinite(balance) || balance < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'walletBalance must be zero or greater' },
          timestamp: new Date().toISOString()
        });
      }
      data.wallet_balance = balance;
    }

    const hasLat = latitude !== undefined;
    const hasLng = longitude !== undefined;
    if (hasLat !== hasLng) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Supply both latitude and longitude, or neither.' },
        timestamp: new Date().toISOString()
      });
    }
    let coords = null;
    if (hasLat && hasLng) {
      const coordCheck = validateCoordinates(latitude, longitude);
      if (!coordCheck.valid) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_COORDINATES', message: coordCheck.error },
          timestamp: new Date().toISOString()
        });
      }
      coords = coordCheck;
    }

    if (Object.keys(data).length === 0 && !coords) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No updatable fields supplied' },
        timestamp: new Date().toISOString()
      });
    }

    if (Object.keys(data).length > 0) {
      await prisma.restaurants.update({ where: { restaurant_id: id }, data });
    }

    if (coords) {
      const pointWkt = formatPointWKT(coords.lng, coords.lat);
      await prisma.$executeRaw`
        UPDATE restaurants
        SET location_coord = ST_GeomFromText(${pointWkt}, 4326)
        WHERE restaurant_id = ${id}
      `;
    }

    // Re-read through the spatial projection so the response matches GET /me.
    const rows = await prisma.$queryRaw`
      SELECT
        restaurant_id AS restaurantId,
        owner_id AS ownerId,
        business_name AS businessName,
        ST_X(location_coord) AS longitude,
        ST_Y(location_coord) AS latitude,
        wallet_balance AS walletBalance,
        address_text AS addressText
      FROM restaurants
      WHERE restaurant_id = ${id}
      LIMIT 1
    `;
    const r = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        restaurantId: r.restaurantId,
        ownerId: r.ownerId,
        businessName: r.businessName,
        location: { latitude: Number(r.latitude), longitude: Number(r.longitude) },
        walletBalance: Number(r.walletBalance).toFixed(2),
        addressText: r.addressText
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/restaurants/:id
 * Owner-only. Refused with 409 while micro-orders still reference the kitchen
 * (fk_orders_restaurant is ON DELETE RESTRICT).
 */
async function deleteRestaurant(req, res, next) {
  const { id } = req.params;

  try {
    const existing = await prisma.restaurants.findUnique({ where: { restaurant_id: id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESTAURANT_NOT_FOUND', message: `Restaurant with ID '${id}' was not found` },
        timestamp: new Date().toISOString()
      });
    }
    if (existing.owner_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only delete your own kitchen profile.' },
        timestamp: new Date().toISOString()
      });
    }

    const orderCount = await prisma.micro_orders.count({ where: { restaurant_id: id } });
    if (orderCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RESTAURANT_IN_USE',
          message: `Cannot delete profile: ${orderCount} micro-order(s) reference this kitchen.`
        },
        timestamp: new Date().toISOString()
      });
    }

    await prisma.restaurants.delete({ where: { restaurant_id: id } });

    return res.status(200).json({
      success: true,
      data: { restaurantId: id, deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error && error.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: { code: 'RESTAURANT_IN_USE', message: 'This kitchen profile is still referenced by micro-orders.' },
        timestamp: new Date().toISOString()
      });
    }
    return next(error);
  }
}

module.exports = {
  createRestaurant,
  getMyRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant
};

