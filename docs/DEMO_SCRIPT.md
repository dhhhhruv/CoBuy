# CoBuy — Timed Demo Script (Plan Day 19)

Target: **7 minutes**, from a machine that has already run `npm run db:seed`.
Every step has a fallback so a failed request does not derail the demo.

## 0:00 — Setup (before the examiner arrives)

```bash
npm run db:seed     # idempotent: refreshes pool deadlines
npm start           # http://localhost:5000
```

Open `http://localhost:5000/` in one tab and `http://localhost:5000/health` in
another. The health banner should show `database: CONNECTED`.

Say: *"The seed recreates the tomato example from the report: Fresh Foods sells
tomatoes at ₹20/kg with a 500 kg MOQ, and pool BP01 already holds 350 kg."*

## 0:45 — Kitchen discovers the pool

1. Sign in as `demo.kitchen.c@cobuy.demo` / `Password123!`.
2. Open **Available Pools**. Point out BP01: Fresh Foods, ₹20/kg, 70% progress,
   ~4.5 km away, ACTIVE.
3. Say: *"Discovery runs `ST_Distance_Sphere` against the pool's geographic zone
   and hides pools outside 5 km. The progress bar reads `current_qty / target_moq`."*

Fallback: if the UI is unavailable, run
`curl "localhost:5000/api/pools/nearby?lat=12.9716&lng=77.5946&radius=5000"`.

## 2:00 — Kitchen pledges the remaining 150 kg

1. Open BP01 and pledge **150 kg**.
2. The modal shows `150 × ₹20 = ₹3,000`.
3. Submit. The pool flips to **FULFILLED** at 500 kg.

Say: *"The insert, the quantity update and the status change happen in one
transaction. The pool row is locked with `SELECT ... FOR UPDATE` first, so a
simultaneous pledge cannot overwrite this one."*

Fallback: `curl -X POST localhost:5000/api/orders -H "Authorization: Bearer <token>"
-H "Content-Type: application/json" -d '{"poolId":"...","requestedQty":150}'`.

## 3:15 — Payment status

1. Open **Orders**. The 150 kg order shows `PENDING`.
2. Click **Pay**. It becomes `PAID`.
3. Say: *"There is no gateway in scope. `payment_status` is a commitment flag
   changed by the restaurant owner or the pool's supplier, and the schema check
   constraint allows only PENDING or PAID."*

## 4:00 — Supplier view

1. Sign in as `demo.freshfoods@cobuy.demo` / `Password123!`.
2. Open **Catalogue**: tomatoes at ₹20/kg, 500 kg MOQ.
3. Open **Create Pool**: choose an offer, enter a centre point and a duration.
4. Say: *"A pool points at a catalogue offer, not a product, which is what fixes
   supplier, price and MOQ. `target_moq` is copied at creation so later price
   edits cannot rewrite an existing pool."*

Fallback: `GET /api/catalogue/me`, then `POST /api/pools` with a catalogue id.

## 5:15 — The concurrency proof (the headline)

```bash
npm run test:concurrency
```

Show the last lines: three rounds of 350 + 100 + 100 = **550 kg**, then the naive
version recording **100 kg of 200 kg**.

Say: *"That second number is the lost-update anomaly we are defending against.
The naive code reads 350, computes 450 and writes 450; two of those lose one
contribution. Our version serialises on the pool row."*

## 6:15 — Honest limitations

State, unprompted: no payment gateway, refunds or payouts; reaching the MOQ does
not mean the supplier accepted the order; no delivery tracking; `wallet_balance`
is stored but not debited; a kitchen cannot increase an existing pledge.

## 6:45 — Close

Return to the architecture slide: 8 procurement tables, 8 relationships (plus
`REFRESH_TOKENS` for auth), transactions on the aggregation path, and the test
suite that proves it (`npm run test:all`).

## Pre-demo checklist

- [ ] `npm run db:seed` run on the demo machine
- [ ] `npm start` healthy, `/health` green
- [ ] Demo accounts respond to login
- [ ] `npm run test:all` passed on this machine
- [ ] One spare `.env` backup (not committed)
