// ============================================================================
// File: tests/demo_run_test.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Day 13 end-to-end run of the context file's story:
//          Fresh Foods lists tomatoes at Rs 20/kg with a 500 kg MOQ, a pool is
//          opened, Kitchens A (200), B (150) and C (150) contribute, the pool
//          goes ACTIVE -> FULFILLED, and payments read PAID, PAID, PENDING.
// Run with: npm run test:demo
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

const INDIRANAGAR = { lat: 12.9716, lng: 77.5946 };
const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const HSR = { lat: 12.9121, lng: 77.6446 };
const DOMLUR = { lat: 12.9600, lng: 77.6300 };

async function run() {
  console.log('🧪 [CoBuy] Day 13 End-to-End Demo Run\n');

  const { server, baseUrl } = await startServer(app);
  const ts = uniqueSuffix();

  try {
    // ------------------------------------------------------------------
    console.log('--- 1. Supplier lists tomatoes (Fresh Foods, Rs 20/kg, 500 kg MOQ) ---');
    const supplier = await registerUser(baseUrl, {
      username: `demo_supplier_${ts}`,
      email: `demo_supplier_${ts}@example.com`,
      roles: ['supplier']
    });
    const supplierProfile = await createSupplier(baseUrl, supplier.token, {
      companyName: 'Fresh Foods',
      contactEmail: `freshfoods_${ts}@example.com`,
      latitude: DOMLUR.lat,
      longitude: DOMLUR.lng
    });
    assert(supplierProfile.companyName === 'Fresh Foods', 'Fresh Foods supplier profile created');

    const tomatoes = await createProduct(baseUrl, supplier.token, {
      productName: `Tomatoes Demo ${ts}`,
      unitOfMeasure: 'kg',
      category: 'Produce'
    });
    const offer = await createOffer(baseUrl, supplier.token, {
      productId: tomatoes.productId,
      pricePerUnit: 20,
      minOrderQty: 500
    });
    assert(offer.pricePerUnit === 20 && offer.minOrderQty === 500, 'Tomatoes listed at Rs 20/kg with a 500 kg MOQ');

    // ------------------------------------------------------------------
    console.log('--- 2. Pool opened for the Koramangala cluster ---');
    const pool = await createPool(baseUrl, supplier.token, {
      catalogueId: offer.catalogueId,
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng,
      durationDays: 7
    });
    assert(pool.status === 'ACTIVE' && pool.targetMoq === 500, 'Pool BP01 starts ACTIVE with a 500 kg target');

    // ------------------------------------------------------------------
    console.log('--- 3. Kitchens A, B and C contribute 200 + 150 + 150 ---');
    const kitchenSpecs = [
      { key: 'A', name: 'Kitchen A', location: INDIRANAGAR, qty: 200, payment: 'PAID' },
      { key: 'B', name: 'Kitchen B', location: KORAMANGALA, qty: 150, payment: 'PAID' },
      { key: 'C', name: 'Kitchen C', location: HSR, qty: 150, payment: 'PENDING' }
    ];

    const kitchens = {};
    const orderIds = {};

    for (const spec of kitchenSpecs) {
      const user = await registerUser(baseUrl, {
        username: `demo_kitchen_${spec.key}_${ts}`,
        email: `demo_kitchen_${spec.key}_${ts}@example.com`,
        roles: ['restaurant_owner']
      });
      const restaurant = await createRestaurant(baseUrl, user.token, {
        name: spec.name,
        latitude: spec.location.lat,
        longitude: spec.location.lng
      });
      kitchens[spec.key] = { token: user.token, restaurantId: restaurant.restaurantId };

      const order = await placeOrder(baseUrl, user.token, {
        poolId: pool.poolId,
        requestedQty: spec.qty
      });
      assert(order.status === 201, `${spec.name} pledged ${spec.qty} kg`);
      orderIds[spec.key] = order.body.data.orderId;
    }

    const detail = await request(baseUrl, 'GET', `/api/pools/${pool.poolId}`);
    const state = detail.body.data;
    assert(state.currentQty === 500, 'Aggregate reaches exactly 500 kg');
    assert(state.progressPercentage === 100, 'Progress bar reads 100%');
    assert(state.status === 'FULFILLED', 'Pool moved ACTIVE -> FULFILLED');
    assert(state.orders.length === 3, 'All three micro-orders are recorded');

    // ------------------------------------------------------------------
    console.log('--- 4. Pledged amounts and payment statuses ---');
    const byKitchen = Object.fromEntries(
      state.orders.map((o) => [o.restaurantId, { qty: o.requestedQty, amount: o.pledgedAmount, status: o.paymentStatus }])
    );

    const a = byKitchen[kitchens.A.restaurantId];
    const b = byKitchen[kitchens.B.restaurantId];
    const c = byKitchen[kitchens.C.restaurantId];

    assert(a.qty === 200 && a.amount === 4000, 'Kitchen A: 200 kg -> Rs 4,000');
    assert(b.qty === 150 && b.amount === 3000, 'Kitchen B: 150 kg -> Rs 3,000');
    assert(c.qty === 150 && c.amount === 3000, 'Kitchen C: 150 kg -> Rs 3,000');
    assert([a.status, b.status, c.status].every((s) => s === 'PENDING'), 'Every new order starts PENDING');

    for (const key of ['A', 'B']) {
      const paid = await request(baseUrl, 'PATCH', `/api/orders/${orderIds[key]}/payment`, {
        paymentStatus: 'PAID'
      }, kitchens[key].token);
      assert(paid.status === 200 && paid.body.data.paymentStatus === 'PAID', `Kitchen ${key} payment settled (PAID)`);
    }

    const finalDetail = await request(baseUrl, 'GET', `/api/pools/${pool.poolId}`);
    const statuses = finalDetail.body.data.orders
      .map((o) => o.paymentStatus)
      .sort();

    assert(
      JSON.stringify(statuses) === JSON.stringify(['PAID', 'PAID', 'PENDING']),
      'Payments read PAID, PAID, PENDING'
    );

    // ------------------------------------------------------------------
    console.log('--- 5. Both dashboards can read the same truth ---');
    const supplierView = await request(baseUrl, 'GET', `/api/orders/pool/${pool.poolId}`, null, supplier.token);
    assert(supplierView.status === 200, 'Supplier can audit orders on its own pool');
    assert(supplierView.body.data.orders.length === 3, 'Supplier sees all three contributions');
    assert(supplierView.body.data.currentQty === 500, 'Supplier sees the same 500 kg aggregate');

    const history = await request(baseUrl, 'GET', '/api/orders/my', null, kitchens.A.token);
    assert(
      history.status === 200 && history.body.data.some((o) => o.orderId === orderIds.A),
      "Kitchen A's order history contains its contribution"
    );

    console.log('\n🎉 DAY 13 END-TO-END DEMO RUN PASSED 100%!');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Demo run crashed:', error);
  process.exit(1);
});
