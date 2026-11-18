// ============================================================================
// File: src/client/js/api/mockData.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Seed fixtures matching docs/PROJECT_CONTEXT.md & docs/API_CONTRACT.md
// ============================================================================

export const mockUsers = [
  {
    userId: 'u1111111-aaaa-bbbb-cccc-111111111111',
    username: 'kitchen_a',
    email: 'kitchen.a@example.com',
    role: 'restaurant_owner'
  },
  {
    userId: 'u2222222-aaaa-bbbb-cccc-222222222222',
    username: 'fresh_foods_admin',
    email: 'sales@freshfoods.com',
    role: 'supplier'
  }
];

export const mockRestaurants = [
  {
    restaurantId: 'r1111111-1111-1111-1111-111111111111',
    ownerId: 'u1111111-aaaa-bbbb-cccc-111111111111',
    businessName: 'Spicy Bowl Cloud Kitchen A',
    addressText: 'Indiranagar 100ft Road, Bangalore',
    latitude: 12.9716,
    longitude: 77.5946,
    walletBalance: '15000.00'
  }
];

export const mockSuppliers = [
  {
    supplierId: 's1111111-1111-1111-1111-111111111111',
    userId: 'u2222222-aaaa-bbbb-cccc-222222222222',
    companyName: 'Fresh Foods Wholesale Ltd.',
    contactEmail: 'sales@freshfoods.com',
    latitude: 12.9720,
    longitude: 77.5950
  }
];

export const mockProducts = [
  {
    productId: 'p1111111-1111-1111-1111-111111111111',
    name: 'Fresh Hybrid Tomatoes',
    unitOfMeasure: 'kg'
  },
  {
    productId: 'p2222222-2222-2222-2222-222222222222',
    name: 'Nashik Red Onions',
    unitOfMeasure: 'kg'
  },
  {
    productId: 'p3333333-3333-3333-3333-333333333333',
    name: 'Refined Sunflower Cooking Oil',
    unitOfMeasure: 'litre'
  }
];

export const mockCatalogue = [
  {
    catalogueId: 'c1111111-1111-1111-1111-111111111111',
    supplierId: 's1111111-1111-1111-1111-111111111111',
    supplierName: 'Fresh Foods Wholesale Ltd.',
    productId: 'p1111111-1111-1111-1111-111111111111',
    productName: 'Fresh Hybrid Tomatoes',
    unitOfMeasure: 'kg',
    pricePerUnit: '20.00',
    minOrderQty: '500.00'
  },
  {
    catalogueId: 'c2222222-2222-2222-2222-222222222222',
    supplierId: 's1111111-1111-1111-1111-111111111111',
    supplierName: 'Fresh Foods Wholesale Ltd.',
    productId: 'p2222222-2222-2222-2222-222222222222',
    productName: 'Nashik Red Onions',
    unitOfMeasure: 'kg',
    pricePerUnit: '25.00',
    minOrderQty: '400.00'
  }
];

export const mockBuyingPools = [
  {
    poolId: 'bp010000-0000-0000-0000-000000000001',
    catalogueId: 'c1111111-1111-1111-1111-111111111111',
    productName: 'Fresh Hybrid Tomatoes',
    unitOfMeasure: 'kg',
    supplierName: 'Fresh Foods Wholesale Ltd.',
    pricePerUnit: '20.00',
    targetMoq: '500.00',
    currentQty: '350.00',
    status: 'ACTIVE',
    distanceMeters: 1850,
    geographicZone: { latitude: 12.9716, longitude: 77.5946 },
    expirationTime: new Date(Date.now() + 86400000 * 3).toISOString() // 3 days left
  },
  {
    poolId: 'bp020000-0000-0000-0000-000000000002',
    catalogueId: 'c2222222-2222-2222-2222-222222222222',
    productName: 'Nashik Red Onions',
    unitOfMeasure: 'kg',
    supplierName: 'Fresh Foods Wholesale Ltd.',
    pricePerUnit: '25.00',
    targetMoq: '400.00',
    currentQty: '400.00',
    status: 'FULFILLED',
    distanceMeters: 3100,
    geographicZone: { latitude: 12.9750, longitude: 77.5980 },
    expirationTime: new Date(Date.now() + 86400000 * 1).toISOString()
  },
  {
    poolId: 'bp030000-0000-0000-0000-000000000003',
    catalogueId: 'c1111111-1111-1111-1111-111111111111',
    productName: 'Refined Sunflower Cooking Oil',
    unitOfMeasure: 'litre',
    supplierName: 'Green Basket Suppliers',
    pricePerUnit: '110.00',
    targetMoq: '200.00',
    currentQty: '60.00',
    status: 'ACTIVE',
    distanceMeters: 4200,
    geographicZone: { latitude: 12.9690, longitude: 77.5900 },
    expirationTime: new Date(Date.now() + 86400000 * 5).toISOString()
  }
];

export const mockOrders = [
  {
    orderId: 'mo111111-1111-1111-1111-111111111111',
    poolId: 'bp010000-0000-0000-0000-000000000001',
    productName: 'Fresh Hybrid Tomatoes',
    restaurantId: 'r1111111-1111-1111-1111-111111111111',
    requestedQty: '200.00',
    unitOfMeasure: 'kg',
    pricePerUnit: '20.00',
    pledgedAmount: '4000.00',
    paymentStatus: 'PAID',
    poolStatus: 'ACTIVE',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

