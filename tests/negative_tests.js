// ============================================================================
// File: tests/negative_tests.js
// Owner: Dhruv (Database & Auth)
// Purpose: Day 15 Testing & Hardening Suite covering negative tests, auth
//          validation, RBAC guards, 404s, constraint conflicts, order history,
//          and payment status transitions.
// Run with: node tests/negative_tests.js
// ============================================================================

const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: rawData });
          }
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASSED: ${message}`);
}

async function runNegativeTests() {
  console.log('🧪 [CoBuy Hardening] Starting Day 15 Negative & Security Test Suite...\n');

  // Start test server on dynamic port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ------------------------------------------------------------------------
    // TEST SUITE 1: System & 404 Routing
    // ------------------------------------------------------------------------
    console.log('--- 1. Testing System & 404 Envelope ---');
    const notFoundRes = await request('GET', '/api/nonexistent-route-xyz');
    assert(notFoundRes.status === 404, 'Unknown endpoint returns HTTP 404');
    assert(notFoundRes.body.success === false, 'Error envelope has success: false');
    assert(notFoundRes.body.error.code === 'ROUTE_NOT_FOUND', 'Error code is ROUTE_NOT_FOUND');

    // ------------------------------------------------------------------------
    // TEST SUITE 2: Authentication Failures & Invalid Tokens
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Authentication & Token Failures ---');

    // Missing token
    const noTokenRes = await request('GET', '/api/restaurants/me');
    assert(noTokenRes.status === 401, 'Protected route without token returns HTTP 401');
    assert(noTokenRes.body.error.code === 'AUTH_REQUIRED', 'Error code is AUTH_REQUIRED');

    // Invalid / Garbage token
    const badTokenRes = await request('GET', '/api/restaurants/me', null, 'garbage-invalid-token');
    assert(badTokenRes.status === 401, 'Protected route with forged token returns HTTP 401');
    assert(badTokenRes.body.error.code === 'INVALID_TOKEN', 'Error code is INVALID_TOKEN');

    // Invalid login credentials
    const badLoginRes = await request('POST', '/api/users/login', {
      email: 'nonexistent@cobuy.test',
      password: 'wrongpassword'
    });
    assert(badLoginRes.status === 401, 'Bad credentials return HTTP 401');
    assert(badLoginRes.body.error.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');

    // ------------------------------------------------------------------------
    // TEST SUITE 3: RBAC Role Guards
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing RBAC Role Guards (Kitchen vs Supplier) ---');

    const timestamp = Date.now();
    // Register a kitchen owner
    const kitchenUser = {
      username: `k_test_${timestamp}`,
      email: `kitchen_${timestamp}@cobuy.test`,
      password: 'password123',
      roles: ['restaurant_owner']
    };
    const regK = await request('POST', '/api/users/register', kitchenUser);
    assert(regK.status === 201, 'Kitchen owner registration succeeds');

    const logK = await request('POST', '/api/users/login', {
      email: kitchenUser.email,
      password: kitchenUser.password
    });
    const kitchenToken = logK.body.data.token;

    // Register a supplier
    const supplierUser = {
      username: `s_test_${timestamp}`,
      email: `supplier_${timestamp}@cobuy.test`,
      password: 'password123',
      roles: ['supplier']
    };
    const regS = await request('POST', '/api/users/register', supplierUser);
    assert(regS.status === 201, 'Supplier registration succeeds');

    const logS = await request('POST', '/api/users/login', {
      email: supplierUser.email,
      password: supplierUser.password
    });
    const supplierToken = logS.body.data.token;

    // Supplier attempting to create a restaurant profile -> 403
    const supplierCreateRest = await request(
      'POST',
      '/api/restaurants',
      {
        businessName: 'Illegal Kitchen',
        latitude: 12.9716,
        longitude: 77.5946
      },
      supplierToken
    );
    assert(supplierCreateRest.status === 403, 'Supplier cannot create restaurant profile (HTTP 403)');
    assert(supplierCreateRest.body.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Kitchen owner attempting to create a supplier profile -> 403
    const kitchenCreateSup = await request(
      'POST',
      '/api/suppliers',
      {
        companyName: 'Illegal Supplier Co',
        contactEmail: `illegal_${timestamp}@supplier.test`,
        latitude: 12.9600,
        longitude: 77.6300
      },
      kitchenToken
    );
    assert(kitchenCreateSup.status === 403, 'Kitchen owner cannot create supplier profile (HTTP 403)');
    assert(kitchenCreateSup.body.error.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Supplier attempting to call kitchen orders history -> 403
    const supMyOrders = await request('GET', '/api/orders/my', null, supplierToken);
    assert(supMyOrders.status === 403, 'Supplier cannot access kitchen my-orders endpoint (HTTP 403)');

    // ------------------------------------------------------------------------
    // TEST SUITE 4: Order Creation, Proximity & Constraint Hardening
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Order Creation & Constraints ---');

    // Create valid kitchen profile (Indiranagar, Bangalore)
    const restRes = await request(
      'POST',
      '/api/restaurants',
      {
        businessName: `Audit Kitchen ${timestamp}`,
        latitude: 12.9716,
        longitude: 77.5946,
        addressText: 'Indiranagar 100ft Road'
      },
      kitchenToken
    );
    assert(restRes.status === 201, 'Restaurant profile created successfully');
    const restaurantId = restRes.body.data.restaurantId;

    // Find an active pool to order on
    const discoveryRes = await request(
      'GET',
      '/api/pools/discover?latitude=12.9716&longitude=77.5946',
      null,
      kitchenToken
    );
    assert(discoveryRes.status === 200, 'Pool discovery within 5 km succeeds');
    const activePool = discoveryRes.body.data[0];
    assert(!!activePool, 'At least one active buying pool exists in cluster');
    const targetPoolId = activePool.poolId;

    // Negative: Negative / Zero quantity order
    const negQtyRes = await request(
      'POST',
      '/api/orders',
      {
        poolId: targetPoolId,
        restaurantId,
        requestedQty: -50
      },
      kitchenToken
    );
    assert(negQtyRes.status === 400, 'Negative order quantity is rejected (HTTP 400)');
    assert(negQtyRes.body.error.code === 'INVALID_QUANTITY', 'Error code is INVALID_QUANTITY');

    // Negative: Non-existent pool ID
    const badPoolRes = await request(
      'POST',
      '/api/orders',
      {
        poolId: '00000000-0000-0000-0000-000000000000',
        restaurantId,
        requestedQty: 100
      },
      kitchenToken
    );
    assert(badPoolRes.status === 404, 'Non-existent pool ID returns HTTP 404');
    assert(badPoolRes.body.error.code === 'POOL_NOT_FOUND', 'Error code is POOL_NOT_FOUND');

    // Positive: Valid micro-order placement
    const orderRes = await request(
      'POST',
      '/api/orders',
      {
        poolId: targetPoolId,
        restaurantId,
        requestedQty: 50.0
      },
      kitchenToken
    );
    assert(orderRes.status === 201, 'Valid micro-order placed successfully (HTTP 201)');
    assert(orderRes.body.data.paymentStatus === 'PENDING', 'Initial payment status is PENDING');
    const orderId = orderRes.body.data.orderId;

    // Negative: Duplicate order in the same pool (UNIQUE(pool_id, restaurant_id))
    const dupOrderRes = await request(
      'POST',
      '/api/orders',
      {
        poolId: targetPoolId,
        restaurantId,
        requestedQty: 25.0
      },
      kitchenToken
    );
    assert(dupOrderRes.status === 409, 'Duplicate micro-order in same pool rejected with HTTP 409');
    assert(dupOrderRes.body.error.code === 'ALREADY_ORDERED', 'Error code is ALREADY_ORDERED');

    // ------------------------------------------------------------------------
    // TEST SUITE 5: Order History Queries (Day 10)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing Order History Endpoints ---');

    const historyRes = await request('GET', '/api/orders/my', null, kitchenToken);
    assert(historyRes.status === 200, 'Kitchen owner can retrieve order history (HTTP 200)');
    assert(Array.isArray(historyRes.body.data), 'Order history returns array');
    const foundOrder = historyRes.body.data.find((o) => o.orderId === orderId);
    assert(!!foundOrder, 'Recently placed micro-order is in history');
    assert(foundOrder.requestedQty === 50, 'History contains accurate requested quantity');

    // ------------------------------------------------------------------------
    // TEST SUITE 6: Payment Status Transitions (Day 10)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Payment Status Transitions ---');

    // Negative: Invalid payment status value (e.g. 'REFUNDED')
    const invalidPayStatus = await request(
      'PATCH',
      `/api/orders/${orderId}/payment`,
      { paymentStatus: 'REFUNDED' },
      kitchenToken
    );
    assert(invalidPayStatus.status === 400, 'Invalid payment status value rejected with HTTP 400');
    assert(invalidPayStatus.body.error.code === 'INVALID_PAYMENT_STATUS', 'Code is INVALID_PAYMENT_STATUS');

    // Positive: Order owner transitions PENDING -> PAID
    const payRes = await request(
      'PATCH',
      `/api/orders/${orderId}/payment`,
      { paymentStatus: 'PAID' },
      kitchenToken
    );
    assert(payRes.status === 200, 'Payment status updated to PAID successfully (HTTP 200)');
    assert(payRes.body.data.paymentStatus === 'PAID', 'Updated order has paymentStatus: PAID');

    // Verify in order history
    const historyAfterPay = await request('GET', '/api/orders/my', null, kitchenToken);
    const updatedHistoryOrder = historyAfterPay.body.data.find((o) => o.orderId === orderId);
    assert(updatedHistoryOrder.paymentStatus === 'PAID', 'Order history reflects settled PAID status');

    console.log('\n🎉 ALL NEGATIVE, SECURITY & VALIDATION TESTS PASSED 100%!\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runNegativeTests().catch((err) => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});
