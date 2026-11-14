// ============================================================================
// File: src/pools/discoveryController.js
// Owner: Dhruv (Database & Auth)
// Purpose: 5 km radius buying pool discovery query using MySQL ST_Distance_Sphere.
// ============================================================================

const prisma = require('../db/prisma');
const { validateCoordinates, formatPointWKT } = require('../utils/geoUtils');

/**
 * Discovers active buying pools within a specified radius (default 5,000 metres)
 * of a given restaurant location or coordinate pair.
 * Viva Note:
 * - Uses MySQL native ST_Distance_Sphere to compute spherical geodesic distance in metres.
 * - Filters for status = 'ACTIVE' and expiration_time > NOW().
 * - Calculates progress percentage: (current_qty / target_moq) * 100.
 */
async function discoverNearbyPools(req, res) {
  const { restaurantId, latitude, longitude, radius = 5000, status = 'ACTIVE' } = req.query;

  const maxRadiusMeters = parseFloat(radius) || 5000.0;
  const targetStatus = typeof status === 'string' ? status.toUpperCase() : 'ACTIVE';

  try {
    let pools = [];

    // Mode 1: Discovery based on an existing restaurant ID
    if (restaurantId) {
      pools = await prisma.$queryRaw`
        SELECT 
          bp.pool_id AS poolId,
          bp.status,
          bp.current_qty AS currentQty,
          bp.target_moq AS targetMoq,
          bp.expiration_time AS expirationTime,
          ST_X(bp.geographic_zone) AS poolLongitude,
          ST_Y(bp.geographic_zone) AS poolLatitude,
          ROUND(ST_Distance_Sphere(r.location_coord, bp.geographic_zone), 1) AS distanceMeters,
          p.product_id AS productId,
          p.product_name AS productName,
          p.unit_of_measure AS unitOfMeasure,
          p.category,
          s.supplier_id AS supplierId,
          s.company_name AS companyName,
          sc.catalogue_id AS catalogueId,
          sc.price_per_unit AS pricePerUnit,
          sc.min_order_qty AS minOrderQty
        FROM buying_pools bp
        JOIN supplier_catalogue sc ON bp.catalogue_id = sc.catalogue_id
        JOIN products p ON sc.product_id = p.product_id
        JOIN suppliers s ON sc.supplier_id = s.supplier_id
        JOIN restaurants r ON r.restaurant_id = ${restaurantId}
        WHERE bp.status = ${targetStatus}
          AND bp.expiration_time > NOW()
          AND ST_Distance_Sphere(r.location_coord, bp.geographic_zone) <= ${maxRadiusMeters}
        ORDER BY distanceMeters ASC
      `;
    } 
    // Mode 2: Discovery based on arbitrary GPS coordinates
    else if (latitude !== undefined && longitude !== undefined) {
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

      const pointWkt = formatPointWKT(coordCheck.lng, coordCheck.lat);

      pools = await prisma.$queryRaw`
        SELECT 
          bp.pool_id AS poolId,
          bp.status,
          bp.current_qty AS currentQty,
          bp.target_moq AS targetMoq,
          bp.expiration_time AS expirationTime,
          ST_X(bp.geographic_zone) AS poolLongitude,
          ST_Y(bp.geographic_zone) AS poolLatitude,
          ROUND(ST_Distance_Sphere(ST_GeomFromText(${pointWkt}, 4326), bp.geographic_zone), 1) AS distanceMeters,
          p.product_id AS productId,
          p.product_name AS productName,
          p.unit_of_measure AS unitOfMeasure,
          p.category,
          s.supplier_id AS supplierId,
          s.company_name AS companyName,
          sc.catalogue_id AS catalogueId,
          sc.price_per_unit AS pricePerUnit,
          sc.min_order_qty AS minOrderQty
        FROM buying_pools bp
        JOIN supplier_catalogue sc ON bp.catalogue_id = sc.catalogue_id
        JOIN products p ON sc.product_id = p.product_id
        JOIN suppliers s ON sc.supplier_id = s.supplier_id
        WHERE bp.status = ${targetStatus}
          AND bp.expiration_time > NOW()
          AND ST_Distance_Sphere(ST_GeomFromText(${pointWkt}, 4326), bp.geographic_zone) <= ${maxRadiusMeters}
        ORDER BY distanceMeters ASC
      `;
    } 
    // Mode 3: If no coordinates or restaurantId provided, check if user is a logged-in restaurant owner
    else if (req.user && req.user.userId) {
      const userRestaurants = await prisma.restaurants.findMany({
        where: { owner_id: req.user.userId },
        select: { restaurant_id: true }
      });

      if (userRestaurants.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RESTAURANT_REQUIRED',
            message: 'No restaurant profile found for current user. Please provide restaurantId or latitude/longitude coordinates.'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Discover for user's primary restaurant
      const defaultRestaurantId = userRestaurants[0].restaurant_id;
      pools = await prisma.$queryRaw`
        SELECT 
          bp.pool_id AS poolId,
          bp.status,
          bp.current_qty AS currentQty,
          bp.target_moq AS targetMoq,
          bp.expiration_time AS expirationTime,
          ST_X(bp.geographic_zone) AS poolLongitude,
          ST_Y(bp.geographic_zone) AS poolLatitude,
          ROUND(ST_Distance_Sphere(r.location_coord, bp.geographic_zone), 1) AS distanceMeters,
          p.product_id AS productId,
          p.product_name AS productName,
          p.unit_of_measure AS unitOfMeasure,
          p.category,
          s.supplier_id AS supplierId,
          s.company_name AS companyName,
          sc.catalogue_id AS catalogueId,
          sc.price_per_unit AS pricePerUnit,
          sc.min_order_qty AS minOrderQty
        FROM buying_pools bp
        JOIN supplier_catalogue sc ON bp.catalogue_id = sc.catalogue_id
        JOIN products p ON sc.product_id = p.product_id
        JOIN suppliers s ON sc.supplier_id = s.supplier_id
        JOIN restaurants r ON r.restaurant_id = ${defaultRestaurantId}
        WHERE bp.status = ${targetStatus}
          AND bp.expiration_time > NOW()
          AND ST_Distance_Sphere(r.location_coord, bp.geographic_zone) <= ${maxRadiusMeters}
        ORDER BY distanceMeters ASC
      `;
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Please provide either restaurantId or both latitude and longitude query parameters'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Format results to adhere strictly to API_CONTRACT.md
    const formatted = pools.map(row => {
      const currentQty = Number(row.currentQty);
      const targetMoq = Number(row.targetMoq);
      const progress = targetMoq > 0 ? (currentQty / targetMoq) * 100 : 0;

      return {
        poolId: row.poolId,
        status: row.status,
        product: {
          productId: row.productId,
          productName: row.productName,
          unitOfMeasure: row.unitOfMeasure,
          category: row.category
        },
        supplier: {
          supplierId: row.supplierId,
          companyName: row.companyName
        },
        pricePerUnit: Number(row.pricePerUnit),
        targetMoq,
        currentQty,
        progressPercentage: Number(progress.toFixed(1)),
        expirationTime: row.expirationTime ? row.expirationTime.toISOString() : null,
        distanceMeters: Number(row.distanceMeters),
        isEligible: Number(row.distanceMeters) <= maxRadiusMeters
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted,
      meta: {
        totalPoolsFound: formatted.length,
        searchRadiusMeters: maxRadiusMeters
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Pool Discovery Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while discovering nearby pools',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  discoverNearbyPools
};

