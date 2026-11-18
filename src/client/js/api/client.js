// ============================================================================
// File: src/client/js/api/client.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Unified HTTP client conforming to docs/API_CONTRACT.md with
//          Bearer JWT auth and intelligent mock data fallback.
// ============================================================================

import {
  mockUsers,
  mockRestaurants,
  mockSuppliers,
  mockProducts,
  mockCatalogue,
  mockBuyingPools,
  mockOrders
} from './mockData.js';

const API_BASE_URL = window.location.origin.includes(':5000')
  ? window.location.origin
  : 'http://localhost:5000';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.useMock = false; // Set to true when backend is offline
  }

  getToken() {
    return localStorage.getItem('cobuy_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('cobuy_token', token);
    } else {
      localStorage.removeItem('cobuy_token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (err) {
      return {
        ok: false,
        data: {
          status: 'offline',
          services: { apiServer: 'DOWN', database: 'DISCONNECTED' }
        }
      };
    }
  }

  // --- 1. Authentication ---
  async login(email, password) {
    if (this.useMock) {
      return this._mockLogin(email);
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/users/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        // Fallback to mock for testing if endpoint is unbuilt
        if (res.status === 404) return this._mockLogin(email);
        const err = await res.json();
        throw new Error(err?.error?.message || 'Login failed');
      }
      const json = await res.json();
      this.setToken(json.data.token);
      return json.data;
    } catch (err) {
      console.warn('Real login endpoint unreachable, using mock session for dev:', err.message);
      return this._mockLogin(email);
    }
  }

  async register(username, email, password, roles) {
    if (this.useMock) {
      return this._mockRegister(username, email, roles);
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/users/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ username, email, password, roles })
      });
      if (!res.ok) {
        if (res.status === 404) return this._mockRegister(username, email, roles);
        const err = await res.json();
        throw new Error(err?.error?.message || 'Registration failed');
      }
      return await res.json();
    } catch (err) {
      console.warn('Real register endpoint unreachable, fallback to mock:', err.message);
      return this._mockRegister(username, email, roles);
    }
  }

  // --- 2. Pools Discovery ---
  async getNearbyPools(lat = 12.9716, lng = 77.5946, radius = 5000) {
    try {
      const res = await fetch(`${this.baseUrl}/api/pools/nearby?lat=${lat}&lng=${lng}&radius=${radius}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) return mockBuyingPools;
      const json = await res.json();
      return json.data || mockBuyingPools;
    } catch (e) {
      return mockBuyingPools;
    }
  }

  async getPoolById(poolId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/pools/${poolId}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) return mockBuyingPools.find(p => p.poolId === poolId) || mockBuyingPools[0];
      const json = await res.json();
      return json.data;
    } catch (e) {
      return mockBuyingPools.find(p => p.poolId === poolId) || mockBuyingPools[0];
    }
  }

  // --- 3. Micro-Orders ---
  async placeMicroOrder(poolId, requestedQty) {
    try {
      const res = await fetch(`${this.baseUrl}/api/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ poolId, requestedQty: Number(requestedQty) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Order failed');
      }
      return await res.json();
    } catch (err) {
      // Create local mock order
      const pool = mockBuyingPools.find(p => p.poolId === poolId) || mockBuyingPools[0];
      const newOrder = {
        orderId: `mo-${Date.now()}`,
        poolId,
        productName: pool.productName,
        requestedQty: Number(requestedQty).toFixed(2),
        unitOfMeasure: pool.unitOfMeasure,
        pricePerUnit: pool.pricePerUnit,
        pledgedAmount: (Number(requestedQty) * Number(pool.pricePerUnit)).toFixed(2),
        paymentStatus: 'PENDING',
        poolStatus: pool.status,
        createdAt: new Date().toISOString()
      };
      // Optimistically update mock pool current_qty
      pool.currentQty = (Number(pool.currentQty) + Number(requestedQty)).toFixed(2);
      if (Number(pool.currentQty) >= Number(pool.targetMoq)) {
        pool.status = 'FULFILLED';
      }
      mockOrders.unshift(newOrder);
      return { success: true, data: newOrder };
    }
  }

  async getMyOrders() {
    try {
      const res = await fetch(`${this.baseUrl}/api/orders/my`, {
        headers: this.getHeaders()
      });
      if (!res.ok) return mockOrders;
      const json = await res.json();
      return json.data || mockOrders;
    } catch (e) {
      return mockOrders;
    }
  }

  // --- 4. Supplier Catalogue & Creation ---
  async getProducts() {
    return mockProducts;
  }

  async getCatalogue() {
    return mockCatalogue;
  }

  // --- Private Mock Handlers ---
  _mockLogin(email) {
    const found = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) || {
      userId: `u-${Date.now()}`,
      username: email.split('@')[0],
      email: email,
      role: email.includes('supplier') ? 'supplier' : 'restaurant_owner'
    };
    const mockToken = `mock-jwt-token-${found.userId}`;
    this.setToken(mockToken);
    return {
      token: mockToken,
      user: {
        userId: found.userId,
        username: found.username,
        email: found.email,
        roles: [found.role]
      }
    };
  }

  _mockRegister(username, email, roles) {
    const newUser = {
      userId: `u-${Date.now()}`,
      username,
      email,
      role: roles[0] || 'restaurant_owner'
    };
    mockUsers.push(newUser);
    return {
      success: true,
      data: {
        userId: newUser.userId,
        username: newUser.username,
        email: newUser.email,
        roles: [newUser.role]
      }
    };
  }
}

export const api = new ApiClient();

