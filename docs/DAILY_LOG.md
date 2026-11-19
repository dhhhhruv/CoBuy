# CoBuy — Daily Engineering Log

---

### Mon 2 Nov 2026 | Dev: Dhruv | Task: Day 1 — Align and Decide

- **What was built:** Created `docs/DECISIONS.md` and `docs/PROJECT_CONTEXT.md`.
- **Schema or API changes:** 
  - `SUPPLIERS`: Added `user_id UUID NOT NULL FK` referencing `USERS(user_id)` (`ON DELETE RESTRICT`).
  - `MICRO_ORDERS`: Added `UNIQUE(pool_id, restaurant_id)` (one order per kitchen per pool).
  - Types: `DECIMAL(10,2)` for currency/quantities; `POINT SRID 4326` for coordinates.
  - Foreign keys: `RESTRICT` everywhere; `CASCADE` on `USER_ROLES(user_id)`.
- **Decisions made & why:** MySQL 8.0 selected for native `ST_Distance_Sphere`; bcrypt + JWT chosen for stateless auth; defined statuses (`ACTIVE`, `FULFILLED`, `EXPIRED`, `CANCELLED`) and payment states (`PENDING`, `PAID`). Pool `geographic_zone` represents the centre point for 5 km radius checks.
- **Open questions or blockers:** None. All Day 1 decisions settled.
- **What other devs must know:**
  - **Shaaz (Dev 2):** Aggregation must enforce one order per restaurant per pool and use MySQL `ST_Distance_Sphere` for 5 km distance checks.
  - **Debangshu (Dev 3):** Auth returns JWT Bearer tokens; roles are `restaurant_owner` and `supplier`.
- **How to run and test:** Review [`docs/DECISIONS.md`](docs/DECISIONS.md) against [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).

---

### Mon 2 Nov 2026 | Dev: Debangshu | Task: Day 1 — Frontend Alignment & Screen Mapping

- **What was built:** Authored [`docs/FRONTEND_SCREENS.md`](FRONTEND_SCREENS.md) and settled Decision 7 in [`docs/DECISIONS.md`](DECISIONS.md).
- **Screens & UI Scope mapped:**
  - Public/Auth: Login & Registration with dual-role picker (`restaurant_owner` vs. `supplier`).
  - Restaurant Owner Portal: Restaurant Profile Setup (GPS coordinates), 5 km Pool Discovery, Pool Details with dynamic `MOQProgressBar`, Micro-Order placement modal, and Order History with `PaymentStatusBadge`.
  - Supplier Portal: Supplier Profile & Warehouse setup, Catalogue Management (unit price & MOQ definition), and Pool Creation Studio.
  - System: Live API & MySQL health check banner.
- **Decisions made & why:** Selected React (Vite) + Tailwind CSS for component reusability (`MOQProgressBar`, `PoolCard`, `MicroOrderModal`), reactive arithmetic for pledged amounts ($\text{Qty} \times \text{Price}$), and seamless role-based client-side routing.
- **Open questions or blockers:** None. Ready to scaffold client folder on Day 2.
- **What other devs must know:**
  - **Dhruv (Dev 1):** Frontend will consume `POST /api/users/login`, `POST /api/users/register`, and `GET /health` with Bearer JWT tokens.
  - **Shaaz (Dev 2):** Frontend expects `GET /api/pools/nearby?lat=...&lng=...&radius=5000` returning `current_qty` and `target_moq` as fixed numbers for progress bar percentage math.
