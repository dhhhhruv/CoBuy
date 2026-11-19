// ============================================================================
// File: src/client/js/api/client.js
// Owner: Debangshu (Frontend Lead)
// Purpose: HTTP client for docs/API_CONTRACT.md. Same-origin requests, Bearer
//          access tokens, automatic refresh-token rotation on 401, and
//          response normalisation so pages never depend on backend nesting.
// ============================================================================

const API_BASE_URL = window.location.protocol.startsWith('http')
  ? window.location.origin
  : 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProduct(product) {
  return {
    productId: product.productId,
    productName: product.productName || product.name || '',
    unitOfMeasure: product.unitOfMeasure || '',
    category: product.category || '',
    supplierOfferCount: product.supplierOfferCount ?? 0
  };
}

function normalizeOffer(offer) {
  return {
    catalogueId: offer.catalogueId,
    supplierId: offer.supplierId,
    supplierName: offer.supplierName || '',
    productId: offer.productId,
    productName: offer.productName || '',
    unitOfMeasure: offer.unitOfMeasure || '',
    category: offer.category || '',
    pricePerUnit: num(offer.pricePerUnit),
    minOrderQty: num(offer.minOrderQty)
  };
}

function normalizeOrder(order, pool = null) {
  const product = pool?.product || {};
  return {
    orderId: order.orderId,
    poolId: order.poolId,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName || '',
    productName: order.productName || product.productName || '',
    supplierName: order.supplierName || '',
    unitOfMeasure: order.unitOfMeasure || product.unitOfMeasure || '',
    pricePerUnit: num(order.pricePerUnit, num(pool?.pricePerUnit)),
    requestedQty: num(order.requestedQty),
    pledgedAmount: num(order.pledgedAmount),
    paymentStatus: order.paymentStatus || 'PENDING',
    poolStatus: order.poolStatus || pool?.status || '',
    poolCurrentQty: order.poolCurrentQty === undefined ? null : num(order.poolCurrentQty),
    poolTargetMoq: order.poolTargetMoq === undefined ? null : num(order.poolTargetMoq),
    createdAt: order.createdAt
  };
}

