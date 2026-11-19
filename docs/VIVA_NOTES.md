# CoBuy — Viva Notes (Plan Days 16-18)

Written for the aggregation area (Shaaz), then the swap areas each developer is
expected to explain anyway. Answers are short enough to say out loud.

---

## A. Aggregation Engine — questions and model answers

### A1. Why does a pool reference `catalogue_id` instead of `product_id`?
Because price and MOQ are properties of a **supplier's offer**, not of the
product. Tomatoes from Fresh Foods are ₹20/kg with a 500 kg MOQ; the same
tomatoes from Green Basket are ₹22/kg with 400 kg. If the pool pointed at the
product, the supplier and price would be ambiguous.

### A2. `target_moq` repeats `min_order_qty`. Is that a normalization violation?
No. It is a deliberate **historical snapshot**. A pool is a commitment made on
the day it opens; if the supplier later raises the MOQ to 900 kg, pools already
collecting must not silently move the goalposts. The snapshot preserves the
contract. The alternative — always joining to the live catalogue value — makes
fulfilment change retroactively. It is the same reasoning as storing the price
on an invoice.

### A3. `current_qty` is derivable from `SUM(micro_orders.requested_qty)`. Why store it?
Performance. Discovery reads many pools per dashboard load; summing a growing
order table for every pool on every request is O(orders) per pool. The running
total turns that into a single column read. The trade-off is that both writes
must be atomic — which they are, inside one transaction with a row lock. The
invariant is asserted by tests and by the seed's `reconcilePool`.

### A4. Why `UNIQUE(pool_id, restaurant_id)`?
A micro-order is defined as "one restaurant's participation in one pool". The
constraint encodes that definition in the schema, so a duplicate cannot be
created even by a buggy client. It also removes a class of race where two
submissions create competing rows for the same kitchen. If a kitchen wants more
quantity, the correct operation is an update, not a second row (not implemented
in this release; a second pledge returns `409 ALREADY_ORDERED`).

### A5. Walk through placing an order.
1. Authenticate the JWT and require `restaurant_owner`.
2. Resolve the restaurant by `owner_id = req.user.userId` (never trust a body id).
3. Lazily expire stale pools.
4. Reject duplicate participation and validate quantity.
5. Check the pool is `ACTIVE`, not expired, and within 5 km via `ST_Distance_Sphere`.
6. Open a transaction, `SELECT ... FOR UPDATE` the pool row.
7. Re-validate status and expiry under the lock.
8. Insert the micro-order with `pledged_amount = qty × catalogue price`.
9. Update `current_qty`; set `FULFILLED` if `>= target_moq`; validate the transition.
10. Commit and return the new pool state plus `overfillBy`.

### A6. Why `SELECT ... FOR UPDATE` rather than an atomic increment?
The increment alone protects the counter, but the same transaction must also
validate status/expiry and conditionally transition the status. Taking the row
lock once makes the entire read-validate-write sequence serial per pool. The
cost is blocking only for pledges to the same pool.

### A7. What happens with two simultaneous orders?
T1 locks the row and writes. T2 blocks at the lock, then reads the committed
value and writes on top of it. `tests/concurrency_test.js` fires 100 kg + 100 kg
at a 350 kg pool three times and asserts 550 kg every time. The same test runs a
deliberately naive read-then-write version and asserts it records only 100 kg —
that is the lost update, demonstrated rather than claimed.

### A8. What if a pledge exceeds the remaining quantity?
Overfill is allowed (Decision 6). The pool becomes `FULFILLED`, the total may
exceed the target, and the API reports `overfillBy`. The MOQ is a minimum, and
rejecting based on arrival order would make the outcome timing-dependent. The UI
can warn using `overfillBy`.

### A9. How does expiry work? Why no cron job?
A lazy sweep runs before reads and before ordering:
`UPDATE ... SET status='EXPIRED' WHERE status='ACTIVE' AND expiration_time <= now`.
It is guarded by `status='ACTIVE'`, so a fulfilled pool is never reclassified.
A scheduled job would only change *when* the row is written, not what a client
observes; it adds a process and failure mode for no behavioural gain.

### A10. What is the timezone trap you hit?
MySQL returns `TIMESTAMP` columns as local wall-clock time. On an IST machine,
parsing that value as UTC shifts deadlines by 5.5 hours, so pools expired late.
Expiry is therefore compared as `UNIX_TIMESTAMP(expiration_time)` against
`Math.floor(Date.now()/1000)`, and new deadlines are written with
`FROM_UNIXTIME(epoch)`. Epoch seconds are timezone-independent.

