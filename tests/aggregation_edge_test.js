// ============================================================================
// File: tests/aggregation_edge_test.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Day 15 edge cases for the aggregation engine - exact MOQ, overfill
//          (Decision 6), duplicate order, expired pool, non-ACTIVE pool,
//          5 km rejection and status-machine invariants.
// Run with: npm run test:aggregation
// ============================================================================

const app = require('../src/app');
const prisma = require('../src/db/prisma');
const lifecycle = require('../src/pools/poolLifecycle');
const {
  request,
  assert,
  startServer,
  registerUser,
  createRestaurant,
  createSupplier,
  createProduct,
  createOffer,
  createPool,
  placeOrder,
  uniqueSuffix
} = require('./testUtils');

const INDIRANAGAR = { lat: 12.9716, lng: 77.5946 };
const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const HSR = { lat: 12.9121, lng: 77.6446 };
const WHITEFIELD = { lat: 12.9698, lng: 77.7499 };
const DOMLUR = { lat: 12.9600, lng: 77.6300 };

async function run() {
  console.log('🧪 [CoBuy] Day 15 Aggregation Edge-Case Suite\n');

  const { server, baseUrl } = await startServer(app);
  const ts = uniqueSuffix();

  try {
    // ------------------------------------------------------------------
    console.log('--- 0. Status machine invariants (pure unit checks) ---');
    assert(lifecycle.canTransition('ACTIVE', 'FULFILLED'), 'ACTIVE -> FULFILLED is allowed');
    assert(!lifecycle.canTransition('FULFILLED', 'ACTIVE'), 'FULFILLED -> ACTIVE is not allowed');
    assert(!lifecycle.canTransition('EXPIRED', 'ACTIVE'), 'EXPIRED -> ACTIVE is not allowed');
    assert(!lifecycle.canTransition('CANCELLED', 'FULFILLED'), 'CANCELLED -> FULFILLED is not allowed');
    let threw = false;
    try {
      lifecycle.assertTransition('EXPIRED', 'ACTIVE');
    } catch (error) {
      threw = error.errorCode === 'INVALID_STATUS_TRANSITION';
    }
    assert(threw, 'Invalid transition raises INVALID_STATUS_TRANSITION');

    // ------------------------------------------------------------------
    console.log('--- 1. Fixtures ---');
    const supplier = await registerUser(baseUrl, {
      username: `agg_supplier_${ts}`,
      email: `agg_supplier_${ts}@example.com`,
      roles: ['supplier']
    });
    await createSupplier(baseUrl, supplier.token, {
      companyName: `Aggregation Supplier ${ts}`,
      contactEmail: `aggregation_${ts}@example.com`,
      latitude: DOMLUR.lat,
      longitude: DOMLUR.lng
    });

    const kitchenSpecs = [
      { key: 'A', location: INDIRANAGAR },
      { key: 'B', location: KORAMANGALA },
      { key: 'C', location: HSR },
      { key: 'FAR', location: WHITEFIELD }
    ];

    const kitchens = {};
    for (const spec of kitchenSpecs) {
      const user = await registerUser(baseUrl, {
        username: `agg_kitchen_${spec.key}_${ts}`,
        email: `agg_kitchen_${spec.key}_${ts}@example.com`,
        roles: ['restaurant_owner']
      });
      const restaurant = await createRestaurant(baseUrl, user.token, {
        name: `Aggregation Kitchen ${spec.key} ${ts}`,
        latitude: spec.location.lat,
        longitude: spec.location.lng
      });
      kitchens[spec.key] = { token: user.token, restaurantId: restaurant.restaurantId };
    }
    assert(Object.keys(kitchens).length === 4, 'Four kitchens created (three local, one 20 km away)');

    const product = await createProduct(baseUrl, supplier.token, {
      productName: `Aggregation Tomatoes ${ts}`,
      unitOfMeasure: 'kg',
      category: 'Produce'
    });
    const offer = await createOffer(baseUrl, supplier.token, {
      productId: product.productId,
      pricePerUnit: 20,
      minOrderQty: 500
    });

    const newPool = () => createPool(baseUrl, supplier.token, {
      catalogueId: offer.catalogueId,
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng,
      durationDays: 7
    });

    // ------------------------------------------------------------------
    console.log('--- 2. Exactly hitting the MOQ ---');
    const exactPool = await newPool();
    const exactOrder = await placeOrder(baseUrl, kitchens.A.token, {
      poolId: exactPool.poolId,
      requestedQty: 500
    });
    assert(exactOrder.status === 201, '500 kg pledge accepted (HTTP 201)');
    assert(exactOrder.body.data.poolStatus === 'FULFILLED', 'Pool flips to FULFILLED exactly at the MOQ');
    assert(exactOrder.body.data.poolCurrentQty === 500, 'Pool total is exactly 500 kg');
    assert(exactOrder.body.data.overfillBy === 0, 'Exact MOQ reports zero overfill');
    assert(exactOrder.body.data.pledgedAmount === 10000, 'Pledged amount = 500 kg x Rs 20');

    // ------------------------------------------------------------------
    console.log('--- 3. Overfill policy (Decision 6: allowed and reported) ---');
    const overPool = await newPool();
    const first = await placeOrder(baseUrl, kitchens.A.token, {
      poolId: overPool.poolId,
      requestedQty: 200
    });
    assert(first.body.data.poolStatus === 'ACTIVE', '200 of 500 keeps the pool ACTIVE');

    const over = await placeOrder(baseUrl, kitchens.B.token, {
      poolId: overPool.poolId,
      requestedQty: 400
    });
    assert(over.status === 201, 'Pledge larger than the remaining quantity is accepted');
    assert(over.body.data.poolCurrentQty === 600, 'Overfill is aggregated (600 kg)');
    assert(over.body.data.overfillBy === 100, 'Response reports the 100 kg surplus');
    assert(over.body.data.poolStatus === 'FULFILLED', 'Overfilled pool is still FULFILLED');

    const oversizedSingle = await newPool();
    const big = await placeOrder(baseUrl, kitchens.C.token, {
      poolId: oversizedSingle.poolId,
      requestedQty: 800
    });
    assert(big.status === 201 && big.body.data.overfillBy === 300, 'A single 800 kg pledge overfills a 500 kg target by 300 kg');

    // ------------------------------------------------------------------
    console.log('--- 4. Duplicate, invalid quantity and distance rules ---');
    const guardPool = await newPool();
    const guardOrder = await placeOrder(baseUrl, kitchens.A.token, {
      poolId: guardPool.poolId,
      requestedQty: 100
    });
    assert(guardOrder.status === 201, 'First pledge in the guard pool succeeds');

    const duplicate = await placeOrder(baseUrl, kitchens.A.token, {
      poolId: guardPool.poolId,
      requestedQty: 50
    });
    assert(duplicate.status === 409 && duplicate.body.error.code === 'ALREADY_ORDERED', 'Second pledge by the same kitchen rejected (HTTP 409)');

    const negative = await placeOrder(baseUrl, kitchens.B.token, {
      poolId: guardPool.poolId,
      requestedQty: -5
    });
    assert(negative.status === 400 && negative.body.error.code === 'INVALID_QUANTITY', 'Negative quantity rejected (HTTP 400)');

    const farAway = await placeOrder(baseUrl, kitchens.FAR.token, {
      poolId: guardPool.poolId,
      requestedQty: 50
    });
    assert(
      farAway.status === 400 && farAway.body.error.code === 'CLUSTER_PROXIMITY_EXCEEDED',
      'Kitchen ~20 km away rejected by the 5 km rule'
    );

    const detail = await request(baseUrl, 'GET', `/api/pools/${guardPool.poolId}`);
    const orderSum = detail.body.data.orders.reduce((sum, o) => sum + o.requestedQty, 0);
    assert(orderSum === detail.body.data.currentQty, 'current_qty equals the sum of micro-orders');

    // ------------------------------------------------------------------
    console.log('--- 5. Closed pools reject new orders ---');
    const closed = await placeOrder(baseUrl, kitchens.B.token, {
      poolId: exactPool.poolId,
      requestedQty: 10
    });
    assert(closed.status === 409 && closed.body.error.code === 'INVALID_POOL_STATUS', 'Ordering into a FULFILLED pool rejected (HTTP 409)');

    // ------------------------------------------------------------------
    console.log('--- 6. Expired pool ---');
    const expiringPool = await newPool();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.$executeRaw`
      UPDATE buying_pools
      SET expiration_time = ${twoHoursAgo}
      WHERE pool_id = ${expiringPool.poolId}
    `;
    const expiredOrder = await placeOrder(baseUrl, kitchens.C.token, {
      poolId: expiringPool.poolId,
      requestedQty: 10
    });
    assert(
      expiredOrder.status === 409 && expiredOrder.body.error.code === 'INVALID_POOL_STATUS',
      'Order against an expired pool is rejected as a state conflict (HTTP 409)'
    );

    const expiredState = await prisma.buying_pools.findUnique({ where: { pool_id: expiringPool.poolId } });
    assert(expiredState.status === 'EXPIRED', 'Expired pool is closed as EXPIRED, not left ACTIVE');

    console.log('\n🎉 DAY 15 AGGREGATION EDGE CASES PASSED 100%!');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});
