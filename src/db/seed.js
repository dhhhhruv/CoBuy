// ============================================================================
// File: src/db/seed.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Reproducible demo data for the CoBuy tomato walkthrough.
// Run via: npm run db:seed
//
// Viva Note on reproducibility:
// - Demo accounts use a `demo_` prefix so the seed never collides with ad-hoc
//   test users created by the test suites.
// - Every demo row has a fixed UUID plus an idempotent create-or-update path,
//   so running the seed twice produces identical data, not duplicates.
// - buying_pools.current_qty is never invented: it is recomputed from the sum
//   of the pool's micro-orders, exactly as the aggregation engine maintains it.
// ============================================================================

const crypto = require('crypto');
const dotenv = require('dotenv');
const prisma = require('./prisma');
const { hashPassword } = require('../auth/authUtils');
const lifecycle = require('../pools/poolLifecycle');

dotenv.config();

const DEMO_PASSWORD = 'Password123!';

const IDS = {
  kitchenAUser: '11111111-1111-4111-8111-111111111111',
  kitchenBUser: '22222222-2222-4222-8222-222222222222',
  kitchenCUser: '33333333-3333-4333-8333-333333333333',
  supplierFreshUser: '44444444-4444-4444-8444-444444444444',
  supplierGreenUser: '55555555-5555-4555-8555-555555555555',
  kitchenA: 'a1111111-1111-4111-8111-111111111111',
  kitchenB: 'a2222222-2222-4222-8222-222222222222',
  kitchenC: 'a3333333-3333-4333-8333-333333333333',
  supplierFresh: 'b1111111-1111-4111-8111-111111111111',
  supplierGreen: 'b2222222-2222-4222-8222-222222222222',
  tomatoPool: 'e1111111-1111-4111-8111-111111111111',
  onionPool: 'e2222222-2222-4222-8222-222222222222',
  greenTomatoPool: 'e3333333-3333-4333-8333-333333333333',
  oilPool: 'e4444444-4444-4444-8444-444444444444',
  orderA: 'f1111111-1111-4111-8111-111111111111',
  orderB: 'f2222222-2222-4222-8222-222222222222',
  orderC: 'f3333333-3333-4333-8333-333333333333'
};

/**
 * Bangalore coordinates used by the demo:
 *   Indiranagar  12.9716, 77.5946  (Kitchen A, Green Basket)
 *   Koramangala  12.9352, 77.6245  (Kitchen B, tomato pool zone ~4.5 km away)
 *   Domlur       12.9600, 77.6300  (Fresh Foods ~2.5 km away)
 *   HSR Layout   12.9121, 77.6446  (Kitchen C)
 */
const POINTS = {
  indiranagar: { lat: 12.9716, lng: 77.5946 },
  koramangala: { lat: 12.9352, lng: 77.6245 },
  domlur: { lat: 12.9600, lng: 77.6300 },
  hsr: { lat: 12.9121, lng: 77.6446 }
};

function point(location) {
  return `POINT(${location.lng} ${location.lat})`;
}

async function seedUser({ userId, username, email, roles }) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.users.upsert({
    where: { user_id: userId },
    update: { password_hash: passwordHash },
    create: { user_id: userId, username, email, password_hash: passwordHash }
  });

  for (const role of roles) {
    await prisma.user_roles.upsert({
      where: { user_id_role_name: { user_id: userId, role_name: role } },
      update: {},
      create: { user_id: userId, role_name: role }
    });
  }
  return userId;
}

async function seedRestaurant({ id, ownerId, name, location, wallet, address }) {
  const existing = await prisma.restaurants.findUnique({ where: { restaurant_id: id } });

  if (existing) {
    await prisma.$executeRaw`
      UPDATE restaurants
      SET owner_id = ${ownerId},
          business_name = ${name},
          location_coord = ST_GeomFromText(${point(location)}, 4326),
          wallet_balance = ${wallet},
          address_text = ${address}
      WHERE restaurant_id = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO restaurants (restaurant_id, owner_id, business_name, location_coord, wallet_balance, address_text)
      VALUES (${id}, ${ownerId}, ${name}, ST_GeomFromText(${point(location)}, 4326), ${wallet}, ${address})
    `;
  }
  return id;
}