### A11. Which statuses exist and which transitions are legal?
`ACTIVE`, `FULFILLED`, `EXPIRED`, `CANCELLED`. Only `ACTIVE` can move, and only
to one of the other three; the others are terminal. Ordering can only cause
`ACTIVE -> FULFILLED`. Violations return `409 INVALID_STATUS_TRANSITION`.

### A12. Where are catalogue prices edited, and what stops duplicates?
`PATCH /api/catalogue/:id` by the owning supplier. `UNIQUE(supplier_id,
product_id)` prevents a second offer for the same product; the API maps it to
`409 DUPLICATE_CATALOGUE_OFFER` with a message telling the supplier to edit the
existing offer.

---

## B. Swap areas (what each developer should still be able to explain)

### B1. Database and authentication (Dhruv)

**Why UUID primary keys?** They are stable, system-generated, not user-editable,
and safe to expose in URLs. The cost is 16 bytes instead of 4–8; with InnoDB that
is an acceptable price for immutability.

**Why `DECIMAL(10,2)` for money?** Binary floating point cannot represent `0.10`
exactly, so totals drift (₹99.999999). `DECIMAL` is fixed-point and exact.

**Why are roles in `USER_ROLES` and not a column on `USERS`?** A user may be both
a kitchen owner and a supplier. A multi-valued column violates 1NF; the junction
table with composite key `(user_id, role_name)` removes the repeating group and
makes "does this user have role X" an indexed lookup.

**Hashing versus encryption?** Passwords must be one-way. bcrypt is a salted,
adaptive hash: the same password yields different hashes, and the work factor
makes offline guessing expensive. Encryption would be reversible with the key,
which is exactly what we must avoid.

**Why dual tokens?** A short-lived JWT access token (15 min) limits the damage if
it leaks. The refresh token (7 days) is opaque and stored only as a SHA-256 hash,
so a database dump cannot be replayed. Every refresh rotates the token, so an old
token stops working once used.

**Why does `owner_id` come from the JWT and not the body?** Otherwise any
authenticated user could create or edit a profile on behalf of another owner just
by sending their id. The token is the only trusted identity source.

**Why `ON DELETE RESTRICT` almost everywhere?** Deleting a user, restaurant,
supplier, product or offer that has history would destroy an audit trail or
silently remove related records. `RESTRICT` forces an explicit decision. The two
exceptions are `USER_ROLES` and `REFRESH_TOKENS`, which are `CASCADE` because they
exist only to serve the user.

**Why does the schema have nine tables when the context says eight?** The eight
procurement tables are unchanged. `REFRESH_TOKENS` is an authentication
side-table with one relationship, `USERS 1:N REFRESH_TOKENS`, and no role in
procurement. Phrase it that way rather than claiming the design always had nine.

**Why is `PRODUCTS.product_name` not unique?** "Cooking Oil" can exist in litres
and "Tomatoes" in kilograms; uniqueness is a business rule we enforce at the API
when creating a product (same name + same unit reuses the row), not a schema
constraint that could block a legitimate second unit.

**What do the profile endpoints enforce?** `PATCH`/`DELETE` on
`/api/restaurants/:id` and `/api/suppliers/:id` require the JWT role *and* that
the row belongs to the caller (`owner_id` / `user_id`). A profile referenced by
orders or catalogue offers cannot be deleted: `409 RESTAURANT_IN_USE` or
`409 SUPPLIER_IN_USE`, mirroring the database's `RESTRICT` rule with a readable
error instead of a raw foreign-key failure.

### B2. Frontend (Debangshu)
- Single-page app with hash routing; role guards redirect between kitchen and supplier routes.
- Progress bars compute `current / target` and clamp at 100%, because overfill is legal.
- Mock fallback exists so the UI stays demonstrable if the API is down — useful for a demo, but the viva should state that the real path is the API.

---

## C. Honest limitations

Say these as extensions, not features:

- No payment gateway, refunds, payouts or transaction ledger; `payment_status` is a commitment flag updated by an authorized user.
- Reaching the MOQ does **not** mean the supplier accepted or dispatched the order; there is no supplier confirmation state.
- No delivery tracking.
- `wallet_balance` is stored but not debited by any flow.
- A kitchen cannot increase an existing pledge; it would need an update endpoint.
- Cancellation is a reserved status with no endpoint yet.
