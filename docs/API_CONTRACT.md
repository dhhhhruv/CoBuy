# CoBuy — REST API Contract (v1.0)

> **Shared specification for Backend (Dhruv & Shaaz) and Frontend (Debangshu).**  
> All endpoints use JSON for request and response payloads unless specified otherwise.

---

## 1. General Conventions

- **Base URL:** `http://localhost:5000`
- **Content-Type:** `application/json`
- **Authentication:** Bearer token passed in the `Authorization` header:
  ```http
  Authorization: Bearer <jwt-token>
  ```

### Standard Response Format
Every JSON response adheres to a predictable envelope:

#### Successful Response:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-11-12T11:30:00.000Z"
}
```

#### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Human-readable error description",
    "details": null
  },
  "timestamp": "2026-11-12T11:30:00.000Z"
}
```

### Standard HTTP Status Codes
| Status Code | Meaning | When Used |
|---|---|---|
| `200 OK` | Success | Successful `GET` or non-creating `POST`/`PATCH` |
| `201 Created` | Created | Successful record insertion (`POST`) |
| `400 Bad Request` | Client error | Schema validation failure, negative quantity, missing fields |
| `401 Unauthorized` | Auth missing | Invalid, expired, or missing JWT token |
| `403 Forbidden` | Forbidden | User lacks the required role (`restaurant_owner` or `supplier`) |
| `404 Not Found` | Not found | Requested pool, user, or order does not exist |
| `409 Conflict` | State conflict | Duplicate registration, or kitchen already ordered in this pool |
| `500 Server Error` | Internal error | Uncaught server exception or database connectivity drop |
| `503 Service Unavail`| Unavailable | Database ping failed on `/health` check |

---

## 2. System Endpoints

### `GET /health`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Verifies server uptime and active MySQL connection pool health (`SELECT 1 / ping`).

#### Response: `200 OK` (Healthy)
```json
{
  "status": "healthy",
  "uptimeSeconds": 342,
  "timestamp": "2026-11-12T11:30:00.000Z",
  "services": {
    "apiServer": "UP",
    "database": "CONNECTED"
  }
}
```

#### Response: `503 Service Unavailable` (Degraded)
```json
{
  "status": "degraded",
  "uptimeSeconds": 342,
  "timestamp": "2026-11-12T11:30:00.000Z",
  "services": {
    "apiServer": "UP",
    "database": "DISCONNECTED"
  },
  "databaseError": "connect ECONNREFUSED 127.0.0.1:3306"
}
```

---

## 3. Authentication & User Management (Dhruv's Area)

### `POST /api/users/register`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Creates a new user in `users` and assigns one or more roles in `user_roles`. Passwords are encrypted with `bcrypt` before storage.

#### Request Body:
```json
{
  "username": "kitchen_a",
  "email": "owner@kitchena.com",
  "password": "securePassword123",
  "roles": ["restaurant_owner"]
}
```
*Note: `roles` must be an array containing `'restaurant_owner'` and/or `'supplier'`.*

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "userId": "b4a5f6e8-2d3c-4b5a-9e8f-1a2b3c4d5e6f",
    "username": "kitchen_a",
    "email": "owner@kitchena.com",
    "roles": ["restaurant_owner"],
    "createdAt": "2026-11-12T11:30:00.000Z"
  }
}
```

#### Error: `409 Conflict` (Duplicate username or email)
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_USER",
    "message": "Username or email is already registered"
  }
}
```

---

### `POST /api/users/login`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Verifies password against `password_hash` using bcrypt and returns a signed JWT Bearer token.

#### Request Body:
```json
{
  "email": "owner@kitchena.com",
  "password": "securePassword123"
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7c8b2a3d...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "userId": "b4a5f6e8-2d3c-4b5a-9e8f-1a2b3c4d5e6f",
      "username": "kitchen_a",
      "email": "owner@kitchena.com",
      "roles": ["restaurant_owner"]
    }
  }
}
```

#### Error: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

### `POST /api/users/refresh`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Rotates the refresh token (revokes current, issues new) and provides a new 15-minute JWT Access Token.

#### Request Body:
```json
{
  "refreshToken": "7c8b2a3d..."
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "8d9e0f1a...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

#### Error: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token is invalid, expired, or has been revoked"
  }
}
```