function normalizePool(pool) {
  const product = pool.product || {};
  const supplier = pool.supplier || {};
  const normalized = {
    poolId: pool.poolId,
    catalogueId: pool.catalogueId,
    status: pool.status,
    productId: product.productId || pool.productId,
    productName: product.productName || pool.productName || '',
    unitOfMeasure: product.unitOfMeasure || pool.unitOfMeasure || '',
    category: product.category || '',
    supplierId: supplier.supplierId || pool.supplierId,
    supplierName: supplier.companyName || pool.supplierName || '',
    pricePerUnit: num(pool.pricePerUnit),
    targetMoq: num(pool.targetMoq),
    currentQty: num(pool.currentQty),
    progressPercentage: num(pool.progressPercentage),
    expirationTime: pool.expirationTime || null,
    distanceMeters: pool.distanceMeters === null || pool.distanceMeters === undefined
      ? null
      : num(pool.distanceMeters),
    isEligible: pool.isEligible !== false,
    participantCount: pool.participantCount ?? (pool.orders ? pool.orders.length : 0),
    supplierContactEmail: pool.supplierContactEmail || '',
    orders: []
  };

  normalized.orders = (pool.orders || []).map((order) => normalizeOrder(order, normalized));
  return normalized;
}

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('cobuy_token');
  }

  getRefreshToken() {
    return localStorage.getItem('cobuy_refresh_token');
  }

  setTokens({ token, accessToken, refreshToken } = {}) {
    const access = accessToken || token;
    if (access) localStorage.setItem('cobuy_token', access);
    else if (access === null) localStorage.removeItem('cobuy_token');

    if (refreshToken) localStorage.setItem('cobuy_refresh_token', refreshToken);
    else if (refreshToken === null) localStorage.removeItem('cobuy_refresh_token');
  }

  clearTokens() {
    localStorage.removeItem('cobuy_token');
    localStorage.removeItem('cobuy_refresh_token');
  }

  buildHeaders(withAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (withAuth && token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const encoded = query.toString();
    return encoded ? `?${encoded}` : '';
  }

  /**
   * Single request path for every endpoint.
   * On 401 it rotates the refresh token once and replays the request.
   */
  async request(path, { method = 'GET', body, auth = true, retry = true } = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.buildHeaders(auth),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error) {
      throw new ApiError(
        'Cannot reach the CoBuy API. Start the backend with "npm start".',
        { code: 'NETWORK_ERROR' }
      );
    }

    if (response.status === 401 && auth && retry && this.getRefreshToken()) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        return this.request(path, { method, body, auth, retry: false });
      }
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      const apiError = payload?.error || {};
      if (response.status === 401 && auth) {
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('cobuy:session-expired'));
      }
      throw new ApiError(apiError.message || `Request failed (HTTP ${response.status})`, {
        status: response.status,
        code: apiError.code || 'REQUEST_FAILED',
        details: apiError.details || null
      });
    }

    return payload ? payload.data : null;
  }

  async refreshSession() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/users/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) return false;

      const payload = await response.json();
      this.setTokens({
        accessToken: payload.data.accessToken || payload.data.token,
        refreshToken: payload.data.refreshToken
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // --- Health ---------------------------------------------------------------
  /**
   * GET /health is intentionally outside the {data} envelope, so it is parsed
   * directly instead of going through request().
   */
  async getHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      const payload = await response.json();
      return {
        status: payload.status || (response.ok ? 'healthy' : 'degraded'),
        database: payload.services?.database || 'UNKNOWN',
        apiServer: payload.services?.apiServer || 'UNKNOWN',
        uptimeSeconds: payload.uptimeSeconds ?? null,
        databaseError: payload.databaseError || null,
        httpStatus: response.status
      };
    } catch (error) {
      throw new ApiError('Cannot reach the CoBuy API.', { code: 'NETWORK_ERROR' });
    }
  }

  // --- Authentication -------------------------------------------------------
  async login(email, password) {
    const data = await this.request('/api/users/login', {
      method: 'POST',
      auth: false,
      body: { email, password }
    });
    this.setTokens({ token: data.accessToken || data.token, refreshToken: data.refreshToken });
    return data;
  }

  async register(username, email, password, roles) {
    return this.request('/api/users/register', {
      method: 'POST',
      auth: false,
      body: { username, email, password, roles }
    });
  }

  async getMe() {
    const data = await this.request('/api/users/me');
    return data.user;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await this.request('/api/users/logout', {
          method: 'POST',
          auth: false,
          body: { refreshToken }
        });
      } catch (error) {
        // Local sign-out must succeed even if the revoke call fails.
      }
    }
    this.clearTokens();
  }

  // --- Profiles ------------------------------------------------------------
  async getMyRestaurants() {
    return this.request('/api/restaurants/me');
  }

  async createRestaurant(payload) {
    return this.request('/api/restaurants', { method: 'POST', body: payload });
  }

  async updateRestaurant(restaurantId, payload) {
    return this.request(`/api/restaurants/${restaurantId}`, { method: 'PATCH', body: payload });
  }

  async deleteRestaurant(restaurantId) {
    return this.request(`/api/restaurants/${restaurantId}`, { method: 'DELETE' });
  }

  async getMySupplier() {
    try {
      return await this.request('/api/suppliers/me');
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async createSupplier(payload) {
    return this.request('/api/suppliers', { method: 'POST', body: payload });
  }

  async updateSupplier(supplierId, payload) {
    return this.request(`/api/suppliers/${supplierId}`, { method: 'PATCH', body: payload });
  }

  async deleteSupplier(supplierId) {
    return this.request(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
  }

  // --- Products & catalogue ------------------------------------------------
  async getProducts() {
    const products = await this.request('/api/products', { auth: false });
    return products.map(normalizeProduct);
  }

  async createProduct(payload) {
    const product = await this.request('/api/products', { method: 'POST', body: payload });
    return normalizeProduct(product);
  }

  async updateProduct(productId, payload) {
    const product = await this.request(`/api/products/${productId}`, { method: 'PATCH', body: payload });
    return normalizeProduct(product);
  }

  async deleteProduct(productId) {
    return this.request(`/api/products/${productId}`, { method: 'DELETE' });
  }

  async getCatalogue(params = {}) {
    const offers = await this.request(`/api/catalogue${this.buildQuery(params)}`, { auth: false });
    return offers.map(normalizeOffer);
  }

  async getMyCatalogue() {
    const offers = await this.request('/api/catalogue/me');
    return offers.map(normalizeOffer);
  }

  async createOffer(payload) {
    const offer = await this.request('/api/catalogue', { method: 'POST', body: payload });
    return normalizeOffer(offer);
  }

  async updateOffer(catalogueId, payload) {
    const offer = await this.request(`/api/catalogue/${catalogueId}`, { method: 'PATCH', body: payload });
    return normalizeOffer(offer);
  }

  async deleteOffer(catalogueId) {
    return this.request(`/api/catalogue/${catalogueId}`, { method: 'DELETE' });
  }

  // --- Pools ---------------------------------------------------------------
  async getPools(params = {}) {
    const pools = await this.request(`/api/pools${this.buildQuery(params)}`, { auth: false });
    return pools.map(normalizePool);
  }

  async getNearbyPools(lat = 12.9716, lng = 77.5946, radius = 5000, status = 'ACTIVE') {
    const pools = await this.request(
      `/api/pools/nearby${this.buildQuery({ lat, lng, radius, status })}`,
      { auth: false }
    );
    return pools.map(normalizePool);
  }

  async getPoolById(poolId) {
    const pool = await this.request(`/api/pools/${poolId}`, { auth: false });
    return normalizePool(pool);
  }

  async createPool(payload) {
    const pool = await this.request('/api/pools', { method: 'POST', body: payload });
    return normalizePool(pool);
  }

  // --- Micro-orders --------------------------------------------------------
  async placeMicroOrder(poolId, requestedQty) {
    return this.request('/api/orders', {
      method: 'POST',
      body: { poolId, requestedQty: Number(requestedQty) }
    });
  }

  async getMyOrders() {
    const orders = await this.request('/api/orders/my');
    return orders.map((order) => normalizeOrder(order));
  }

  async getPoolOrders(poolId) {
    const data = await this.request(`/api/orders/pool/${poolId}`);
    return {
      ...data,
      orders: (data.orders || []).map((order) => normalizeOrder(order))
    };
  }

  async updatePaymentStatus(orderId, paymentStatus) {
    const order = await this.request(`/api/orders/${orderId}/payment`, {
      method: 'PATCH',
      body: { paymentStatus }
    });
    return normalizeOrder(order);
  }
}

export const api = new ApiClient();