- **How to run and test:** Review [`docs/FRONTEND_SCREENS.md`](FRONTEND_SCREENS.md) and [`docs/DECISIONS.md`](DECISIONS.md#7-frontend-architecture--framework-selection-debangshu).



---

### Wed 4 Nov 2026 | Dev: Dhruv | Task: Days 2 & 3 — Setup, Schema DDL & API Contract

- **What was built:** `package.json`, `.env`, `src/db/connection.js`, `src/app.js`, `src/db/schema.sql`, `src/db/migrate.js`, `docs/API_CONTRACT.md`.
- **Schema or API changes:** Migrated all 8 normalized tables in MySQL with `DECIMAL(10,2)`, `POINT SRID 4326` spatial indexes, and `RESTRICT`/`CASCADE` FKs. Implemented `GET /health`. Defined API specs for `/api/users`, `/api/products`, `/api/pools`, and `/api/orders` in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).
- **Decisions made & why:** Used `mysql2/promise` connection pool (limit: 10) to avoid TCP socket churn. Defined API contract first so frontend and aggregation engines have locked interfaces before coding.
- **Open questions or blockers:** None.
- **What other devs must know:**
  - **Shaaz (Dev 2):** Schema is live; run `npm run db:migrate`, build seed data, and follow `POST /api/orders` spec.
  - **Debangshu (Dev 3):** `GET /health` is up; use `docs/API_CONTRACT.md` payloads for UI mockups.
- **How to run and test:** Run `npm run db:migrate`, start server with `npm start`, and verify with `curl http://localhost:5000/health`.

---

### Tue 3 Nov 2026 | Dev: Debangshu | Task: Day 2 — Frontend Scaffolding, Routing & Mock Architecture

- **What was built:**
  - Scaffolded modern client directory in `src/client/`.
  - Built zero-dependency responsive design system in `src/client/css/style.css` with color-coded status badges, modal styles, and progress bars.
  - Created client-side Hash Router (`src/client/js/router.js`) with path parameter matching (`/pools/:id`) and role guard redirects.
  - Built reactive state store (`src/client/js/state.js`) with listener subscriptions and `localStorage` persistence.
  - Built Mock Data Adapter (`src/client/js/api/mockData.js`) and API client (`src/client/js/api/client.js`) conforming strictly to `docs/API_CONTRACT.md`.
  - Created empty page shells for all 9 screens (Restaurant Dashboard, Kitchen Profile, Pool Discovery, Pool Details, Orders, Supplier Hub, Warehouse Profile, Catalogue, and Create Pool).
- **Decisions made & why:** Built a modular ES6 module Single Page Application. It can be served directly by Express or run standalone in any browser with zero build steps or package manager bottlenecks during viva evaluation.
- **What other devs must know:**
  - **Dhruv & Shaaz:** Frontend is fully wired to mock data that matches `API_CONTRACT.md`. As backend endpoints go live, the frontend will automatically use the real API.
- **How to run and test:** Open `src/client/index.html` in browser or visit `http://localhost:5000/` when Express is running.

---

### Wed 4 Nov 2026 | Dev: Debangshu | Task: Day 3 — Redraw Final ER Diagram & Normalization Spec

- **What was built:** Authored [`docs/ER_DIAGRAM.md`](ER_DIAGRAM.md) redrawing the entire 8-table relational schema directly from `src/db/schema.sql`.
- **Details documented:**
  - Crow's foot Mermaid diagram showing all 8 tables, PKs, FKs, UKs, and exact column datatypes (`CHAR(36)`, `POINT SRID 4326`, `DECIMAL(10,2)`).
  - Explicit relationship cardinalities and participation constraints (1:1, 1:N, M:N).
  - BCNF / 3NF mathematical justification for each entity.
  - Viva defense rationale for `UNIQUE(pool_id, restaurant_id)`, immutable `target_moq` snapshots, and spatial indexing.
- **What other devs must know:**
  - Review [`docs/ER_DIAGRAM.md`](ER_DIAGRAM.md) before viva rehearsal.
- **How to run and test:** Inspect [`docs/ER_DIAGRAM.md`](ER_DIAGRAM.md).

---

### Thu 5 Nov 2026 | Dev: Debangshu | Task: Day 4 — LIGHT Review & 3 Viva Questions

