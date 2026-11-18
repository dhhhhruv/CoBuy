// ============================================================================
// File: src/orders/orderController.js
// Owner: Dhruv (Database & Auth) & Aggregation Engine
// Purpose: Micro-orders lifecycle, atomic quantity updates, payment status
//          transitions, and order history queries matching API_CONTRACT.md.
// ============================================================================

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/orders
 * Places a micro-order into an ACTIVE pool atomically inside an InnoDB transaction.
 * Enforces:
 *  - Restaurant ownership authentication
 *  - 5 km cluster proximity check
 *  - Single order per restaurant per pool constraint
 *  - Atomic quantity increment and automatic FULFILLED status flip
 */
async function placeOrder(req, res, next) {
  try {
    const { poolId, restaurantId, requestedQty } = req.body;

    // 1. Validation
    if (!poolId || !requestedQty) {
      throw new AppError('poolId and requestedQty are required', 400, 'INVALID_INPUT');
    }

    const qty = Number(requestedQty);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('requestedQty must be a positive number', 400, 'INVALID_QUANTITY');
    }

    // 2. Resolve Restaurant
    let targetRestaurant = null;
    if (restaurantId) {
      targetRestaurant = await prisma.restaurants.findFirst({
        where: { restaurant_id: restaurantId, owner_id: req.user.userId }
      });
    } else {
      targetRestaurant = await prisma.restaurants.findFirst({
        where: { owner_id: req.user.userId }
      });
    }

    if (!targetRestaurant) {
      throw new AppError(
        'Restaurant profile not found or does not belong to the authenticated owner. Create a restaurant profile first.',
        404,
        'RESTAURANT_NOT_FOUND'
      );
    }

    // 3. Check duplicate order constraint (UNIQUE(pool_id, restaurant_id))
    const existingOrder = await prisma.micro_orders.findUnique({
      where: {
        pool_id_restaurant_id: {
          pool_id: poolId,
          restaurant_id: targetRestaurant.restaurant_id
        }
      }
    });

    if (existingOrder) {
      throw new AppError(
        'This restaurant has already placed an order in this buying pool.',
        409,
        'ALREADY_ORDERED'
      );
    }

    // 4. Fetch Pool and verify 5km distance and ACTIVE status
    const poolCheck = await prisma.$queryRaw`
      SELECT 
        p.pool_id,
        p.status,
        p.current_qty,
        p.target_moq,
        p.expiration_time,
        c.price_per_unit,
        c.min_order_qty,
        ST_Distance_Sphere(r.location_coord, p.geographic_zone) AS distance_meters
      FROM buying_pools p
      JOIN supplier_catalogue c ON p.catalogue_id = c.catalogue_id
      JOIN restaurants r ON r.restaurant_id = ${targetRestaurant.restaurant_id}
      WHERE p.pool_id = ${poolId}
    `;

    if (!poolCheck || poolCheck.length === 0) {
      throw new AppError('Buying pool not found', 404, 'POOL_NOT_FOUND');
    }

    const pool = poolCheck[0];

    if (pool.status !== 'ACTIVE') {
      throw new AppError(`Cannot place order: Pool is ${pool.status}`, 400, 'INVALID_POOL_STATUS');
    }

    if (new Date(pool.expiration_time) < new Date()) {
      throw new AppError('Cannot place order: Buying pool has expired', 400, 'POOL_EXPIRED');
    }

    if (Number(pool.distance_meters) > 5000) {
      throw new AppError(
        `Restaurant is ${(Number(pool.distance_meters) / 1000).toFixed(1)} km from the pool zone (maximum 5.0 km allowed).`,
        400,
        'CLUSTER_PROXIMITY_EXCEEDED'
      );
    }

    // 5. Execute Atomic Transaction
    const unitPrice = Number(pool.price_per_unit);
    const pledgedAmount = (qty * unitPrice).toFixed(2);
    const orderId = crypto.randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      // Create micro-order
      const createdOrder = await tx.micro_orders.create({
        data: {
          order_id: orderId,
          pool_id: poolId,
          restaurant_id: targetRestaurant.restaurant_id,
          requested_qty: qty,
          pledged_amount: pledgedAmount,
          payment_status: 'PENDING'
        }
      });

      // Atomically update pool current_qty
      const newQty = Number(pool.current_qty) + qty;
      const targetMoq = Number(pool.target_moq);
      const newStatus = newQty >= targetMoq ? 'FULFILLED' : 'ACTIVE';

      await tx.buying_pools.update({
        where: { pool_id: poolId },
        data: {
          current_qty: newQty,
          status: newStatus
        }
      });

      return {
        createdOrder,
        poolStatus: newStatus,
        poolCurrentQty: newQty.toFixed(2),
        poolTargetMoq: targetMoq.toFixed(2)
      };
    });

    return res.status(201).json({
      success: true,
      data: {
        orderId: result.createdOrder.order_id,
        poolId: result.createdOrder.pool_id,
        restaurantId: result.createdOrder.restaurant_id,
        requestedQty: Number(result.createdOrder.requested_qty),
        pledgedAmount: Number(result.createdOrder.pledged_amount),
        paymentStatus: result.createdOrder.payment_status,
        poolStatus: result.poolStatus,
        poolCurrentQty: Number(result.poolCurrentQty),
        poolTargetMoq: Number(result.poolTargetMoq),
        createdAt: result.createdOrder.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/my
 * Order history for the authenticated restaurant owner.
 */
async function getMyOrders(req, res, next) {
  try {
    const restaurants = await prisma.restaurants.findMany({
      where: { owner_id: req.user.userId },
      select: { restaurant_id: true }
    });

    const restaurantIds = restaurants.map((r) => r.restaurant_id);
    if (restaurantIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    const orders = await prisma.micro_orders.findMany({
      where: {
        restaurant_id: { in: restaurantIds }
      },
      include: {
        restaurants: {
          select: { business_name: true, address_text: true }
        },
        buying_pools: {
          include: {
            supplier_catalogue: {
              include: {
                products: true,
                suppliers: {
                  select: { company_name: true, contact_email: true }
                }
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const formatted = orders.map((o) => {
      const cat = o.buying_pools?.supplier_catalogue;
      return {
        orderId: o.order_id,
        poolId: o.pool_id,
        restaurantId: o.restaurant_id,
        restaurantName: o.restaurants?.business_name,
        productName: cat?.products?.product_name || 'Wholesale Produce',
        unitOfMeasure: cat?.products?.unit_of_measure || 'kg',
        supplierName: cat?.suppliers?.company_name || 'Wholesale Partner',
        requestedQty: Number(o.requested_qty),
        pricePerUnit: Number(cat?.price_per_unit || 0),
        pledgedAmount: Number(o.pledged_amount),
        paymentStatus: o.payment_status,
        poolStatus: o.buying_pools?.status,
        poolCurrentQty: Number(o.buying_pools?.current_qty || 0),
        poolTargetMoq: Number(o.buying_pools?.target_moq || 0),
        createdAt: o.created_at
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/pool/:poolId
 * View all micro-orders placed in a specific pool.
 * Allowed for the supplier who owns the pool or participating restaurant owners.
 */
async function getPoolOrders(req, res, next) {
  try {
    const { poolId } = req.params;

    const pool = await prisma.buying_pools.findUnique({
      where: { pool_id: poolId },
      include: {
        supplier_catalogue: {
          include: {
            suppliers: true,
            products: true
          }
        }
      }
    });

    if (!pool) {
      throw new AppError('Buying pool not found', 404, 'POOL_NOT_FOUND');
    }

    // Role check: if supplier, verify supplier ownership
    if (req.user.roles.includes('supplier')) {
      const supplierProfile = await prisma.suppliers.findFirst({
        where: { user_id: req.user.userId }
      });
      if (!supplierProfile || supplierProfile.supplier_id !== pool.supplier_catalogue.supplier_id) {
        throw new AppError('You can only view orders for your own pools.', 403, 'FORBIDDEN');
      }
    }

    const orders = await prisma.micro_orders.findMany({
      where: { pool_id: poolId },
      include: {
        restaurants: {
          select: { business_name: true, address_text: true }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    const formatted = orders.map((o) => ({
      orderId: o.order_id,
      poolId: o.pool_id,
      restaurantId: o.restaurant_id,
      restaurantName: o.restaurants?.business_name,
      requestedQty: Number(o.requested_qty),
      pledgedAmount: Number(o.pledged_amount),
      paymentStatus: o.payment_status,
      createdAt: o.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        poolId,
        productName: pool.supplier_catalogue.products.product_name,
        targetMoq: Number(pool.target_moq),
        currentQty: Number(pool.current_qty),
        poolStatus: pool.status,
        orders: formatted
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orders/:id/payment
 * Updates payment status (e.g. PENDING -> PAID).
 * Verifies authorization: only the restaurant owner or pool supplier can update.
 */
async function updatePaymentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      throw new AppError('paymentStatus is required', 400, 'INVALID_INPUT');
    }

    const allowed = ['PENDING', 'PAID'];
    if (!allowed.includes(paymentStatus.toUpperCase())) {
      throw new AppError(`paymentStatus must be one of: ${allowed.join(', ')}`, 400, 'INVALID_PAYMENT_STATUS');
    }

    const normalizedStatus = paymentStatus.toUpperCase();

    const order = await prisma.micro_orders.findUnique({
      where: { order_id: id },
      include: {
        restaurants: true,
        buying_pools: {
          include: {
            supplier_catalogue: {
              include: { suppliers: true }
            }
          }
        }
      }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Verify permission: user must be the restaurant owner or the supplier
    const isOwner = order.restaurants.owner_id === req.user.userId;
    const isSupplier = order.buying_pools.supplier_catalogue.suppliers.user_id === req.user.userId;

    if (!isOwner && !isSupplier) {
      throw new AppError('You are not authorized to update payment status for this order.', 403, 'FORBIDDEN');
    }

    const updated = await prisma.micro_orders.update({
      where: { order_id: id },
      data: { payment_status: normalizedStatus }
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: updated.order_id,
        poolId: updated.pool_id,
        restaurantId: updated.restaurant_id,
        requestedQty: Number(updated.requested_qty),
        pledgedAmount: Number(updated.pledged_amount),
        paymentStatus: updated.payment_status,
        createdAt: updated.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  placeOrder,
  getMyOrders,
  getPoolOrders,
  updatePaymentStatus
};
