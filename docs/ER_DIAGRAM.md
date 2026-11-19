# CoBuy — Final Entity-Relationship (ER) Specification & Schema Defense

> **Owner:** Debangshu (Frontend Lead)  
> **Source of Truth:** Redrawn directly from [`src/db/schema.sql`](../src/db/schema.sql) (MySQL 8.0+ InnoDB DDL)  
> **Normalization Level:** 3NF / Boyce-Codd Normal Form (BCNF)

---

## 1. Complete System ER Diagram (Crow's Foot Notation)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "holds (1:N)"
    USERS ||--o{ REFRESH_TOKENS : "sessions (1:N)"
    USERS ||--o{ RESTAURANTS : "owns (1:N)"
    USERS ||--o{ SUPPLIERS : "operates (1:N)"
    
    SUPPLIERS ||--o{ SUPPLIER_CATALOGUE : "lists (1:N)"
    PRODUCTS ||--o{ SUPPLIER_CATALOGUE : "offered_in (1:N)"
    
    SUPPLIER_CATALOGUE ||--o{ BUYING_POOLS : "instantiates (1:N)"
    
    BUYING_POOLS ||--o{ MICRO_ORDERS : "aggregates (1:N)"
    RESTAURANTS ||--o{ MICRO_ORDERS : "pledges (1:N)"

    USERS {
        char(36) user_id PK "UUID"
        varchar username UK "Unique"
        varchar email UK "Unique"
        varchar password_hash "bcrypt"
        timestamp created_at
    }

    USER_ROLES {
        char(36) user_id PK, FK "CASCADE on delete"
        varchar role_name PK "restaurant_owner | supplier"
    }

    REFRESH_TOKENS {
        char(36) token_id PK "UUID"
        char(36) user_id FK "CASCADE on delete"
        varchar token_hash UK "SHA-256 of raw token"
        timestamp expires_at
        boolean revoked "default false"
        timestamp created_at
    }

    RESTAURANTS {
        char(36) restaurant_id PK "UUID"
        char(36) owner_id FK "RESTRICT on delete"
        varchar business_name
        point location_coord "SRID 4326 (Spatial Index)"
        decimal wallet_balance "DECIMAL(10,2)"
        text address_text
    }

    SUPPLIERS {
        char(36) supplier_id PK "UUID"
        char(36) user_id FK "RESTRICT on delete"
        varchar company_name
        varchar contact_email UK
        point warehouse_coord "SRID 4326 (Spatial Index)"
    }

    PRODUCTS {
        char(36) product_id PK "UUID"
        varchar product_name "not unique: same name may exist in another unit"
        varchar unit_of_measure "e.g. kg, litre"
        varchar category
    }

    SUPPLIER_CATALOGUE {
        char(36) catalogue_id PK "UUID"
        char(36) supplier_id FK "RESTRICT"
        char(36) product_id FK "RESTRICT"
        decimal price_per_unit "DECIMAL(10,2) > 0"
        decimal min_order_qty "DECIMAL(10,2) > 0 (MOQ)"
    }

    BUYING_POOLS {
        char(36) pool_id PK "UUID"
        char(36) catalogue_id FK "RESTRICT"
        point geographic_zone "SRID 4326 (Spatial Index)"
        varchar status "ACTIVE | FULFILLED | EXPIRED | CANCELLED"
        decimal current_qty "DECIMAL(10,2) Running Sum"
        decimal target_moq "DECIMAL(10,2) Frozen Snapshot"
        timestamp expiration_time
    }

    MICRO_ORDERS {
        char(36) order_id PK "UUID"
        char(36) pool_id FK "RESTRICT, UK with restaurant_id"
        char(36) restaurant_id FK "RESTRICT, UK with pool_id"
        decimal requested_qty "DECIMAL(10,2) > 0"
        decimal pledged_amount "DECIMAL(10,2) = qty * price"
        varchar payment_status "PENDING | PAID"
        timestamp created_at
    }
```

---

## 2. Cardinalities & Relationship Details

| Relationship | Cardinality | Participation | Foreign Key & Referential Action | Real-World Domain Meaning |
|---|:---:|:---:|---|---|
| `USERS` $\to$ `USER_ROLES` | **1 : N** | Mandatory (User must have $\ge 1$ role) | `user_id` $\to$ `users(user_id)` (`ON DELETE CASCADE`) | Resolves multi-role membership (kitchen owner, supplier, or both). |
| `USERS` $\to$ `REFRESH_TOKENS` | **1 : N** | Optional | `user_id` $\to$ `users(user_id)` (`ON DELETE CASCADE`) | One row per active session; only the token hash is stored, enabling per-device revocation. |
| `USERS` $\to$ `RESTAURANTS` | **1 : N** | Optional | `owner_id` $\to$ `users(user_id)` (`ON DELETE RESTRICT`) | A user can own one or more cloud kitchens. |
| `USERS` $\to$ `SUPPLIERS` | **1 : N** | Optional | `user_id` $\to$ `users(user_id)` (`ON DELETE RESTRICT`) | Links login credentials to a company supplier profile. |
| `SUPPLIERS` $\leftrightarrow$ `PRODUCTS` | **M : N** | Optional on both sides | Resolved by `SUPPLIER_CATALOGUE` with `UNIQUE(supplier_id, product_id)` | A supplier offers multiple products; a product has multiple wholesale suppliers. |
| `SUPPLIER_CATALOGUE` $\to$ `BUYING_POOLS` | **1 : N** | Optional | `catalogue_id` $\to$ `supplier_catalogue` (`ON DELETE RESTRICT`) | A supplier's catalog offer can be instantiated into multiple pools across time/zones. |
| `BUYING_POOLS` $\leftrightarrow$ `RESTAURANTS` | **M : N** | Optional on both sides | Resolved by `MICRO_ORDERS` with `UNIQUE(pool_id, restaurant_id)` | Multiple kitchens contribute micro-orders to one pool; a kitchen joins multiple pools. |

---

## 3. BCNF / 3NF Normalization Proofs

1. **1NF (First Normal Form):** All column values are strictly atomic. Multi-role assignments are factored into `USER_ROLES` rather than stored as a comma-separated list or JSON array in `USERS`.
2. **2NF (Second Normal Form):** In tables with composite keys (`USER_ROLES`), non-key attributes do not depend on a subset of the candidate key.
3. **3NF & BCNF:** Every determinant is a superkey:
   - In `PRODUCTS`, generic product attributes (`name`, `unit_of_measure`) are separated from supplier pricing.
   - In `SUPPLIER_CATALOGUE`, pricing and MOQ depend strictly on the candidate key `(supplier_id, product_id)`.
   - In `BUYING_POOLS`, `target_moq` is a deliberate immutable snapshot (denormalized historical log) to protect against retroactive price changes.

---

## 4. Key Viva Questions & Answers (Frontend & DB Alignment)

### Q1: Why is there a `UNIQUE(pool_id, restaurant_id)` constraint on `MICRO_ORDERS`?
> **Answer:** It prevents a cloud kitchen from placing competing duplicate micro-orders in the same pool, eliminating race conditions. In the frontend, if a restaurant owner attempts to order again, the UI shows their existing pledged micro-order instead of opening a duplicate order modal.

### Q2: Why store `current_qty` on `BUYING_POOLS` instead of computing `SUM(requested_qty)` on demand?
> **Answer:** Performance and atomicity. Running `SELECT SUM(requested_qty)` on high-traffic pool listings triggers expensive full-table scans. Storing `current_qty` allows the frontend progress bar to query a single indexed row in $O(1)$ time, while row-level locking during order insertion guarantees concurrency safety.

### Q3: Why `POINT SRID 4326` instead of separate `latitude` and `longitude` decimal columns?
> **Answer:** `POINT SRID 4326` allows MySQL to build a spatial R-tree index (`SPATIAL INDEX`). This allows native spherical distance filtering via `ST_Distance_Sphere(restaurant.location_coord, pool.geographic_zone) <= 5000` with sub-millisecond execution.