async function seedSupplier({ id, userId, name, email, location }) {
  const existing = await prisma.suppliers.findUnique({ where: { supplier_id: id } });

  if (existing) {
    await prisma.$executeRaw`
      UPDATE suppliers
      SET user_id = ${userId},
          company_name = ${name},
          contact_email = ${email},
          warehouse_coord = ST_GeomFromText(${point(location)}, 4326)
      WHERE supplier_id = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO suppliers (supplier_id, user_id, company_name, contact_email, warehouse_coord)
      VALUES (${id}, ${userId}, ${name}, ${email}, ST_GeomFromText(${point(location)}, 4326))
    `;
  }
  return id;
}

/**
 * Reuses an existing PRODUCTS row with the same name and unit when one is
 * already present, so repeated seeding does not create duplicate definitions
 * alongside data produced by earlier runs or tests.
 */
async function seedProduct({ name, unit, category }) {
  const existing = await prisma.products.findFirst({
    where: { product_name: name, unit_of_measure: unit }
  });

  if (existing) {
    if (existing.category !== category) {
      await prisma.products.update({ where: { product_id: existing.product_id }, data: { category } });
    }
    return existing.product_id;
  }

  const created = await prisma.products.create({
    data: {
      product_id: crypto.randomUUID(),
      product_name: name,
      unit_of_measure: unit,
      category
    }
  });
  return created.product_id;
}

async function seedOffer({ supplierId, productId, price, moq }) {
  const existing = await prisma.supplier_catalogue.findUnique({
    where: { supplier_id_product_id: { supplier_id: supplierId, product_id: productId } }
  });

  if (existing) {
    const updated = await prisma.supplier_catalogue.update({
      where: { catalogue_id: existing.catalogue_id },
      data: { price_per_unit: price, min_order_qty: moq }
    });
    return updated.catalogue_id;
  }

  const created = await prisma.supplier_catalogue.create({
    data: {
      catalogue_id: crypto.randomUUID(),
      supplier_id: supplierId,
      product_id: productId,
      price_per_unit: price,
      min_order_qty: moq
    }
  });
  return created.catalogue_id;
}

async function seedPool({ id, catalogueId, location, targetMoq, daysLeft }) {
  const existing = await prisma.buying_pools.findUnique({ where: { pool_id: id } });

  // Compute expiry in Node, not MySQL DATE_ADD(NOW(), ...): the DB session may
  // use a local timezone while Prisma reads timestamps as UTC, so SQL-side
  // arithmetic would skew the deadline by the UTC offset.
  const expiresAtEpoch = Math.floor((Date.now() + daysLeft * 24 * 60 * 60 * 1000) / 1000);

  if (existing) {
    await prisma.$executeRaw`
      UPDATE buying_pools
      SET catalogue_id = ${catalogueId},
          geographic_zone = ST_GeomFromText(${point(location)}, 4326),
          target_moq = ${targetMoq},
          expiration_time = FROM_UNIXTIME(${expiresAtEpoch})
      WHERE pool_id = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO buying_pools (pool_id, catalogue_id, geographic_zone, status, current_qty, target_moq, expiration_time)
      VALUES (${id}, ${catalogueId}, ST_GeomFromText(${point(location)}, 4326), 'ACTIVE', 0.00, ${targetMoq},
              FROM_UNIXTIME(${expiresAtEpoch}))
    `;
  }
  return id;
}

/**
 * Creates a demo micro-order only if that kitchen has not already ordered in
 * the pool. Re-running the seed therefore never overwrites real demo activity.
 */
async function seedOrder({ id, poolId, restaurantId, qty, unitPrice, paymentStatus }) {
  const existing = await prisma.micro_orders.findUnique({
    where: { pool_id_restaurant_id: { pool_id: poolId, restaurant_id: restaurantId } }
  });

  if (existing) return existing.order_id;

  const created = await prisma.micro_orders.create({
    data: {
      order_id: id,
      pool_id: poolId,
      restaurant_id: restaurantId,
      requested_qty: qty,
      pledged_amount: Number((qty * unitPrice).toFixed(2)),
      payment_status: paymentStatus
    }
  });
  return created.order_id;
}

