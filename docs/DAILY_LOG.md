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
