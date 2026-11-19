# CoBuy — Normalization and Transactions (Plan Day 14 artifact)

Owner: Shaaz (Aggregation Engine). Every example below uses a real CoBuy
relation, not a textbook one. The context file's 2NF example keys on
`(order_id, product_id)`, which is **not** a relation in the final design, so it
is replaced here.

## 1. UNF — the unnormalized starting point

Before decomposition, the platform could be stored as one wide relation:

```
COBUY_MASTER(
  user_id, username, email, password_hash,
  roles,                      -- 'restaurant_owner, supplier'
  business_name, location_coord, wallet_balance,
  company_name, contact_email, warehouse_coord,
  product_name, unit_of_measure,
  price_per_unit, min_order_qty,
  pool_id, status, current_qty, target_moq, expiration_time,
  restaurant_id, requested_qty, pledged_amount, payment_status
)
```

Problems visible immediately:

- `roles` holds a repeating group of values.
- One row mixes a user, a restaurant, a supplier, a product, an offer, a pool
  and an order — unrelated facts are forced to share a row.
- A supplier cannot exist without an order; deleting the last order deletes the
  only record of the supplier.

## 2. 1NF — atomic values, no repeating groups

Rule: every attribute holds a single atomic value; no repeating groups.

`roles` is split out into its own relation:

```
USER_ROLES(user_id, role_name)
```

A user with two roles gets two rows, not one comma-separated string. This is
also the reason `USER_ROLES` has a composite primary key
`(user_id, role_name)`: the pair is the identity of a role assignment, and the
key prevents assigning the same role twice.

## 3. 2NF — no partial dependency on a composite key

Rule: in 1NF and every non-prime attribute is fully functionally dependent on
the whole of every candidate key.

A realistic intermediate relation after 1NF still keyed by the participation
pair:

```
POOL_PARTICIPATION(pool_id, restaurant_id,
                   business_name, address_text,
                   company_name, contact_email,
                   product_name, unit_of_measure,
                   price_per_unit, target_moq,
                   requested_qty, pledged_amount)
```

Key: `(pool_id, restaurant_id)`.

Partial dependencies:

| Attribute | Depends only on | Correct home |
|---|---|---|
| `business_name`, `address_text` | `restaurant_id` | `RESTAURANTS` |
| `company_name`, `contact_email` | supplier of the pool | `SUPPLIERS` |
| `product_name`, `unit_of_measure` | offer | `PRODUCTS` |
| `price_per_unit`, `target_moq` | `pool_id` (via the offer) | `SUPPLIER_CATALOGUE` / `BUYING_POOLS` |
| `requested_qty`, `pledged_amount` | the whole key | stays in `MICRO_ORDERS` |

Decomposition gives `RESTAURANTS`, `SUPPLIERS`, `PRODUCTS`,
`SUPPLIER_CATALOGUE`, `BUYING_POOLS` and `MICRO_ORDERS`.

## 4. 3NF — no transitive dependency

Rule: in 2NF, and for every non-trivial `X -> A`, `X` is a superkey **or** `A`
is prime.

Real CoBuy example: in a flattened order row,

```
order_id -> pool_id -> catalogue_id -> price_per_unit
```

`price_per_unit` is transitively dependent on `order_id` through the pool and
the offer, so it does not belong in `MICRO_ORDERS`. It is stored once in
`SUPPLIER_CATALOGUE`, and `pledged_amount` is derived at order time from that
price (`requested_qty * price_per_unit`) and snapshotted for audit.

Second example: `restaurant_id -> owner_id -> user email`. The owner's email
lives in `USERS`; `RESTAURANTS` keeps only `owner_id`. Updating an email is one
row change, not one per restaurant.

## 5. BCNF — every determinant is a superkey

Rule: for every non-trivial functional dependency, the left side is a superkey.

| Relation | Candidate key(s) | Determinants | In BCNF? |
|---|---|---|---|
| `USERS` | `user_id`; `username`; `email` | all three | Yes |
| `USER_ROLES` | `(user_id, role_name)` | the composite key | Yes |
| `RESTAURANTS` | `restaurant_id` | `restaurant_id` | Yes |
| `SUPPLIERS` | `supplier_id`; `contact_email` | both | Yes |
| `PRODUCTS` | `product_id` | `product_id` | Yes |
| `SUPPLIER_CATALOGUE` | `catalogue_id`; `(supplier_id, product_id)` | both | Yes |
| `BUYING_POOLS` | `pool_id` | `pool_id` | Yes |
| `MICRO_ORDERS` | `order_id`; `(pool_id, restaurant_id)` | both | Yes |