- **Audit result:** 10-minute check confirmed 100% parity between `src/db/schema.sql` and `docs/ER_DIAGRAM.md`.
- **3 Viva Questions Logged:**
  1. *Q1: Why is `user_roles` modeled as a separate table with a composite primary key `(user_id, role_name)` instead of a column in `users`?*  
     **A:** Storing multiple roles in a single column violates 1NF (atomic values). A separate table eliminates multi-valued dependency and allows a user to hold both `restaurant_owner` and `supplier` roles without record duplication or update anomalies.
  2. *Q2: Why does `micro_orders` have `UNIQUE(pool_id, restaurant_id)`?*  
     **A:** A cloud kitchen should only hold a single aggregated micro-order in a buying pool. If they wish to pledge more quantity, they update their existing order rather than creating competing rows that induce race conditions.
  3. *Q3: Why are geographic coordinates stored using MySQL `POINT SRID 4326` instead of two separate `DECIMAL` columns?*  
     **A:** `SRID 4326` enforces the WGS 84 spherical spatial reference system, allowing MySQL to create a `SPATIAL INDEX` and execute native spherical calculations via `ST_Distance_Sphere` without flat-plane distortion.

---

### Fri 6 Nov 2026 | Dev: Debangshu | Task: Day 5 — Authentication Screens (Login & Register)

- **What was built:**
  - Implemented interactive Login & Registration UI in `src/client/js/pages/AuthPage.js`.
  - Added role picker toggle allowing users to sign up as `restaurant_owner` or `supplier`.
  - Added form validation (email format, minimum password length, required fields).
  - Connected form submission to `api.login()` and `api.register()` with automatic fallback to mock session if backend is offline.
  - Added 1-Click Quick Demo Login buttons for Kitchen A and Fresh Foods Supplier to streamline viva testing.
  - Configured JWT token storage in `localStorage` (`cobuy_token`) and role-based redirect (`/dashboard` vs. `/supplier/dashboard`).
- **What other devs must know:**
  - **Dhruv (Dev 1):** Login form posts `{ email, password }` and expects `{ success: true, data: { token, user: { userId, username, email, roles } } }` matching `docs/API_CONTRACT.md`.
- **How to run and test:** Load `src/client/index.html#/auth`, test switching between Sign In and Create Account, and click either "1-Click Demo Login" button to verify authenticated redirect and persistent navbar state.

### Mon 9 Nov 2026 | Dev: Dhruv | Task: Days 6, 7 & 8 — Prisma Migration, Profiles & 5 km Discovery

- **What was built:** `prisma/schema.prisma`, `src/db/prisma.js`, `src/auth/*`, `src/utils/geoUtils.js`, `src/profiles/*`, `src/pools/discovery*`, `tests/e2e_test.js`.
- **Schema or API changes:** 
  - Adopted Prisma ORM introspecting all 8 tables.
  - Added: `POST /api/restaurants`, `GET /api/restaurants/me`, `GET /api/restaurants/:id`.
  - Added: `POST /api/suppliers`, `GET /api/suppliers/me`, `GET /api/suppliers/:id`.
  - Added: `GET /api/pools/discover` (filters active pools within 5 km via `ST_Distance_Sphere`).
- **Decisions made & why:** Integrated Prisma ORM to match curriculum viva expectations, using `prisma.$queryRaw` for spatial `POINT SRID 4326` calculations. Enforced strict RBAC (`restaurant_owner`, `supplier`) and extracted profile owner IDs directly from JWT identity to prevent spoofing.
- **Open questions or blockers:** None.
- **What other devs must know:**
  - **Shaaz (Dev 2):** Database client is `prisma` (`src/db/prisma.js`). The 5 km discovery query is ready on `GET /api/pools/discover`.
  - **Debangshu (Dev 3):** Profile creation/view and pool discovery endpoints are live and require `Authorization: Bearer <token>`.
- **How to run and test:** Run `npm test` to execute end-to-end suite across auth, profiles, and spatial discovery.


---

### Wed 18 Nov 2026 | Dev: Dhruv | Task: Days 9, 10, 12, 14 & 15 — Orders, History, Payments, Validation, Hardening & Final ER Specs