---

### `POST /api/users/logout`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None / Public
- **Description:** Revokes the specified refresh token in the database.

#### Request Body:
```json
{
  "refreshToken": "7c8b2a3d..."
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully. Refresh token revoked."
}
```

---

### `GET /api/users/oauth/authorize`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Initiates OAuth2 / OpenID Connect (OIDC) authorization flow. Returns authorization URL or redirects.
- **Query Parameters:** `provider` (`google`), `role` (`restaurant_owner` / `supplier`), `redirect` (`true` / `false`).

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "state": "eyJjc3JmIjo...",
    "provider": "google"
  }
}
```

---

### `GET /api/users/oauth/callback`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** OAuth2 callback receiving `code` and `state`, performing token exchange and JIT user provisioning.

---

### `POST /api/users/oauth/token`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Direct authorization code exchange endpoint for SPAs.

#### Request Body:
```json
{
  "code": "4/0A...",
  "role": "restaurant_owner"
}
```

#### Response: `200 OK`
Returns `{ token, accessToken, refreshToken, tokenType, expiresIn, user }`.

---

### `POST /api/users/oauth/mock`
- **Owner:** Dhruv (Database & Auth)
- **Auth:** None (Public)
- **Description:** Deterministic OIDC mock sign-in endpoint for offline testing & viva demonstrations.

#### Request Body:
```json
{
  "email": "chef@gmail.com",
  "name": "Chef Demo",
  "role": "restaurant_owner"
}
```

## 4. Product & Catalogue Management (Shaaz's Area)

### `GET /api/products`
- **Owner:** Shaaz (Aggregation Engine)
- **Auth:** Optional / Public
- **Description:** Returns the general list of wholesale ingredients available on CoBuy.

#### Response: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "productId": "p001-uuid",
      "productName": "Tomatoes",
      "unitOfMeasure": "kg",
      "category": "Produce"
    },
    {
      "productId": "p002-uuid",
      "productName": "Onions",
      "unitOfMeasure": "kg",
      "category": "Produce"
    },
    {
      "productId": "p003-uuid",
      "productName": "Cooking Oil",
      "unitOfMeasure": "litre",
      "category": "Oils"
    }
  ]
}
```

### `POST /api/products` · `PATCH /api/products/:id` · `DELETE /api/products/:id`
- **Owner:** Shaaz (Aggregation Engine)
- **Auth:** Required (`supplier`)
- **Description:** Supplies the writable side of the shared PRODUCTS catalogue. Creating a product that already exists by `(product_name, unit_of_measure)` returns `200` with the existing row. Deletion is refused with `409 PRODUCT_IN_USE` while any catalogue offer references it.
- **Body (POST):** `{ "productName": "Tomatoes", "unitOfMeasure": "kg", "category": "Produce" }`
- **Body (PATCH):** any of `productName`, `unitOfMeasure`, `category`.

---

## 4b. Supplier Catalogue Offers (Shaaz's Area)

### `GET /api/catalogue`
- **Auth:** None (Public)
- **Description:** Lists every supplier offer, cheapest first. Optional filters: `supplierId`, `productId`.

```json
{
  "success": true,
  "data": [
    {
      "catalogueId": "c01-uuid",
      "supplierId": "s01-uuid",
      "supplierName": "Fresh Foods",
      "productId": "p01-uuid",
      "productName": "Tomatoes",
      "unitOfMeasure": "kg",
      "category": "Produce",
      "pricePerUnit": 20.00,
      "minOrderQty": 500.00
    }
  ]
}
```

### `GET /api/catalogue/me`
- **Auth:** Required (`supplier`) — returns only the authenticated company's offers.

### `POST /api/catalogue`
- **Auth:** Required (`supplier`)
- **Body:** `{ "productId": "p01-uuid", "pricePerUnit": 20.00, "minOrderQty": 500.00 }`
- **Description:** Publishes one commercial offer for a base product.

#### Error: `409 Conflict` (duplicate supplier/product offer)
```json
{ "success": false, "error": { "code": "DUPLICATE_CATALOGUE_OFFER", "message": "Your company already has an offer for this product. Update the existing offer instead." } }
```

