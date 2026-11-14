# CoBuy — Architectural & Technical Decisions Log

This document records all settled architectural, schema, and design decisions for CoBuy. It serves as the definitive reference for the team (Dhruv, Shaaz, Debangshu) and explains the technical rationale required for viva defense.

---

## 1. Database & ORM Selection
- **Database Engine:** MySQL (version 8.0+).
- **ORM / Data Access Layer:** Prisma ORM (`@prisma/client`).
- **Rationale & Viva Defense:** 
  - Prisma provides type-safe database queries, automated relational modeling, and atomic transaction handling across the core entities.
  - **Prisma & Spatial Limitation (Viva Highlight):** Prisma's schema definition language does not natively support MySQL WGS 84 spatial types (`POINT SRID 4326`) or `SPATIAL INDEX`. We represent spatial columns as `Unsupported("point")` in `schema.prisma`. For standard CRUD operations and relations, we use standard Prisma Client methods (`prisma.users`, `prisma.restaurants`, etc.); for spatial queries (`ST_Distance_Sphere`), we execute native SQL via `prisma.$queryRaw`.
  - InnoDB engine provides full ACID transaction support for concurrent micro-order quantity aggregation.

---

## 2. Schema Refinements & Keys

### 2.1. Linking SUPPLIERS to USERS
- **Decision:** Add `user_id UUID NOT NULL` as a foreign key in `SUPPLIERS` referencing `USERS(user_id)`.
- **Rationale:** The initial 8-table schema allowed users to hold the `supplier` role in `USER_ROLES`, but did not link a user account to a specific company record in `SUPPLIERS`. Without this link, a logged-in supplier could not identify which company profile and catalogue offers they manage.
- **Cardinality:** 1:1 or 1:N (one user manages a supplier profile).
- **Constraint:** `FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT`.

### 2.2. Single Micro-Order per Restaurant per Pool
- **Decision:** Add a composite unique constraint `UNIQUE(pool_id, restaurant_id)` on `MICRO_ORDERS`.
- **Rationale:** 
  - Restricts each cloud kitchen to exactly one contribution per buying pool.
  - Simplifies aggregation logic, status checking, and viva explanation.
  - If a restaurant needs to change their requested quantity, they update their existing micro-order rather than creating duplicate competing rows.

### 2.3. Foreign Key ON DELETE Behavior
- **Decision:** `RESTRICT` on all foreign keys across the schema, except `CASCADE` on `USER_ROLES(user_id)`.
- **Rationale:**
  - `RESTRICT` prevents accidental deletion of parent records (e.g., deleting a supplier, restaurant, product, or catalogue entry that has active pools or orders). This maintains strict referential integrity and an audit trail.
  - `CASCADE` on `USER_ROLES` ensures that if a user account is deleted, their associated role mappings are cleaned up automatically without leaving orphaned role rows.

---

## 3. Data Types & Representation

### 3.1. Currency and Quantities
- **Decision:** Use `DECIMAL(10, 2)` for all monetary values (`wallet_balance`, `price_per_unit`, `pledged_amount`) and order quantities (`min_order_qty`, `target_moq`, `current_qty`, `requested_qty`).
- **Rationale:** 
  - Floating-point types (`FLOAT`, `DOUBLE`) suffer from binary representation errors (e.g., `0.1 + 0.2 = 0.30000000000000004`).
  - `DECIMAL(10, 2)` guarantees exact fixed-point arithmetic up to 10 total digits with 2 decimal places, preventing monetary discrepancy in financial totals and micro-orders.

### 3.2. Spatial Coordinates & The 5 km Radius Rule
- **Decision:**
  - `restaurants.location_coord`: `POINT NOT NULL SRID 4326`.
  - `suppliers.warehouse_coord`: `POINT NOT NULL SRID 4326`.
  - `buying_pools.geographic_zone`: `POINT NOT NULL SRID 4326` (represents the geographic centre point of the pool).
- **Distance Calculation:**
  ```sql
  ST_Distance_Sphere(restaurant.location_coord, buying_pool.geographic_zone) <= 5000
  ```
- **Rationale:**
  - `SRID 4326` corresponds to the WGS 84 spatial reference system (standard GPS latitude and longitude coordinates).
  - `ST_Distance_Sphere` calculates the great-circle distance between two points on an Earth sphere in metres, avoiding flat-plane Cartesian distortion.
  - Treating `geographic_zone` as the centre point defines a clear, unambiguous circular boundary (5,000 metres) for pool eligibility.

---

## 4. Authentication & Security
- **Decision:** Password hashing via `bcrypt` + Stateless authentication via JSON Web Tokens (`JWT`).
- **Rationale:**
  - `bcrypt`: Uses adaptive salt generation and configurable work factors (computational cost), defending against dictionary and rainbow table attacks. Plain passwords are never stored.
  - `JWT`: Compact, self-contained credentials passed in HTTP `Authorization: Bearer <token>` headers. Eliminates server-side session memory overhead and aligns with standard RESTful stateless design.

---

## 5. Enumerations & Allowed Domain Values

| Domain / Column | Allowed Values | Description |
|---|---|---|
| `buying_pools.status` | `'ACTIVE'`, `'FULFILLED'`, `'EXPIRED'`, `'CANCELLED'` | Pool lifecycle states |
| `micro_orders.payment_status` | `'PENDING'`, `'PAID'` | Micro-order payment status |
| `user_roles.role_name` | `'restaurant_owner'`, `'supplier'` | System authorization roles |

- **Enforcement:** Enforced at the database level via `CHECK` constraints or `VARCHAR` with validation, and validated in application request schemas.

---

## 6. Business Logic Rules (Cross-Area Alignment)
- **Pledged Amount Formula:** `pledged_amount = requested_qty * price_per_unit`.
- **Target MOQ Snapshot:** `buying_pools.target_moq` is copied from `supplier_catalogue.min_order_qty` at pool creation to preserve historical integrity even if the supplier later adjusts their catalogue minimum.
- **Current Quantity Running Total:** `buying_pools.current_qty` is maintained as a running sum updated inside an atomic transaction when micro-orders are placed, avoiding repeated `SUM()` table scans.

