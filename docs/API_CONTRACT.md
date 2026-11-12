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
    "poolTargetMoq": 500.00
  }
}
```

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

#### Error: `400 Bad Request` (Invalid Quantity or Inactive Pool)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ORDER",
    "message": "Cannot place order: Pool is no longer ACTIVE"
  }
}
```

---

## 7. Roadmap Endpoints (Subsequent Days)

| Method | Endpoint | Owner | Description | Target Day |
|---|---|---|---|---|
| `POST` | `/api/restaurants` | Dhruv | Create cloud kitchen profile with location | Day 6 |
| `GET` | `/api/restaurants/me` | Dhruv | Get current user's kitchen profile | Day 6 |
| `POST` | `/api/suppliers` | Dhruv | Create supplier company profile | Day 6 |
| `POST` | `/api/catalogue` | Shaaz | Add supplier product offer with price & MOQ | Day 6 |
| `POST` | `/api/pools` | Shaaz | Open a new buying pool for a catalogue offer | Day 7 |
| `GET` | `/api/orders/my-orders` | Dhruv | Restaurant's micro-order history | Day 10 |
| `PATCH`| `/api/orders/:id/payment`| Dhruv | Update payment status (`PENDING` $\rightarrow$ `PAID`) | Day 10 |

