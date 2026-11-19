// ============================================================================
// File: tests/profile_crud_test.js
// Owner: Dhruv (Database & Auth)
// Purpose: Completes the Day 6 profile CRUD scope: update and delete for
//          restaurants and suppliers, with ownership checks and RESTRICT-aware
//          refusals when orders or catalogue offers still reference a profile.
// Run with: npm run test:profiles
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
const DOMLUR = { lat: 12.9600, lng: 77.6300 };
const HSR = { lat: 12.9121, lng: 77.6446 };

async function run() {
  console.log('🧪 [CoBuy] Profile CRUD Test Suite (Days 6)\n');

  const { server, baseUrl } = await startServer(app);
  const ts = uniqueSuffix();

  try {
    // ------------------------------------------------------------------
    console.log('--- 1. Fixtures ---');
    const kitchenA = await registerUser(baseUrl, {
      username: `crud_kitchen_a_${ts}`,
      email: `crud_kitchen_a_${ts}@example.com`,
      roles: ['restaurant_owner']
    });
    const kitchenB = await registerUser(baseUrl, {
      username: `crud_kitchen_b_${ts}`,
      email: `crud_kitchen_b_${ts}@example.com`,
      roles: ['restaurant_owner']
    });
    const supplierA = await registerUser(baseUrl, {
      username: `crud_supplier_a_${ts}`,
      email: `crud_supplier_a_${ts}@example.com`,
      roles: ['supplier']
    });
    const supplierB = await registerUser(baseUrl, {
      username: `crud_supplier_b_${ts}`,
      email: `crud_supplier_b_${ts}@example.com`,
      roles: ['supplier']
    });

    const restaurantA = await createRestaurant(baseUrl, kitchenA.token, {
      name: `CRUD Kitchen A ${ts}`,
      latitude: INDIRANAGAR.lat,
      longitude: INDIRANAGAR.lng
    });
    const restaurantB = await createRestaurant(baseUrl, kitchenB.token, {
      name: `CRUD Kitchen B ${ts}`,
      latitude: HSR.lat,
      longitude: HSR.lng
    });
    const supplierProfileA = await createSupplier(baseUrl, supplierA.token, {
      companyName: `CRUD Supplier A ${ts}`,
      contactEmail: `crud_supplier_a_${ts}@example.com`,
      latitude: DOMLUR.lat,
      longitude: DOMLUR.lng
    });
    const supplierProfileB = await createSupplier(baseUrl, supplierB.token, {
      companyName: `CRUD Supplier B ${ts}`,
      contactEmail: `crud_supplier_b_${ts}@example.com`,
      latitude: HSR.lat,
      longitude: HSR.lng
    });
    assert(!!restaurantA.restaurantId && !!supplierProfileA.supplierId, 'Profiles created for both roles');

    // ------------------------------------------------------------------
    console.log('--- 2. Restaurant update ---');
    const renamed = await request(baseUrl, 'PATCH', `/api/restaurants/${restaurantA.restaurantId}`, {
      businessName: `Renamed Kitchen ${ts}`,
      walletBalance: 7500,
      addressText: 'New address, Indiranagar'
    }, kitchenA.token);
    assert(renamed.status === 200, 'Owner can update a restaurant profile (HTTP 200)');
    assert(renamed.body.data.businessName === `Renamed Kitchen ${ts}`, 'businessName is updated');
    assert(renamed.body.data.walletBalance === '7500.00', 'walletBalance is updated');

    const afterRename = await request(baseUrl, 'GET', `/api/restaurants/${restaurantA.restaurantId}`);
    assert(afterRename.body.data.businessName === `Renamed Kitchen ${ts}`, 'GET reflects the updated name');
    assert(afterRename.body.data.location.latitude === INDIRANAGAR.lat, 'Location is unchanged when coordinates are omitted');

    const moved = await request(baseUrl, 'PATCH', `/api/restaurants/${restaurantA.restaurantId}`, {
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng
    }, kitchenA.token);
    assert(moved.status === 200, 'Owner can move a restaurant (HTTP 200)');

    const afterMove = await request(baseUrl, 'GET', `/api/restaurants/${restaurantA.restaurantId}`);
    assert(
      Math.abs(afterMove.body.data.location.latitude - KORAMANGALA.lat) < 0.000001,
      'New coordinates are stored via ST_GeomFromText'
    );

    const otherOwner = await request(baseUrl, 'PATCH', `/api/restaurants/${restaurantA.restaurantId}`, {
      businessName: 'Hijacked'
    }, kitchenB.token);
    assert(otherOwner.status === 403, 'Another kitchen cannot edit the profile (HTTP 403)');

    const halfCoords = await request(baseUrl, 'PATCH', `/api/restaurants/${restaurantA.restaurantId}`, {
      latitude: 12.9
    }, kitchenA.token);
    assert(halfCoords.status === 400 && halfCoords.body.error.code === 'INVALID_COORDINATES', 'Partial coordinates rejected (HTTP 400)');

    const badWallet = await request(baseUrl, 'PATCH', `/api/restaurants/${restaurantA.restaurantId}`, {
      walletBalance: -10
    }, kitchenA.token);
    assert(badWallet.status === 400, 'Negative wallet balance rejected (HTTP 400)');

    // ------------------------------------------------------------------
    console.log('--- 3. Restaurant deletion ---');
    const deleteB = await request(baseUrl, 'DELETE', `/api/restaurants/${restaurantB.restaurantId}`, null, kitchenB.token);
    assert(deleteB.status === 200, 'Owner can delete an unused restaurant profile');

    const gone = await request(baseUrl, 'GET', `/api/restaurants/${restaurantB.restaurantId}`);
    assert(gone.status === 404, 'Deleted restaurant is no longer readable');

    // ------------------------------------------------------------------
    console.log('--- 4. Supplier update ---');
    const newEmail = `crud_supplier_a_updated_${ts}@example.com`;
    const supplierUpdated = await request(baseUrl, 'PATCH', `/api/suppliers/${supplierProfileA.supplierId}`, {
      companyName: `Renamed Supplier ${ts}`,
      contactEmail: newEmail,
      latitude: 12.955,
      longitude: 77.64
    }, supplierA.token);
    assert(supplierUpdated.status === 200, 'Owner can update a supplier profile (HTTP 200)');
    assert(supplierUpdated.body.data.companyName === `Renamed Supplier ${ts}`, 'companyName is updated');
    assert(supplierUpdated.body.data.contactEmail === newEmail, 'contactEmail is updated');

    const duplicateEmail = await request(baseUrl, 'PATCH', `/api/suppliers/${supplierProfileA.supplierId}`, {
      contactEmail: supplierProfileB.contactEmail
    }, supplierA.token);
    assert(duplicateEmail.status === 409 && duplicateEmail.body.error.code === 'DUPLICATE_EMAIL', 'Duplicate contact email rejected (HTTP 409)');

    const kitchenPatchSupplier = await request(baseUrl, 'PATCH', `/api/suppliers/${supplierProfileA.supplierId}`, {
      companyName: 'Nope'
    }, kitchenA.token);
    assert(kitchenPatchSupplier.status === 403, 'Kitchen role cannot edit a supplier profile (HTTP 403)');

    // ------------------------------------------------------------------
    console.log('--- 5. RESTRICT-aware deletions ---');
    const product = await createProduct(baseUrl, supplierA.token, {
      productName: `CRUD Ingredient ${ts}`,
      unitOfMeasure: 'kg',
      category: 'Produce'
    });
    const offer = await createOffer(baseUrl, supplierA.token, {
      productId: product.productId,
      pricePerUnit: 20,
      minOrderQty: 500
    });

    const deleteSupplierInUse = await request(baseUrl, 'DELETE', `/api/suppliers/${supplierProfileA.supplierId}`, null, supplierA.token);
    assert(
      deleteSupplierInUse.status === 409 && deleteSupplierInUse.body.error.code === 'SUPPLIER_IN_USE',
      'Supplier with catalogue offers cannot be deleted (HTTP 409)'
    );

    const pool = await createPool(baseUrl, supplierA.token, {
      catalogueId: offer.catalogueId,
      latitude: KORAMANGALA.lat,
      longitude: KORAMANGALA.lng,
      durationDays: 7
    });
    const order = await placeOrder(baseUrl, kitchenA.token, {
      poolId: pool.poolId,
      requestedQty: 100
    });
    assert(order.status === 201, 'Kitchen places an order so the profile is referenced');

    const deleteRestaurantInUse = await request(baseUrl, 'DELETE', `/api/restaurants/${restaurantA.restaurantId}`, null, kitchenA.token);
    assert(
      deleteRestaurantInUse.status === 409 && deleteRestaurantInUse.body.error.code === 'RESTAURANT_IN_USE',
      'Restaurant with micro-orders cannot be deleted (HTTP 409)'
    );

    const deleteSupplierB = await request(baseUrl, 'DELETE', `/api/suppliers/${supplierProfileB.supplierId}`, null, supplierB.token);
    assert(deleteSupplierB.status === 200, 'Supplier without offers can be deleted');

    console.log('\n🎉 PROFILE CRUD TESTS PASSED 100%!');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

run().catch((error) => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});
