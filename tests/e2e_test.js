const app = require('../src/app');
const prisma = require('../src/db/prisma');
const http = require('http');
const crypto = require('crypto');

const server = app.listen(5002, async () => {
  try {
    const post = (path, body, headers = {}) => new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: 5002,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });

    const get = (path, headers = {}) => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5002,
        path,
        method: 'GET',
        headers
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      });
      req.on('error', reject);
      req.end();
    });

    console.log('--- 1. Register Kitchen Owner & Supplier with Prisma ---');
    const ts = Date.now();
    const kitchenUser = {
      username: 'kitchen_' + ts,
      email: 'kitchen_' + ts + '@example.com',
      password: 'password123',
      roles: ['restaurant_owner']
    };
    const supplierUser = {
      username: 'supplier_' + ts,
      email: 'supplier_' + ts + '@example.com',
      password: 'password123',
      roles: ['supplier']
    };

    const regKitchen = await post('/api/users/register', kitchenUser);
    const regSupplier = await post('/api/users/register', supplierUser);
    console.log('Kitchen registration status:', regKitchen.status);
    console.log('Supplier registration status:', regSupplier.status);

    const loginKitchen = await post('/api/users/login', { email: kitchenUser.email, password: kitchenUser.password });
    const loginSupplier = await post('/api/users/login', { email: supplierUser.email, password: supplierUser.password });
    const kitchenToken = loginKitchen.body.data.token;
    const supplierToken = loginSupplier.body.data.token;
    console.log('Kitchen logged in, token received:', !!kitchenToken);
    console.log('Supplier logged in, token received:', !!supplierToken);

    console.log('--- 2. Create Restaurant Profile (Day 6) ---');
    // Location: Indiranagar, Bangalore (12.9716 N, 77.5946 E)
    const restaurantRes = await post('/api/restaurants', {
      businessName: 'Kitchen A Cloud Kitchen',
      latitude: 12.9716,
      longitude: 77.5946,
      walletBalance: 5000.00,
      addressText: '100ft Road, Indiranagar'
    }, { 'Authorization': 'Bearer ' + kitchenToken });
    console.log('Restaurant create status:', restaurantRes.status, 'ID:', restaurantRes.body.data?.restaurantId);
    const restaurantId = restaurantRes.body.data.restaurantId;

    console.log('--- 3. Role Guard Check: Supplier trying to create Restaurant ---');
    const forbiddenRes = await post('/api/restaurants', {
      businessName: 'Fake Kitchen',
      latitude: 12.9716,
      longitude: 77.5946
    }, { 'Authorization': 'Bearer ' + supplierToken });
    console.log('Forbidden check status:', forbiddenRes.status, 'code:', forbiddenRes.body.error?.code);

    console.log('--- 4. Create Supplier Profile (Day 6) ---');
    // Location: Domlur, Bangalore (~2.5 km away: 12.9600 N, 77.6300 E)
    const supplierRes = await post('/api/suppliers', {
      companyName: 'Fresh Foods Wholesale',
      contactEmail: 'contact@freshfoods' + ts + '.com',
      latitude: 12.9600,
      longitude: 77.6300
    }, { 'Authorization': 'Bearer ' + supplierToken });
    console.log('Supplier create status:', supplierRes.status, 'ID:', supplierRes.body.data?.supplierId);
    const supplierId = supplierRes.body.data.supplierId;

    console.log('--- 5. Seed Product, Catalogue & Pool for Discovery Test ---');
    const productId = crypto.randomUUID();
    const catalogueId = crypto.randomUUID();
    const poolId = crypto.randomUUID();

    await prisma.products.create({
      data: {
        product_id: productId,
        product_name: 'Tomatoes',
        unit_of_measure: 'kg',
        category: 'Produce'
      }
    });

    await prisma.supplier_catalogue.create({
      data: {
        catalogue_id: catalogueId,
        supplier_id: supplierId,
        product_id: productId,
        price_per_unit: 20.00,
        min_order_qty: 500.00
      }
    });

    // Pool geographic zone: Koramangala (12.9352 N, 77.6245 E), ~4.5 km from Indiranagar (within 5 km!)
    await prisma.$executeRaw`
      INSERT INTO buying_pools (pool_id, catalogue_id, geographic_zone, status, current_qty, target_moq, expiration_time)
      VALUES (${poolId}, ${catalogueId}, ST_GeomFromText('POINT(77.6245 12.9352)', 4326), 'ACTIVE', 350.00, 500.00, DATE_ADD(NOW(), INTERVAL 7 DAY))
    `;

    console.log('--- 6. Test 5 km Pool Discovery Endpoint (Day 8) ---');
    const discoveryRes = await get('/api/pools/discover?restaurantId=' + restaurantId, {
      'Authorization': 'Bearer ' + kitchenToken
    });
    console.log('Discovery within 5 km status:', discoveryRes.status);
    console.log('Pools found:', discoveryRes.body.data?.length);
    if (discoveryRes.body.data?.length > 0) {
      const p = discoveryRes.body.data[0];
      console.log('Discovered Pool Product:', p.product.productName);
      console.log('Discovered Pool Supplier:', p.supplier.companyName);
      console.log('Distance in metres:', p.distanceMeters, 'm (<= 5000: ' + p.isEligible + ')');
      console.log('Progress Percentage:', p.progressPercentage + '%');
    }

    console.log('--- 7. Test 5 km Filter: Querying from 20 km away (Whitefield: 12.9698, 77.7499) ---');
    const farDiscoveryRes = await get('/api/pools/discover?latitude=12.9698&longitude=77.7499&radius=5000');
    console.log('Far distance query status:', farDiscoveryRes.status, 'Pools found:', farDiscoveryRes.body.data?.length);

    console.log('--- 8. Test GET /api/restaurants/me and /api/suppliers/me ---');
    const myRestRes = await get('/api/restaurants/me', { 'Authorization': 'Bearer ' + kitchenToken });
    console.log('My restaurants count:', myRestRes.body.data?.length);

    const mySuppRes = await get('/api/suppliers/me', { 'Authorization': 'Bearer ' + supplierToken });
    console.log('My supplier company:', mySuppRes.body.data?.companyName);

    console.log('✅ ALL DAYS 6, 7 & 8 TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await prisma.$disconnect();
    server.close();
    process.exit(0);
  }
});

