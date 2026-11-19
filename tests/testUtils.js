// ============================================================================
// File: tests/testUtils.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Shared server, HTTP, assertion and fixture helpers for the
//          catalogue, pool and aggregation test suites.
// ============================================================================

const http = require('http');

function request(baseUrl, method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASSED: ${message}`);
}

function startServer(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function registerUser(baseUrl, { username, email, roles, password = 'password123' }) {
  const res = await request(baseUrl, 'POST', '/api/users/register', {
    username,
    email,
    password,
    roles
  });
  if (res.status !== 201) {
    throw new Error(`Registration failed for ${email}: ${JSON.stringify(res.body)}`);
  }

  const login = await request(baseUrl, 'POST', '/api/users/login', { email, password });
  if (login.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(login.body)}`);
  }

  return {
    userId: res.body.data.userId,
    token: login.body.data.accessToken || login.body.data.token
  };
}

async function createRestaurant(baseUrl, token, { name, latitude, longitude, walletBalance = 5000 }) {
  const res = await request(baseUrl, 'POST', '/api/restaurants', {
    businessName: name,
    latitude,
    longitude,
    walletBalance,
    addressText: 'Test address'
  }, token);

  if (res.status !== 201) {
    throw new Error(`Restaurant creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createSupplier(baseUrl, token, { companyName, contactEmail, latitude, longitude }) {
  const res = await request(baseUrl, 'POST', '/api/suppliers', {
    companyName,
    contactEmail,
    latitude,
    longitude
  }, token);

  if (res.status !== 201) {
    throw new Error(`Supplier creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createProduct(baseUrl, token, { productName, unitOfMeasure = 'kg', category = 'Produce' }) {
  const res = await request(baseUrl, 'POST', '/api/products', {
    productName,
    unitOfMeasure,
    category
  }, token);

  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Product creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createOffer(baseUrl, token, { productId, pricePerUnit, minOrderQty }) {
  const res = await request(baseUrl, 'POST', '/api/catalogue', {
    productId,
    pricePerUnit,
    minOrderQty
  }, token);

  if (res.status !== 201) {
    throw new Error(`Catalogue offer creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function createPool(baseUrl, token, { catalogueId, latitude, longitude, durationDays = 7 }) {
  const res = await request(baseUrl, 'POST', '/api/pools', {
    catalogueId,
    latitude,
    longitude,
    durationDays
  }, token);

  if (res.status !== 201) {
    throw new Error(`Pool creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function placeOrder(baseUrl, token, { poolId, requestedQty }) {
  return request(baseUrl, 'POST', '/api/orders', { poolId, requestedQty }, token);
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

module.exports = {
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
};