### `PATCH /api/catalogue/:id`
- **Auth:** Required (`supplier`, owner of the offer)
- **Body:** any of `pricePerUnit`, `minOrderQty`.
- **Note:** existing pools keep their `target_moq` snapshot; editing an offer never rewrites a pool already in flight.

### `DELETE /api/catalogue/:id`
- **Auth:** Required (`supplier`, owner of the offer)
- **Error:** `409 CATALOGUE_OFFER_IN_USE` while buying pools reference the offer.

---

## 5. Buying Pools & 5 km Discovery (Shaaz's Area)

### `GET /api/pools`
- **Owner:** Shaaz (Aggregation Engine)
- **Auth:** Optional (required for restaurant-tailored proximity)
- **Query Parameters:**
  - `latitude` (optional, float): Cloud kitchen GPS latitude
  - `longitude` (optional, float): Cloud kitchen GPS longitude
  - `radius` (optional, default: `5000` metres): Maximum distance
  - `status` (optional, default: `ACTIVE`): Filter by pool status (`ACTIVE`, `FULFILLED`, `EXPIRED`, `CANCELLED`)

#### Query Example:
`GET /api/pools?latitude=12.9716&longitude=77.5946&radius=5000&status=ACTIVE`

#### Response: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "poolId": "bp01-uuid",
      "status": "ACTIVE",
      "product": {
        "productId": "p001-uuid",
        "productName": "Tomatoes",
        "unitOfMeasure": "kg"
      },
      "supplier": {
        "supplierId": "s001-uuid",
        "companyName": "Fresh Foods"
      },
      "pricePerUnit": 20.00,
      "targetMoq": 500.00,
      "currentQty": 350.00,
      "progressPercentage": 70.0,
      "expirationTime": "2026-11-20T18:00:00.000Z",
      "distanceMeters": 2140.5,
      "isEligible": true
    }
  ]
}
```

### `GET /api/pools/nearby`
- **Auth:** Optional
- **Description:** Contract alias for `/api/pools/discover`. Accepts `lat`/`lng` (normalised to `latitude`/`longitude`) plus optional `radius` (metres, default `5000`) and `status` (default `ACTIVE`).

---

### `POST /api/pools`
- **Owner:** Shaaz (Aggregation Engine)
- **Auth:** Required (`supplier`)
- **Description:** Opens a buying pool from one of the supplier's own catalogue offers. `target_moq` is snapshotted from `min_order_qty`; `current_qty` starts at `0`; `status` starts `ACTIVE`.

#### Request Body:
```json
{
  "catalogueId": "c01-uuid",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "durationDays": 7
}
```
`expirationTime` (ISO timestamp) may be sent instead of `durationDays`.

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "poolId": "bp01-uuid",
    "catalogueId": "c01-uuid",
    "status": "ACTIVE",
    "targetMoq": 500.00,
    "currentQty": 0,
    "pricePerUnit": 20.00,
    "progressPercentage": 0,
    "geographicZone": { "latitude": 12.9352, "longitude": 77.6245 },
    "expirationTime": "2026-11-26T06:10:00.000Z"
  }
}
```

#### Errors: `403 FORBIDDEN` (not the offer owner), `404 CATALOGUE_OFFER_NOT_FOUND`, `400 VALIDATION_ERROR`.

---

### `GET /api/pools`
- **Auth:** Optional
- **Query Parameters:** `status`, `supplierId`, `catalogueId`. Location parameters (`restaurantId`, or `latitude`+`longitude`, or `lat`+`lng`) switch the response to distance-aware discovery.
- **Description:** Lists pools with stitched product, supplier, price, progress and expiry. Expired `ACTIVE` pools are closed before the read.

---

### `GET /api/pools/:id`
- **Auth:** Optional
- **Description:** Full pool detail: product, supplier, price, `targetMoq`, `currentQty`, `progressPercentage`, `expirationTime`, plus every micro-order (`orders`) and `participantCount`.
- **Error:** `404 POOL_NOT_FOUND`.

---

## 6. Micro-Orders & Concurrency Aggregation (Shaaz's Area)

