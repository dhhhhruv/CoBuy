# CoBuy — Buying Pool Lifecycle (Plan Day 1 artifact)

Owner: Shaaz (Aggregation Engine). Referenced by `src/pools/poolLifecycle.js`.

## 1. Who creates a pool?

A **supplier** opens a pool from one of its own `supplier_catalogue` offers
(`POST /api/pools`). A kitchen cannot create a pool; it discovers nearby pools
and pledges a micro-order into one. This settles plan Decision 4: the supplier
is the only participant that knows the MOQ it is willing to serve and the
cluster it can deliver to.

## 2. Status values

| Status | Meaning | Accepts new orders? |
|---|---|---|
| `ACTIVE` | Collecting contributions before `expiration_time` | Yes |
| `FULFILLED` | `current_qty >= target_moq`; MOQ unlocked | No |
| `EXPIRED` | Deadline passed while still `ACTIVE` | No |
| `CANCELLED` | Withdrawn before fulfilment (reserved state) | No |

The database enforces the domain with
`CHECK (status IN ('ACTIVE','FULFILLED','EXPIRED','CANCELLED'))`.

## 3. Allowed transitions

```
                 current_qty >= target_moq
        ACTIVE ───────────────────────────► FULFILLED
          │
          │ expiration_time passed
          ├────────────────────────────────► EXPIRED
          │
          │ supplier withdrawal (reserved)
          └────────────────────────────────► CANCELLED
```

`FULFILLED`, `EXPIRED` and `CANCELLED` are terminal. An order can only cause
`ACTIVE -> FULFILLED`; it can never reopen a closed pool. Illegal transitions
raise `409 INVALID_STATUS_TRANSITION`.

## 4. Expiry policy (Decision 7)

Expiry uses a **lazy sweep**, not a scheduled job:

- `expireStalePools()` runs before pools are listed, discovered, read by id, or
  ordered on.
- It executes one guarded update:
  `UPDATE buying_pools SET status='EXPIRED' WHERE status='ACTIVE' AND expiration_time <= now`.
- Guarding on `status = 'ACTIVE'` means a `FULFILLED` pool can never be
  reclassified as `EXPIRED` after the fact.

Why lazy: no cron process, no extra deployment surface, and the state is always
correct at the moment anyone reads it. A scheduled job would only change *when*
the row is updated, not the observable API behaviour.

Expiry comparisons use **epoch seconds** (`UNIX_TIMESTAMP(expiration_time)`),
never JS-parsed `TIMESTAMP` strings. MySQL returns `TIMESTAMP` columns as local
wall-clock time; interpreting that as UTC shifts deadlines by the server's UTC
offset (5.5 hours on an IST machine). Epoch comparison is timezone-independent.

## 5. Quantity and MOQ rules

- `target_moq` is copied from `supplier_catalogue.min_order_qty` **at pool
  creation** and never re-read from the catalogue. Editing an offer later does
  not rewrite the target of pools already in flight.
- `current_qty` is a stored running total, updated inside the same transaction
  that inserts the micro-order. It is a deliberate denormalisation: the
  alternative is `SUM(requested_qty)` on every discovery query.
- Invariant: `current_qty = SUM(micro_orders.requested_qty)` for the pool;
  `tests/aggregation_edge_test.js` and the seed's `reconcilePool` assert it.
- `UNIQUE(pool_id, restaurant_id)` means one kitchen holds at most one
  micro-order per pool. Increasing a pledge would be an update, not a second
  row (out of scope for this release; a second pledge returns
  `409 ALREADY_ORDERED`).

## 6. Overfill policy (Decision 6)

**Overfill is allowed.** If a pool at 350/500 receives a 200 kg pledge, the
total becomes 550 kg, the pool becomes `FULFILLED`, and the response reports
`"overfillBy": 50`.

Reasons:

1. The MOQ is a supplier *minimum*, not a maximum. Extra volume can still be
   supplied or absorbed by the kitchens.
2. Rejecting the pledge because another kitchen's order landed first makes the
   outcome depend on request timing, which is unfair and hard to justify.
3. The plan's own concurrency example (350 kg + 100 kg + 100 kg) requires
   overfill to be legal.

The UI can warn using `overfillBy` without blocking the transaction.

## 7. Code map

| Concern | Location |
|---|---|
| Statuses, transitions, expiry, overfill, progress | `src/pools/poolLifecycle.js` |
| Create / list / detail | `src/pools/poolController.js` |
| Routes (`/discover`, `/nearby`, `/`, `/:id`) | `src/pools/poolRoutes.js` |
| Atomic pledge + row lock | `src/orders/orderController.js` |
| Contract tests | `tests/catalogue_pool_test.js`, `tests/aggregation_edge_test.js`, `tests/concurrency_test.js`, `tests/demo_run_test.js` |
