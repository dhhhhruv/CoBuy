# CoBuy — Order Flow in Plain SQL (Plan Day 5)

Written before the aggregation engine code, as the plan required, so the
transaction can be explained by hand in a viva without pointing at JavaScript.

Placeholder values follow the context file's tomato example:

| Value | Meaning |
|---|---|
| `BP01` | tomato pool, target 500 kg, currently 350 kg |
| `R01` | Kitchen A's restaurant row |
| `500` | micro-order id (any UUID) |
| `150` | quantity Kitchen A pledges (kg) |
| `20.00` | Fresh Foods price per kg |

## 1. The shape of one order, step by step

```sql
-- Step 0: confirm the pool and lock its row for the rest of this transaction.
START TRANSACTION;

SELECT pool_id, status, current_qty, target_moq, expiration_time
FROM buying_pools
WHERE pool_id = 'BP01'
FOR UPDATE;
-- returns 350.00 / 500.00 / ACTIVE

-- Step 1: the restaurant's contribution is recorded first.
INSERT INTO micro_orders
  (order_id, pool_id, restaurant_id, requested_qty, pledged_amount, payment_status, created_at)
VALUES
  ('500', 'BP01', 'R01', 150.00, 3000.00, 'PENDING', NOW());

-- Step 2: the running total moves by exactly the quantity just inserted.
UPDATE buying_pools
SET current_qty = current_qty + 150.00,
    status = CASE
               WHEN current_qty + 150.00 >= target_moq THEN 'FULFILLED'
               ELSE status
             END
WHERE pool_id = 'BP01';

COMMIT;
```

After `COMMIT`: `current_qty = 500.00`, `status = 'FULFILLED'`, and Kitchen A
holds one micro-order worth ₹3,000 with `payment_status = 'PENDING'`.

## 2. Why `FOR UPDATE` is the important line

Without the lock, the same order runs as:

```
T1 reads 350 -> computes 500 -> writes 500
T2 reads 350 -> computes 500 -> writes 500   (its own 150 kg vanishes)
```

Two kitchens each pledge 150 kg but the pool grows by 150 kg, not 300 kg. This
is the **lost-update anomaly**; it is a concurrency problem, not a SQL typo.

`SELECT ... FOR UPDATE` takes an exclusive row lock on `BP01` until the
transaction ends. The second order blocks at that statement, then reads the
already-updated 500 kg, so serial execution is forced per pool. Different pools
still proceed in parallel because the lock is per row.

The alternative — doing the arithmetic in JavaScript (`read 350`, `write 500`)
— is what the naive version does, and it fails the concurrency test on purpose.

## 3. Why the insert and the update share one transaction

ACID, in CoBuy terms:

- **Atomicity:** the micro-order row and the pool total either both exist or neither does. A crash between the two statements would otherwise leave a 150 kg contribution that the pool never counted.
- **Consistency:** `UNIQUE(pool_id, restaurant_id)` and `CHECK (requested_qty > 0)` are evaluated inside the same unit of work, so a rejected order cannot still move the total.
- **Isolation:** the row lock defines the serialisation point for concurrent pledges.
- **Durability:** after `COMMIT`, the contribution survives a restart.

## 4. Other rules expressed in SQL

```sql
-- Duplicate participation is prevented by the schema, not by application code.
-- UNIQUE (pool_id, restaurant_id)

-- Only ACTIVE pools accept orders (checked under the lock).
WHERE pool_id = 'BP01' AND status = 'ACTIVE';

-- Expired pools are closed lazily, before they are read or ordered on.
UPDATE buying_pools
SET status = 'EXPIRED'
WHERE status = 'ACTIVE' AND expiration_time <= NOW();

-- Pledged amount is derived from the offer price, never sent by the client.
-- pledged_amount = requested_qty * supplier_catalogue.price_per_unit
```

## 5. What the implemented engine does differently

`src/orders/orderController.js` performs the same steps through Prisma, with:

- `tx.$queryRaw ... FOR UPDATE` for the lock;
- validation of status and expiry **after** the lock is taken;
- `lifecycle.assertTransition` to guarantee only `ACTIVE -> FULFILLED` can result from an order;
- `overfillBy` reported when the pledge pushes the total past the target.

`tests/concurrency_test.js` runs both this version and a deliberately naive
read-then-write version so the lost update can be demonstrated live.
