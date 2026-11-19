// ============================================================================
// File: tests/catalogue_pool_test.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Days 6-8 verification - products CRUD, supplier_catalogue CRUD,
//          pool creation, listing, detail, nearby alias and lazy expiry.
// Run with: npm run test:catalogue
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
  uniqueSuffix
} = require('./testUtils');

const INDIRANAGAR = { lat: 12.9716, lng: 77.5946 };
const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const DOMLUR = { lat: 12.9600, lng: 77.6300 };

async function run() {
  console.log('🧪 [CoBuy] Days 6-8 Catalogue & Pool Test Suite\n');

  const { server, baseUrl } = await startServer(app);
  const ts = uniqueSuffix();
  let poolId;

  try {
    // ------------------------------------------------------------------
    console.log('--- 1. Fixtures: supplier, kitchen, profiles ---');
    const supplier = await registerUser(baseUrl, {
      username: `cat_supplier_${ts}`,
      email: `cat_supplier_${ts}@example.com`,
      roles: ['supplier']
    });
    const kitchen = await registerUser(baseUrl, {
      username: `cat_kitchen_${ts}`,
      email: `cat_kitchen_${ts}@example.com`,
      roles: ['restaurant_owner']
    });

    await createSupplier(baseUrl, supplier.token, {
      companyName: `Catalogue Supplier ${ts}`,
      contactEmail: `catalogue_${ts}@example.com`,
      latitude: DOMLUR.lat,
      longitude: DOMLUR.lng
    });
    const restaurant = await createRestaurant(baseUrl, kitchen.token, {
      name: `Catalogue Kitchen ${ts}`,
      latitude: INDIRANAGAR.lat,
      longitude: INDIRANAGAR.lng
    });
    assert(!!restaurant.restaurantId, 'Kitchen profile created for catalogue tests');

    // ------------------------------------------------------------------
    console.log('--- 2. Products CRUD (Day 6) ---');
    const productsList = await request(baseUrl, 'GET', '/api/products');
    assert(productsList.status === 200 && Array.isArray(productsList.body.data), 'GET /api/products returns a list');

    const productName = `Test Ingredient ${ts}`;
    const product = await createProduct(baseUrl, supplier.token, {
      productName,
      unitOfMeasure: 'kg',
      category: 'Produce'
    });
    assert(product.productName === productName, 'Supplier can create a base product');

    const forbiddenProduct = await request(baseUrl, 'POST', '/api/products', {
      productName: `Forbidden ${ts}`,
      unitOfMeasure: 'kg'
    }, kitchen.token);
    assert(forbiddenProduct.status === 403, 'Kitchen cannot create a base product (HTTP 403)');

    const renamed = await request(baseUrl, 'PATCH', `/api/products/${product.productId}`, {
      category: 'Fresh Produce'
    }, supplier.token);
    assert(renamed.status === 200 && renamed.body.data.category === 'Fresh Produce', 'Supplier can update a product');

    // ------------------------------------------------------------------
    console.log('--- 3. Supplier catalogue CRUD (Day 6) ---');
    const offer = await createOffer(baseUrl, supplier.token, {
      productId: product.productId,
      pricePerUnit: 20,
      minOrderQty: 500
    });
    assert(offer.pricePerUnit === 20 && offer.minOrderQty === 500, 'Supplier can publish an offer with price and MOQ');

    const duplicate = await request(baseUrl, 'POST', '/api/catalogue', {
      productId: product.productId,
      pricePerUnit: 22,
      minOrderQty: 400
    }, supplier.token);
    assert(duplicate.status === 409, 'Duplicate supplier/product offer rejected (HTTP 409)');
    assert(duplicate.body.error.code === 'DUPLICATE_CATALOGUE_OFFER', 'Duplicate offer carries DUPLICATE_CATALOGUE_OFFER code');

    const patched = await request(baseUrl, 'PATCH', `/api/catalogue/${offer.catalogueId}`, {
      pricePerUnit: 21.5
    }, supplier.token);
    assert(patched.status === 200 && patched.body.data.pricePerUnit === 21.5, 'Supplier can update an offer price');

    const myOffers = await request(baseUrl, 'GET', '/api/catalogue/me', null, supplier.token);
    assert(
      myOffers.status === 200 && myOffers.body.data.some((o) => o.catalogueId === offer.catalogueId),
      'GET /api/catalogue/me returns the supplier own offers'
    );

    const publicOffers = await request(baseUrl, 'GET', '/api/catalogue');
    assert(
      publicOffers.status === 200 && publicOffers.body.data.some((o) => o.catalogueId === offer.catalogueId),
      'GET /api/catalogue lists offers publicly'
    );

    // ------------------------------------------------------------------
    console.log('--- 4. Pool creation & listing (Day 7) ---');
    const forbiddenPool = await request(baseUrl, 'POST', '/api/pools', {
      catalogueId: offer.catalogueId,
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng
    }, kitchen.token);
    assert(forbiddenPool.status === 403, 'Kitchen cannot create a buying pool (HTTP 403)');

    const pool = await createPool(baseUrl, supplier.token, {
      catalogueId: offer.catalogueId,
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng,
      durationDays: 7
    });
    poolId = pool.poolId;
    assert(pool.targetMoq === 500, 'Pool target_moq is snapshotted from the offer MOQ');
    assert(pool.currentQty === 0 && pool.status === 'ACTIVE', 'New pool starts ACTIVE at 0 quantity');

    const detail = await request(baseUrl, 'GET', `/api/pools/${poolId}`);
    assert(detail.status === 200, 'GET /api/pools/:id returns the pool');
    assert(detail.body.data.poolId === poolId, 'Pool detail matches the created pool');
    assert(detail.body.data.orders.length === 0, 'New pool has no micro-orders');

    const listing = await request(baseUrl, 'GET', `/api/pools?supplierId=${detail.body.data.supplier.supplierId}`);
    assert(listing.status === 200, 'GET /api/pools supports supplier filtering');
    assert(listing.body.data.some((p) => p.poolId === poolId), 'Supplier filter includes the new pool');

    const invalidStatus = await request(baseUrl, 'GET', '/api/pools?status=NOT_A_STATUS');
    assert(invalidStatus.status === 400, 'Invalid pool status filter rejected (HTTP 400)');

    // ------------------------------------------------------------------
    console.log('--- 5. Discovery aliases (Day 8 contract) ---');
    const nearby = await request(baseUrl, 'GET', `/api/pools/nearby?lat=${INDIRANAGAR.lat}&lng=${INDIRANAGAR.lng}&radius=5000`);
    assert(nearby.status === 200, 'GET /api/pools/nearby accepts lat/lng');
    assert(nearby.body.data.some((p) => p.poolId === poolId), 'Pool ~4.5 km away appears in nearby discovery');

    const far = await request(baseUrl, 'GET', `/api/pools/nearby?lat=12.9698&lng=77.7499&radius=5000`);
    assert(
      far.status === 200 && !far.body.data.some((p) => p.poolId === poolId),
      'Pool is excluded when the reference point is ~20 km away'
    );

    // ------------------------------------------------------------------
    console.log('--- 6. Target MOQ snapshot survives a catalogue edit (Ring 2) ---');
    const raiseMoq = await request(baseUrl, 'PATCH', `/api/catalogue/${offer.catalogueId}`, {
      minOrderQty: 900
    }, supplier.token);
    assert(raiseMoq.status === 200, 'Supplier can raise the catalogue MOQ');

    const afterEdit = await request(baseUrl, 'GET', `/api/pools/${poolId}`);
    assert(afterEdit.body.data.targetMoq === 500, 'Existing pool keeps its 500 kg snapshot after the offer changes');

    const offerInUse = await request(baseUrl, 'DELETE', `/api/catalogue/${offer.catalogueId}`, null, supplier.token);
    assert(offerInUse.status === 409 && offerInUse.body.error.code === 'CATALOGUE_OFFER_IN_USE', 'Deleting an offer with pools is refused (HTTP 409)');

    // ------------------------------------------------------------------
    console.log('--- 7. Lazy expiry (Decision 7) ---');
    await prisma.$executeRaw`
      UPDATE buying_pools
      SET expiration_time = ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
      WHERE pool_id = ${poolId}
    `;
    const expired = await request(baseUrl, 'GET', `/api/pools/${poolId}`);
    assert(expired.body.data.status === 'EXPIRED', 'Stale ACTIVE pool is lazily marked EXPIRED on read');

    const orderExpired = await request(baseUrl, 'POST', '/api/orders', {
      poolId,
      requestedQty: 10
    }, kitchen.token);
    assert(
      orderExpired.status === 409 && orderExpired.body.error.code === 'INVALID_POOL_STATUS',
      'Order against an expired pool is rejected as a state conflict (HTTP 409)'
    );

    console.log('\n🎉 DAYS 6-8 CATALOGUE & POOL TESTS PASSED 100%!');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});