### `POST /api/orders`
- **Owner:** Shaaz (Aggregation Engine)
- **Auth:** Required (`restaurant_owner`)
- **Description:** Places a micro-order into an `ACTIVE` pool within a database transaction.
  - Inserts into `micro_orders`.
  - Atomically updates `buying_pools.current_qty = current_qty + requested_qty`.
  - Calculates `pledged_amount = requested_qty * price_per_unit`.
  - Sets `payment_status = 'PENDING'`.
  - Automatically flips `buying_pools.status` from `ACTIVE` to `FULFILLED` if `current_qty >= target_moq`.

#### Request Body:
```json
{
  "poolId": "bp01-uuid",
  "restaurantId": "r001-uuid",
  "requestedQty": 150.00
}
```

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "orderId": "ord-003-uuid",
    "poolId": "bp01-uuid",
    "restaurantId": "r001-uuid",
    "requestedQty": 150.00,
    "pledgedAmount": 3000.00,
    "paymentStatus": "PENDING",
    "createdAt": "2026-11-12T11:35:00.000Z",
    "poolStatus": "FULFILLED",
    "poolCurrentQty": 500.00,
    "poolTargetMoq": 500.00,
    "overfillBy": 0.00
  }
}
```

> **Overfill (Decision 6):** a pledge larger than the remaining quantity is accepted. The pool aggregates the full amount, becomes `FULFILLED`, and `overfillBy` reports the surplus over `target_moq` (`0.00` when the pledge fits or lands exactly on target).

#### Error: `409 Conflict` (Duplicate Order)
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ORDERED",
    "message": "This restaurant has already placed an order in this buying pool"
  }
}
```

#### Error: `409 Conflict` (Pool Not Accepting Orders)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_POOL_STATUS",
    "message": "Cannot place order: Pool is FULFILLED"
  }
}
```

#### Error: `400 Bad Request` (Invalid Quantity, Expired Pool or Distance)
Codes: `INVALID_QUANTITY`, `POOL_EXPIRED`, `CLUSTER_PROXIMITY_EXCEEDED`.

---

## 7. Roadmap Endpoints (Subsequent Days)

| Method | Endpoint | Owner | Description | Status |
|---|---|---|---|---|
| `POST` | `/api/restaurants` | Dhruv | Create cloud kitchen profile with location | Implemented |
| `GET` | `/api/restaurants/me` | Dhruv | Get current user's kitchen profile | Implemented |
| `PATCH` | `/api/restaurants/:id` | Dhruv | Update own kitchen profile / location | Implemented |
| `DELETE` | `/api/restaurants/:id` | Dhruv | Delete own unused kitchen profile | Implemented |
| `POST` | `/api/suppliers` | Dhruv | Create supplier company profile | Implemented |
| `PATCH` | `/api/suppliers/:id` | Dhruv | Update own company profile / warehouse | Implemented |
| `DELETE` | `/api/suppliers/:id` | Dhruv | Delete own supplier profile without offers | Implemented |
| `GET` | `/api/products` | Shaaz | List base products | Implemented |
| `POST` | `/api/products` | Shaaz | Add a base product definition | Implemented |
| `GET` | `/api/catalogue` | Shaaz | List supplier offers | Implemented |
| `GET` | `/api/catalogue/me` | Shaaz | Supplier's own offers | Implemented |
| `POST` | `/api/catalogue` | Shaaz | Add supplier product offer with price & MOQ | Implemented |
| `PATCH` | `/api/catalogue/:id` | Shaaz | Update an offer's price / MOQ | Implemented |
| `DELETE` | `/api/catalogue/:id` | Shaaz | Delete an unused offer | Implemented |
| `POST` | `/api/pools` | Shaaz | Open a new buying pool for a catalogue offer | Implemented |
| `GET` | `/api/pools` | Shaaz | List pools with filters | Implemented |
| `GET` | `/api/pools/:id` | Shaaz | Pool detail with its micro-orders | Implemented |
| `GET` | `/api/pools/nearby` | Dhruv | Contract alias for 5 km discovery | Implemented |
| `GET` | `/api/orders/my-orders` | Dhruv | Restaurant's micro-order history | Implemented |
| `PATCH`| `/api/orders/:id/payment`| Dhruv | Update payment status (`PENDING` $\rightarrow$ `PAID`) | Implemented |

