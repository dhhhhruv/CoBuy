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

