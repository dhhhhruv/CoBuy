// ============================================================================
// File: src/profiles/supplierController.js
// Owner: Dhruv (Database & Auth)
// Purpose: Supplier company profile CRUD operations using Prisma ORM.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { validateCoordinates, formatPointWKT } = require('../utils/geoUtils');

/**
 * Create a new supplier company profile.
 * Viva Note: user_id is automatically linked to req.user.userId (Decision 2.1).
 */
async function createSupplier(req, res) {
  const { companyName, contactEmail, latitude, longitude } = req.body;

  if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Company name is required'
      },
      timestamp: new Date().toISOString()
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || !emailRegex.test(contactEmail.trim())) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'A valid contact email is required'
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

  const cleanName = companyName.trim();
  const cleanEmail = contactEmail.trim().toLowerCase();
  const supplierId = crypto.randomUUID();
  const pointWkt = formatPointWKT(coordCheck.lng, coordCheck.lat);

  try {
    // Check if supplier contact email is already registered
    const existing = await prisma.suppliers.findFirst({
      where: { contact_email: cleanEmail }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'Contact email is already registered to another supplier company'
        },
        timestamp: new Date().toISOString()
      });
    }

    await prisma.$executeRaw`
      INSERT INTO suppliers (supplier_id, user_id, company_name, contact_email, warehouse_coord)
      VALUES (${supplierId}, ${req.user.userId}, ${cleanName}, ${cleanEmail}, ST_GeomFromText(${pointWkt}, 4326))
    `;

    return res.status(201).json({
      success: true,
      data: {
        supplierId,
        userId: req.user.userId,
        companyName: cleanName,
        contactEmail: cleanEmail,
        warehouseLocation: {
          latitude: coordCheck.lat,
          longitude: coordCheck.lng
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Create Supplier Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create supplier profile',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get supplier profile linked to the logged-in supplier user.
 */
async function getMySupplier(req, res) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 
        supplier_id AS supplierId,
        user_id AS userId,
        company_name AS companyName,
        contact_email AS contactEmail,
        ST_X(warehouse_coord) AS longitude,
        ST_Y(warehouse_coord) AS latitude
      FROM suppliers
      WHERE user_id = ${req.user.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'No supplier company profile found for this user account'
        },
        timestamp: new Date().toISOString()
      });
    }

    const s = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        supplierId: s.supplierId,
        userId: s.userId,
        companyName: s.companyName,
        contactEmail: s.contactEmail,
        warehouseLocation: {
          latitude: Number(s.latitude),
          longitude: Number(s.longitude)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Get My Supplier Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve supplier profile'
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get public details of any supplier by ID.
 */
async function getSupplierById(req, res) {
  const { id } = req.params;

  try {
    const rows = await prisma.$queryRaw`
      SELECT 
        supplier_id AS supplierId,
        company_name AS companyName,
        contact_email AS contactEmail,
        ST_X(warehouse_coord) AS longitude,
        ST_Y(warehouse_coord) AS latitude
      FROM suppliers
      WHERE supplier_id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUPPLIER_NOT_FOUND',
          message: `Supplier with ID '${id}' was not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    const s = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        supplierId: s.supplierId,
        companyName: s.companyName,
        contactEmail: s.contactEmail,
        warehouseLocation: {
          latitude: Number(s.latitude),
          longitude: Number(s.longitude)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Get Supplier By ID Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve supplier profile'
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  createSupplier,
  getMySupplier,
  getSupplierById
};

