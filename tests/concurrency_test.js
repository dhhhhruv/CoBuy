// ============================================================================
// File: tests/concurrency_test.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Day 10 concurrency proof, using the context file's own numbers.
//
//   1. The real endpoint: two kitchens pledge 100 kg each against a pool that
//      already holds 350 kg of a 500 kg target. Both contributions must land
//      (550 kg total, FULFILLED).
//   2. The naive version: the same pledge pattern executed with a plain
//      read -> write sequence, which loses one contribution. This test asserts
//      the lost update happens, so the bug can be demonstrated live in a viva.
//
// Run with: npm run test:concurrency
// ============================================================================

const app = require('../src/app');
const prisma = require('../src/db/prisma');
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

const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const INDIRANAGAR = { lat: 12.9716, lng: 77.5946 };
const HSR = { lat: 12.9121, lng: 77.6446 };
const DOMLUR = { lat: 12.9600, lng: 77.6300 };

/**
 * Barrier so both naive transactions read the old quantity before either writes.
 * Without this the demonstration would depend on scheduler luck.
 */
function createBarrier(parties) {
  let arrived = 0;
  let release;
  const gate = new Promise((resolve) => (release = resolve));

  return async function wait() {
    arrived += 1;
    if (arrived === parties) release();
    await gate;
  };
}

async function run() {
  console.log('🧪 [CoBuy] Day 10 Concurrency Proof\n');

  const { server, baseUrl } = await startServer(app);
  const ts = uniqueSuffix();

  try {
    // ------------------------------------------------------------------
    console.log('--- 0. Fixtures ---');
    const supplier = await registerUser(baseUrl, {
      username: `cc_supplier_${ts}`,
      email: `cc_supplier_${ts}@example.com`,
      roles: ['supplier']
    });
    await createSupplier(baseUrl, supplier.token, {
      companyName: `Concurrency Supplier ${ts}`,
      contactEmail: `concurrency_${ts}@example.com`,
      latitude: DOMLUR.lat,
      longitude: DOMLUR.lng
    });

    const kitchenTokens = {};
    for (const [key, location] of Object.entries({ A: INDIRANAGAR, B: KORAMANGALA, C: HSR })) {
      const user = await registerUser(baseUrl, {
        username: `cc_kitchen_${key}_${ts}`,
        email: `cc_kitchen_${key}_${ts}@example.com`,
        roles: ['restaurant_owner']
      });
      const restaurant = await createRestaurant(baseUrl, user.token, {
        name: `Concurrency Kitchen ${key} ${ts}`,
        latitude: location.lat,
        longitude: location.lng
      });
      kitchenTokens[key] = { token: user.token, restaurantId: restaurant.restaurantId };
    }
    assert(Object.keys(kitchenTokens).length === 3, 'Three participating kitchens created');

    const product = await createProduct(baseUrl, supplier.token, {
      productName: `Concurrency Tomatoes ${ts}`,
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
    console.log('--- 1. Real endpoint: 350 + 100 + 100 must equal 550 ---');
    for (let round = 1; round <= 3; round += 1) {
      const pool = await newPool();

      const base = await placeOrder(baseUrl, kitchenTokens.C.token, {
        poolId: pool.poolId,
        requestedQty: 350
      });
      assert(base.status === 201 && base.body.data.poolCurrentQty === 350, `Round ${round}: pool holds 350 kg before the race`);

      // Fire both pledges at the same time.
      const [first, second] = await Promise.all([
        placeOrder(baseUrl, kitchenTokens.A.token, { poolId: pool.poolId, requestedQty: 100 }),
        placeOrder(baseUrl, kitchenTokens.B.token, { poolId: pool.poolId, requestedQty: 100 })
      ]);

      assert(first.status === 201, `Round ${round}: Kitchen A pledge accepted (HTTP 201)`);
      assert(second.status === 201, `Round ${round}: Kitchen B pledge accepted (HTTP 201)`);

      const detail = await request(baseUrl, 'GET', `/api/pools/${pool.poolId}`);
      const poolState = detail.body.data;
      const orderSum = poolState.orders.reduce((sum, o) => sum + o.requestedQty, 0);

      assert(poolState.currentQty === 550, `Round ${round}: current_qty is 550 kg - neither contribution was lost`);
      assert(orderSum === 550, `Round ${round}: micro-orders sum to 550 kg`);
      assert(poolState.status === 'FULFILLED', `Round ${round}: pool is FULFILLED once the MOQ is crossed`);
      assert(poolState.orders.length === 3, `Round ${round}: all three contributions are stored`);
    }

    // ------------------------------------------------------------------
    console.log('--- 2. Naive read-then-write loses an update (the bug) ---');
    const naivePool = await newPool();
    const poolId = naivePool.poolId;
    const waitAtBarrier = createBarrier(2);

    async function naivePledge(qty) {
      await prisma.$transaction(async (tx) => {
        // Deliberately unsafe: read the total, compute in JS, write the result.
        const rows = await tx.$queryRaw`
          SELECT current_qty FROM buying_pools WHERE pool_id = ${poolId}
        `;
        const readQty = Number(rows[0].current_qty);

        await waitAtBarrier();

        await tx.buying_pools.update({
          where: { pool_id: poolId },
          data: { current_qty: readQty + qty }
        });
      });
    }

    await Promise.all([naivePledge(100), naivePledge(100)]);

    const naiveState = await prisma.buying_pools.findUnique({ where: { pool_id: poolId } });
    const naiveQty = Number(naiveState.current_qty);

    assert(naiveQty === 100, `Naive read-then-write records only 100 kg of the 200 kg pledged (lost update reproduced: ${naiveQty} kg)`);

    console.log('\n🎉 DAY 10 CONCURRENCY PROOF PASSED 100%!');
    console.log('   Real engine: 350 + 100 + 100 = 550 kg (row lock serialises pledges).');
    console.log('   Naive engine: 200 kg pledged but only 100 kg recorded (lost update).');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});