- **What was built:** `src/orders/orderController.js`, `src/orders/orderRoutes.js`, `src/middleware/errorHandler.js`, `tests/negative_tests.js`, updated `src/app.js`, updated `package.json`, updated `docs/DECISIONS.md`.
- **Schema or API changes:**
  - Added `POST /api/orders`: Atomic micro-order placement inside Prisma transaction with 5 km radius check, `current_qty` increment, and automatic `FULFILLED` status transition.
  - Added `GET /api/orders/my` & `GET /api/orders/my-orders`: Returns authenticated kitchen owner's micro-orders with pool & product metadata.
  - Added `GET /api/orders/pool/:poolId`: Allows suppliers to audit all micro-orders placed in their pool.
  - Added `PATCH /api/orders/:id/payment`: Updates micro-order payment status (`PENDING` $\rightarrow$ `PAID`) with RBAC and ownership authorization.
  - Added `src/middleware/errorHandler.js`: Standard error envelope `{ success: false, error: { code, message, details }, timestamp }` and 404 handler for unmatched routes.
  - Documented the final ER model, 7 cardinalities, and complete constraint catalog in `docs/DECISIONS.md`.
  - Added Day 15 hardening suite in `tests/negative_tests.js`.
- **Decisions made & why:** Encapsulated micro-order placement and running total increments inside an explicit database transaction to guarantee ACID atomicity and prevent the lost update anomaly. Built standardized error mapping to guarantee frontend consistency with `API_CONTRACT.md`.
- **Open questions or blockers:** None. Dhruv's database, authentication, orders history, payment status, error handling, and testing responsibilities are 100% complete.
- **What other devs must know:**
  - **Shaaz (Dev 2):** Order creation and lifecycle transitions are fully wired on `POST /api/orders` and covered by end-to-end and negative tests.
  - **Debangshu (Dev 3):** Endpoints `GET /api/orders/my` and `PATCH /api/orders/:id/payment` are live on the backend.
- **How to run and test:** Run `npm test` and `npm run test:negative`.


---

### Thu 19 Nov 2026 | Dev: Dhruv | Task: Authentication Evolution — OAuth2 + OIDC & Dual-Token (JWT + Refresh Token Rotation)

- **What was built:** `src/auth/oidcService.js`, updated `src/auth/authUtils.js`, `src/auth/authController.js`, `src/auth/authRoutes.js`, `src/db/schema.sql`, `prisma/schema.prisma`, `tests/oauth_refresh_test.js`.
- **Schema or API changes:**
  - Added table `refresh_tokens(token_id, user_id, token_hash, expires_at, revoked, created_at)` with FK cascade on `users`.
  - Updated `POST /api/users/login` to return dual tokens: ephemeral JWT `accessToken` (15m) + cryptographic `refreshToken` (7d).
  - Added `POST /api/users/refresh`: Exchanges a valid refresh token for a fresh token pair while executing cryptographic token rotation.
  - Added `POST /api/users/logout`: Revokes refresh token in MySQL.
  - Added `GET /api/users/oauth/authorize`: Generates standard OpenID Connect (OIDC) authorization URL with CSRF state and role encoding.
  - Added `GET /api/users/oauth/callback`: OIDC authorization code exchange with Just-In-Time (JIT) user and role provisioning.
  - Added `POST /api/users/oauth/token`: Direct code exchange endpoint for SPAs.
  - Added `POST /api/users/oauth/mock`: Deterministic OIDC mock sign-in endpoint for offline testing & viva demonstrations.
- **Decisions made & why:** Implemented token rotation to defend against token replay attacks. Stored only the SHA-256 hash of refresh tokens in MySQL to ensure security even in the event of a database dump. Built a deterministic offline mock OIDC fallback so viva presentations never fail due to missing external internet access or third-party client secret configuration.
- **What other devs must know:**
  - **Debangshu (Dev 3):** Authentication responses now include `{ token, accessToken, refreshToken, expiresIn }`. Single sign-on can be triggered via `/api/users/oauth/authorize` or `api.oauthToken(code)`.