`SUPPLIER_CATALOGUE` is the interesting case: `catalogue_id` and
`(supplier_id, product_id)` are both candidate keys, and every determinant is
one of them. Neither `supplier_id` nor `product_id` is unique on its own,
which is exactly why the composite unique constraint exists.

## 6. 4NF — multivalued dependencies

Rule: in BCNF, and no non-trivial multivalued dependency exists unless its
determinant is a superkey.

A genuine 4NF example for CoBuy would be a relation that stores two
**independent** multi-valued facts about the same entity. Suppose supplier
contact details were modelled as:

```
SUPPLIER_CONTACT(supplier_id, phone_number, contact_person)
```

If a supplier has several phone numbers and several contact people, and the two
lists are independent, the relation carries two MVDs:

```
supplier_id ->> phone_number
supplier_id ->> contact_person
```

Every combination of phone and contact person is then stored, which is
redundant. 4NF decomposition splits it into `SUPPLIER_PHONES` and
`SUPPLIER_CONTACTS`.

**Viva caution (as the context file warns):** the existence of `USER_ROLES`
does not by itself prove the original relation violated 4NF. It is a 1NF
decomposition of a repeating group. Claiming "we are in 4NF because
`USER_ROLES` exists" is a trap; the correct statement is that the final schema
has no non-trivial MVDs, and `USER_ROLES` removes the repeating role group.

## 7. Anomalies the design prevents

| Anomaly | Without normalization | With the 8-table design |
|---|---|---|
| Insertion | A supplier can only be recorded by creating an order | `SUPPLIERS` row exists independently |
| Update | Supplier email repeated on every order row | One row in `SUPPLIERS` |
| Deletion | Deleting the last order erases the supplier | `ON DELETE RESTRICT` blocks it |

## 8. Transactions in the aggregation engine

### 8.1 What one pledge must do atomically

1. Lock the pool row.
2. Validate `status = 'ACTIVE'` and `expiration_time` in the future.
3. Insert the micro-order (with `UNIQUE(pool_id, restaurant_id)` and
   `CHECK (requested_qty > 0)` enforced by MySQL).
4. Update `current_qty` and, if the target is reached, `status`.
5. Commit.

Any failure rolls back both the order and the quantity change, so a rejected
pledge can never move the total.

### 8.2 The lost-update problem, concretely

Pool at 350 kg, target 500 kg. Two kitchens each pledge 100 kg.

```
Naive read-then-write:
T1: read 350            T2: read 350
T1: write 450           T2: write 450
Result: 450 kg. 200 kg was pledged; 100 kg disappeared.
```

The implemented engine takes `SELECT ... FOR UPDATE` on the pool row first.
T2 blocks at that statement until T1 commits, then reads 450 and writes 550.
Serialisation is per pool row, so pledges to different pools still run in
parallel. `tests/concurrency_test.js` asserts **both** outcomes: 550 kg through
the real endpoint and 450/100 kg through the naive version.

### 8.3 Alternatives and why they were not chosen

| Alternative | Why not |
|---|---|
| Optimistic locking (`version` column, retry on conflict) | Requires retry loops in every caller and a schema change; a pledge is a short transaction, so blocking is cheaper and simpler to explain. |
| Application-level mutex | Fails the moment a second API instance runs; correctness would live in process memory, not the database. |
| `SERIALIZABLE` isolation | Overkill for a single-row counter; more lock contention and deadlock retries across unrelated queries. |
| Atomic `UPDATE ... SET current_qty = current_qty + ?` alone | Correct for the counter, but the status transition and the order insert still need the same transaction, and the pre-checks need a consistent read. The row lock keeps all of it in one place. |

### 8.4 Payment status

`PENDING -> PAID` is a separate, idempotent update guarded by ownership
(`PATCH /api/orders/:id/payment`). It is deliberately **not** part of the
pledge transaction: a kitchen may pay long after the contribution is recorded.
Only `PENDING` and `PAID` are allowed; refunds and gateways are out of scope.