/**
 * Recomputes a pool's running total and status from its micro-orders.
 * This is the same invariant the aggregation engine maintains on every order.
 */
async function reconcilePool(poolId) {
  const aggregate = await prisma.micro_orders.aggregate({
    where: { pool_id: poolId },
    _sum: { requested_qty: true }
  });

  const pool = await prisma.buying_pools.findUnique({ where: { pool_id: poolId } });
  if (!pool) return null;

  const currentQty = Number(aggregate._sum.requested_qty || 0);
  const targetMoq = Number(pool.target_moq);

  const status = pool.status === lifecycle.POOL_STATUSES.CANCELLED
    ? pool.status
    : lifecycle.statusForQuantity(currentQty, targetMoq);

  const updated = await prisma.buying_pools.update({
    where: { pool_id: poolId },
    data: { current_qty: currentQty, status }
  });

  return { currentQty, targetMoq, status: updated.status };
}

async function runSeed() {
  console.log('[Seed] Loading CoBuy demo data...');

  await seedUser({
    userId: IDS.kitchenAUser,
    username: 'demo_kitchen_a',
    email: 'demo.kitchen.a@cobuy.demo',
    roles: ['restaurant_owner']
  });
  await seedUser({
    userId: IDS.kitchenBUser,
    username: 'demo_kitchen_b',
    email: 'demo.kitchen.b@cobuy.demo',
    roles: ['restaurant_owner']
  });
  await seedUser({
    userId: IDS.kitchenCUser,
    username: 'demo_kitchen_c',
    email: 'demo.kitchen.c@cobuy.demo',
    roles: ['restaurant_owner']
  });
  await seedUser({
    userId: IDS.supplierFreshUser,
    username: 'demo_fresh_foods',
    email: 'demo.freshfoods@cobuy.demo',
    roles: ['supplier']
  });
  await seedUser({
    userId: IDS.supplierGreenUser,
    username: 'demo_green_basket',
    email: 'demo.greenbasket@cobuy.demo',
    roles: ['supplier']
  });

  await seedRestaurant({
    id: IDS.kitchenA,
    ownerId: IDS.kitchenAUser,
    name: 'Kitchen A',
    location: POINTS.indiranagar,
    wallet: 5000.0,
    address: '100ft Road, Indiranagar, Bangalore'
  });
  await seedRestaurant({
    id: IDS.kitchenB,
    ownerId: IDS.kitchenBUser,
    name: 'Kitchen B',
    location: POINTS.koramangala,
    wallet: 4000.0,
    address: '5th Block, Koramangala, Bangalore'
  });
  await seedRestaurant({
    id: IDS.kitchenC,
    ownerId: IDS.kitchenCUser,
    name: 'Kitchen C',
    location: POINTS.hsr,
    wallet: 3500.0,
    address: '27th Main, HSR Layout, Bangalore'
  });

  await seedSupplier({
    id: IDS.supplierFresh,
    userId: IDS.supplierFreshUser,
    name: 'Fresh Foods',
    email: 'demo.freshfoods@cobuy.demo',
    location: POINTS.domlur
  });
  await seedSupplier({
    id: IDS.supplierGreen,
    userId: IDS.supplierGreenUser,
    name: 'Green Basket',
    email: 'demo.greenbasket@cobuy.demo',
    location: POINTS.indiranagar
  });

  const tomatoes = await seedProduct({ name: 'Tomatoes', unit: 'kg', category: 'Produce' });
  const onions = await seedProduct({ name: 'Onions', unit: 'kg', category: 'Produce' });
  const oil = await seedProduct({ name: 'Cooking Oil', unit: 'litre', category: 'Oils' });

  // Prices and MOQs match the context file's examples exactly.
  const freshTomatoes = await seedOffer({ supplierId: IDS.supplierFresh, productId: tomatoes, price: 20.0, moq: 500.0 });
  const freshOnions = await seedOffer({ supplierId: IDS.supplierFresh, productId: onions, price: 30.0, moq: 300.0 });
  const greenTomatoes = await seedOffer({ supplierId: IDS.supplierGreen, productId: tomatoes, price: 22.0, moq: 400.0 });
  const greenOil = await seedOffer({ supplierId: IDS.supplierGreen, productId: oil, price: 140.0, moq: 200.0 });

  await seedPool({
    id: IDS.tomatoPool,
    catalogueId: freshTomatoes,
    location: POINTS.koramangala,
    targetMoq: 500.0,
    daysLeft: 7
  });
  await seedPool({
    id: IDS.onionPool,
    catalogueId: freshOnions,
    location: POINTS.domlur,
    targetMoq: 300.0,
    daysLeft: 5
  });
  await seedPool({
    id: IDS.greenTomatoPool,
    catalogueId: greenTomatoes,
    location: POINTS.indiranagar,
    targetMoq: 400.0,
    daysLeft: 10
  });
  await seedPool({
    id: IDS.oilPool,
    catalogueId: greenOil,
    location: POINTS.koramangala,
    targetMoq: 200.0,
    daysLeft: 2
  });

  // The context file's tomato story: A 200 + B 150 = 350 of 500 kg (70%).
  await seedOrder({
    id: IDS.orderA,
    poolId: IDS.tomatoPool,
    restaurantId: IDS.kitchenA,
    qty: 200,
    unitPrice: 20.0,
    paymentStatus: 'PAID'
  });
  await seedOrder({
    id: IDS.orderB,
    poolId: IDS.tomatoPool,
    restaurantId: IDS.kitchenB,
    qty: 150,
    unitPrice: 20.0,
    paymentStatus: 'PENDING'
  });
  await seedOrder({
    id: IDS.orderC,
    poolId: IDS.onionPool,
    restaurantId: IDS.kitchenA,
    qty: 200,
    unitPrice: 30.0,
    paymentStatus: 'PENDING'
  });
  // A fulfilled example: 200 of 200 litres of cooking oil.
  const oilOrder = await seedOrder({
    id: IDS.orderA.replace('f1111111', 'f4444444'),
    poolId: IDS.oilPool,
    restaurantId: IDS.kitchenC,
    qty: 200,
    unitPrice: 140.0,
    paymentStatus: 'PAID'
  });

  const tomatoState = await reconcilePool(IDS.tomatoPool);
  const onionState = await reconcilePool(IDS.onionPool);
  const greenTomatoState = await reconcilePool(IDS.greenTomatoPool);
  const oilState = await reconcilePool(IDS.oilPool);

  console.log('[Seed] Demo data ready.');
  console.log(`[Seed] Password for every demo account: ${DEMO_PASSWORD}`);
  console.log('[Seed] Kitchens: demo.kitchen.a@cobuy.demo, demo.kitchen.b@cobuy.demo, demo.kitchen.c@cobuy.demo');
  console.log('[Seed] Suppliers: demo.freshfoods@cobuy.demo, demo.greenbasket@cobuy.demo');
  console.log(
    `[Seed] Tomato pool BP01: ${tomatoState.currentQty}/${tomatoState.targetMoq} kg, ${tomatoState.status}, Koramangala (~4.5 km from Indiranagar)`
  );
  console.log(`[Seed] Onion pool BP02: ${onionState.currentQty}/${onionState.targetMoq} kg, ${onionState.status}`);
  console.log(`[Seed] Green Basket tomato pool BP03: ${greenTomatoState.currentQty}/${greenTomatoState.targetMoq} kg, ${greenTomatoState.status}`);
  console.log(`[Seed] Cooking oil pool BP04: ${oilState.currentQty}/${oilState.targetMoq} L, ${oilState.status} (order ${oilOrder})`);
}

if (require.main === module) {
  runSeed()
    .catch((error) => {
      console.error('[Seed] Failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { runSeed, IDS, DEMO_PASSWORD };