- **How to run and test:** Run `npm run test:oauth`.

---

### Thu 19 Nov 2026 | Dev: Shaaz | Task: Days 1-5 (backfilled) — Lifecycle, seed data and SQL order flow

- **What was built:** `src/pools/poolLifecycle.js`, `src/db/seed.js` (`npm run db:seed`), `docs/ORDER_FLOW_SQL.md`, `docs/POOL_LIFECYCLE.md`.
- **Schema or API changes:** None (schema unchanged). Settled Decisions 4, 6, 7 and confirmed 8 in `docs/DECISIONS.md`.
- **Decisions made & why:** Suppliers create pools (only they know the MOQ they will serve); overfill allowed and reported via `overfillBy`; expiry by lazy sweep guarded on `status = 'ACTIVE'`. Seed uses fixed UUIDs and reusable products so it is idempotent; `current_qty` is reconciled from micro-orders instead of being invented.
- **Open questions or blockers:** Timezone trap found — MySQL returns `TIMESTAMP` as local wall-clock; expiry now uses `UNIX_TIMESTAMP` epoch comparisons.
- **What other devs must know:** Demo accounts are `demo.kitchen.a@cobuy.demo` … password `Password123!`. Pools expire correctly on IST machines.
- **How to run and test:** `npm run db:seed`; review `docs/ORDER_FLOW_SQL.md`.

---

### Thu 19 Nov 2026 | Dev: Shaaz | Task: Days 6-8 (backfilled) — Catalogue CRUD, pool CRUD, lifecycle rules in one module

- **What was built:** `src/catalogue/*` (products + supplier catalogue), `src/pools/poolController.js`, `src/pools/poolRoutes.js`, `tests/catalogue_pool_test.js`.
- **Schema or API changes:** Added `GET/POST/PATCH/DELETE /api/products`, `GET /api/catalogue`, `GET /api/catalogue/me`, `POST/PATCH/DELETE /api/catalogue`, `POST /api/pools`, `GET /api/pools`, `GET /api/pools/:id`, and the `/api/pools/nearby` alias used by the frontend. `/api/pools/discover` unchanged.
- **Decisions made & why:** `POST /api/pools` requires supplier ownership of the catalogue offer; `target_moq` is a snapshot; duplicate offers return `409 DUPLICATE_CATALOGUE_OFFER`; catalogue deletion is blocked while pools exist.
- **Open questions or blockers:** None.
- **What other devs must know:** Frontend `api.getNearbyPools()` now resolves; pool detail is available for the detail screen.
- **How to run and test:** `npm run test:catalogue`.

---

### Thu 19 Nov 2026 | Dev: Shaaz | Task: Days 9-15 (backfilled) — Atomic aggregation, concurrency proof, edge tests, write-ups

- **What was built:** `src/orders/orderController.js` (row lock + overfill + expiry), `tests/concurrency_test.js`, `tests/aggregation_edge_test.js`, `tests/demo_run_test.js`, `tests/testUtils.js`, `docs/NORMALIZATION.md`, `docs/VIVA_NOTES.md`.
- **Schema or API changes:** `POST /api/orders` now locks the pool row `FOR UPDATE`, re-validates under the lock, returns `overfillBy`, and returns `409 INVALID_POOL_STATUS` for closed pools. Expiry comparisons use epoch seconds.
- **Decisions made & why:** Pessimistic row locking over optimistic retries or SERIALIZABLE; order + quantity + status transition stay in one transaction; naive read-then-write retained only inside the test to demonstrate the lost update.
- **Open questions or blockers:** Existing pledges cannot be increased (would need an update endpoint); documented as a limitation.
- **What other devs must know:** `npm run test:all` covers every suite; concurrency test asserts 350 + 100 + 100 = 550 kg and shows the naive version recording only 100 kg.
- **How to run and test:** `npm run test:concurrency`, `npm run test:aggregation`, `npm run test:demo`, `npm run test:all`.
