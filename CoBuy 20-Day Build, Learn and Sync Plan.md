# CoBuy: 20-Day Build, Learn and Sync Plan

For a team of 3 | Mon 2 Nov to Sat 21 Nov 2026 (Sun 22 Nov = deadline day, buffer only)

Source of truth: the CoBuy context file (project explanation, 8 tables, ER, DFD, normalization, viva notes). Nothing in this plan adds scope beyond it. Anything that looks like a good extra idea goes through the Idea Check (Prompt 5) and needs a team decision first.

## 1. How we work each day

The roles come from the context file. Dhruv = Database and Authentication. Shaaz = Aggregation Engine. Debangshu = Frontend.&#32;

Daily rhythm:

- Morning (5 min): run Prompt 4 to catch up on what the others changed.
- Build: run Prompt 1 with the day's task. The agent writes the code.
- Understand (before anything is merged): run Prompt 2. The builder then teaches the other two for about 15 minutes. Each of the other two asks at least 2 questions. Rule: nobody merges code they cannot explain.
- Evening (5 min): run Prompt 3 and paste the result into DAILY\_LOG.md.

Shared files in the repo (/docs): PROJECT\_CONTEXT.md (the context file), DECISIONS.md, DAILY\_LOG.md, API\_CONTRACT.md.

Folder ownership: Dhruv owns database and auth code. Shaaz owns pools, orders and aggregation code. Debangshu owns the frontend. If you need a change in someone else's area, use Prompt 6 and message the owner.

Time assumptions (correct me if wrong): weekdays about 1-1.5 hours, Thursdays 30 minutes with no new building, Saturdays and Sundays 5 to 6 hours.

## 2. Decisions to settle on Day 1

The context file does not settle these. Log each answer in DECISIONS.md before the agent builds anything that depends on it.

1. Database engine: MySQL or PostgreSQL. The file's ST\_Distance\_Sphere example is MySQL-specific; PostgreSQL would need PostGIS or a different distance method.
2. Frontend: React or plain HTML, CSS and JavaScript.
3. Login mechanism: the file stores password\_hash but does not say whether login uses tokens (JWT) or server sessions.
4. Who creates a buying pool: a restaurant, a supplier, or the system. Step 4 of the file says "creating or joining" but not who.
5. The 5 km rule: which point is the reference (the joining restaurant's location\_coord versus the pool's geographic\_zone), and what exactly makes a restaurant eligible for a pool. The file itself says this needs a clear rule.
6. What happens when an order is bigger than the quantity still needed (for example the pool is at 350 of 500 kg and a kitchen asks for 200 kg): reject, accept partially, or allow overfill.
7. Pool statuses and expiry: the file suggests ACTIVE, FULFILLED, EXPIRED, CANCELLED as suggested values only. Decide the final list and how EXPIRED is set (checked when a pool is read or ordered on, or by a scheduled job).
8. payment\_status: the allowed values, and how a status changes to PAID when there is no payment gateway. Also whether wallet\_balance is touched at all (the file only describes it as a stored balance).
9. How a logged-in supplier user is linked to a SUPPLIERS record (see section 3).
10. What the submission contains besides the code (report, diagrams, demo, viva) so the last days are planned correctly.

Also confirm: pledged\_amount = requested\_qty x price\_per\_unit. The file's examples fit this (200 kg at 20 rupees/kg = 4,000), but it is not stated as a rule.

## 3. ER diagram rework: what to settle

The current diagram was not visible to the planner, so share it on Day 1. From the text of the context file, these are the points the reworked ER should settle:

- SUPPLIERS has no link to USERS. The file lets a user hold the supplier role, but nothing ties a user to a supplier record, so a supplier dashboard cannot know which company a user represents.
- MICRO\_ORDERS is described as "one restaurant's participation in one pool", yet no UNIQUE(pool\_id, restaurant\_id) is listed. Either the constraint exists or a restaurant may place several orders in one pool. Pick one and say why.
- BUYING\_POOLS.target\_moq repeats SUPPLIER\_CATALOGUE.min\_order\_qty, and current\_qty is derivable from the sum of MICRO\_ORDERS. Either justify them as deliberate (a snapshot at pool creation, a stored running total for speed) or change them. An examiner testing the 3NF/BCNF claim will ask.
- Show mandatory versus optional participation and the 1:N cardinalities on all 7 relationships, with PK, FK and UK marked.

The ER diagram must match the DDL exactly, so it is redrawn from the final schema on Day 3.

## 4. Calendar at a glance

- Mon 2 Nov, Day 1: Align and decide (normal)
- Tue 3 Nov, Day 2: Setup (normal)
- Wed 4 Nov, Day 3: Database schema (normal)
- Thu 5 Nov, Day 4: LIGHT, review only
- Fri 6 Nov, Day 5: Authentication (normal)
- Sat 7 Nov, Day 6: BIG, profiles, catalogue (weekend)
- Sun 8 Nov, Day 7: BIG, pools, location logic (weekend). Checkpoint 1
- Mon 9 Nov, Day 8: Pool discovery
- Tue 10 Nov, Day 9: Aggregation engine core
- Wed 11 Nov, Day 10: Concurrency proof, payments, order history
- Thu 12 Nov, Day 11: LIGHT, review only
- Fri 13 Nov, Day 12: Integration
- Sat 14 Nov, Day 13: BIG, end-to-end run (weekend)
- Sun 15 Nov, Day 14: BIG, documentation and feature freeze (weekend). Checkpoint 2
- Mon 16 Nov, Day 15: Testing and hardening
- Tue 17 Nov, Day 16: Viva prep, own area
- Wed 18 Nov, Day 17: Viva prep, swap areas
- Thu 19 Nov, Day 18: LIGHT, quiz only
- Fri 20 Nov, Day 19: Mock viva and demo rehearsal
- Sat 21 Nov, Day 20: Final run, packaging (weekend)
- Sun 22 Nov: Deadline. Submit. No new work.

## 5. Day-by-day plan

### Day 1, Mon 2 Nov: Align and decide

- All: each person runs Prompt 0 on the context file and writes a 5-line summary of the project. Compare them; any difference is a misunderstanding to fix. Settle the decisions in section 2.
- Dhruv bring the current ER diagram and propose the revised version using section 3.
- Shaaz: sketch on paper the pool lifecycle (statuses and transitions) and the order flow from decisions 6, 7 and 8.
- Debangshu: list the screens the file names (restaurant dashboard, supplier dashboard, available pools, quantity progress bars, order information, payment status) and who sees which.
- Understand: each person explains the tomato example (200 + 150 + 150 = 500 kg) in their own words.

### Day 2, Tue 3 Nov: Setup

- Dhruv: the agent scaffolds the Node.js and Express backend, database connection, environment config and a health-check route. Understand: what middleware is, why environment variables, why a connection pool.
- Shaaz: write the seed data plan from the file's own examples (Fresh Foods and Green Basket, tomatoes, onions, cooking oil, Kitchens A, B and C, pool BP01). The script is run after the schema exists.
- Debangshu: the agent scaffolds the frontend with routing and empty page shells using mock data. Understand: how the pages and components are organised.
- Dhruv and Debangshu together: write the first version of API\_CONTRACT.md, starting from the file's examples (POST /api/users/register, GET /api/products, GET /api/pools, POST /api/orders).

### Day 3, Wed 4 Nov: Database schema

- Dhruv: the agent writes the DDL for all 8 tables from the final ER (PKs, FKs, UNIQUE, NOT NULL, composite PK on USER\_ROLES, UNIQUE(supplier\_id, product\_id), CHECK constraints). Understand: why UUID, why DECIMAL for money, why GEOMETRY, what ON DELETE rules mean and why each was chosen.
- Shaaz: review the BUYING\_POOLS and MICRO\_ORDERS parts, then run and verify the seed script. Understand: why requested\_qty > 0 is a CHECK, why each foreign key points where it does.
- Debangshu: redraw the final ER diagram from the DDL, with PK, FK, UK and cardinalities.

### Day 4, Thu 5 Nov: LIGHT (30 min, no building)

- All: run Prompt 4, then Prompt 8 on the schema. Write 3 questions each about Days 2 and 3 in DAILY\_LOG.md; answer them on Friday.
- Debangshu: 10-minute check that the ER diagram matches the DDL.

### Day 5, Fri 6 Nov: Authentication

- Dhruv: the agent builds registration and login (password hashing, the token or session approach from decision 3, inserting into USERS and assigning USER\_ROLES). Understand: hashing versus encryption, why salting, the alternative login mechanism and why it was not chosen, why roles live in USER\_ROLES and not in USERS.
- Shaaz: before any Node code, write the order flow in plain SQL on the database console: start a transaction, insert a micro-order, update the pool's current\_qty, commit. Understand it by hand first.
- Debangshu: login and register screens against the API contract (mock first, real once the API is up).

### Day 6, Sat 7 Nov: Profiles and catalogue (BIG)

- Dhruv: the agent builds role-based route guards plus restaurant profile CRUD (business\_name, location\_coord, wallet\_balance, address\_text) and supplier profile CRUD (company\_name, contact\_email, warehouse\_coord). Understand: authentication versus authorization, why owner\_id comes from the logged-in user and not from the request body.
- Shaaz: the agent builds products CRUD and SUPPLIER\_CATALOGUE CRUD (price\_per\_unit, min\_order\_qty), including a clean error when UNIQUE(supplier\_id, product\_id) is violated. Understand: why this is a junction table and why neither column is unique alone. (This takes catalogue CRUD out of Dev 1's list in the file; see the cross-check list at the end.)
- Debangshu: profile forms and catalogue pages on the real API.

### Day 7, Sun 8 Nov: Pools and location (BIG)

- Dhruv: the agent builds location handling: store and read coordinates, spatial index, and the 5 km distance query using the engine's distance function per decision 5. Understand: what a spatial reference system is, why distance on a sphere, why an index matters.
- Shaaz: the agent builds pool creation per decision 4 and pool listing (BUYING\_POOLS with catalogue\_id, geographic\_zone, status, current\_qty, target\_moq, expiration\_time). Understand: why a pool points at a catalogue row and not at a product.
- Debangshu: pool list page with quantity progress bars and the restaurant dashboard shell.
- Checkpoint 1 (evening): register, log in, create a profile, a supplier lists an offer, and a pool appears in the UI.

### Day 8, Mon 9 Nov: Pool discovery

- Dhruv: the agent builds the discovery endpoint that returns pools relevant to a restaurant within 5 km.
- Shaaz: the agent builds the pool lifecycle rules in one place: status values, allowed transitions, expiry check per decision 7. Understand: why rules live in one module.
- Debangshu: discovery screen using the endpoint, showing supplier, product, price, MOQ and progress.

### Day 9, Tue 10 Nov: Aggregation engine core

- Shaaz: the agent builds POST /api/orders as one transaction: insert the micro-order, update current\_qty, compare with target\_moq, set FULFILLED when reached. Understand in depth: why a transaction, how row locking or an atomic update prevents the lost-update problem, and the alternatives (optimistic locking with a version column, application-level locking, serializable isolation) with why each was or was not chosen.
- Dhruv: review it and add the database-level safeguards agreed in the DDL (CHECK constraints, allowed status values), and map database errors to clear API errors.
- Debangshu: the order form (quantity in, pledged amount shown) wired to the endpoint.

### Day 10, Wed 11 Nov: Concurrency proof, payments, order history

- Shaaz: the agent writes a test that fires simultaneous orders at the pool from the file's example (350 kg, two kitchens each ordering 100 kg) and shows the total is correct. Run the same test against a naive read-then-write version to see the lost update. This is a test only, not a feature.
- Dhruv: the agent builds payment\_status updates per decision 8, and order-history endpoints (a restaurant sees its own orders; a supplier sees orders on its pools).
- Debangshu: order list, pledged amounts and payment status displays.

### Day 11, Thu 12 Nov: LIGHT (30 min, no building)

- All: Prompts 4 and 8 on the aggregation code. Each person writes a 5-line explanation of how two kitchens ordering at once stay correct.

### Day 12, Fri 13 Nov: Integration

- Debangshu: connect the restaurant dashboard (pools, orders, payment status) and supplier dashboard (offers and the pools on them) to the real APIs.
- Dhruv: make validation and error responses consistent with API\_CONTRACT.md.
- Shaaz: finish expiry handling (decision 7) and the oversized-order rule (decision 6).

### Day 13, Sat 14 Nov: End-to-end run (BIG)

- All: run the file's full story: a supplier lists tomatoes at 20 rupees/kg with a 500 kg MOQ, a pool is created, Kitchens A (200 kg), B (150 kg) and C (150 kg) contribute, the pool goes ACTIVE to FULFILLED, and payments show PAID, PAID, PENDING. Log every bug.
- Each dev fixes bugs in their own area. Debangshu covers loading, empty and error states. Dhruv finalises the demo seed data.

### Day 14, Sun 15 Nov: Documentation and feature freeze (BIG)

- Dhruv: final ER, the 7 relationships (why each is 1:N, the two junction tables), and the constraints list.
- Shaaz: normalization write-up UNF to 4NF with CoBuy-correct examples. Note: the file's 2NF example uses (order\_id, product\_id), which is not a relation in the final design, so replace it with a real CoBuy example. Also write the transactions section.
- Debangshu: DFD Level 0 (Kitchen Owner, Supplier, CoBuy) and Level 1 (the four processes and their data stores).
- Checkpoint 2 (evening): feature freeze. After this, only bug fixes.

### Day 15, Mon 16 Nov: Testing and hardening

- Dhruv: negative tests for auth, roles and input validation.
- Shaaz: aggregation edge cases: exactly hitting the MOQ, oversized order, expired pool, the same order submitted twice.
- Debangshu: UI error states, a written run-the-project README, a check on a second device or browser.

### Day 16, Tue 17 Nov: Viva prep, own area

- Each dev presents their own area cold for 10 minutes to the other two. Run Prompt 7 on that area. Build a shared Q&A sheet from the file's sections (why UUID, DECIMAL, GEOMETRY, transactions, normalization rules, ER versus DFD).

### Day 17, Wed 18 Nov: Viva prep, swap areas

- Each dev explains a teammate's module. Every gap found is a fix to the notes. Prepare the honest limitations answer from the file: payment gateway, refunds, supplier confirmation, delivery tracking and payouts are possible extensions, not implemented features.

### Day 18, Thu 19 Nov: LIGHT (30 min, quiz only)

- All: a 30-minute quiz with Prompt 7. Only critical bug fixes.

### Day 19, Fri 20 Nov: Mock viva and demo rehearsal

- All: a full mock viva across the whole project, then a timed demo run from a written script. Fix only small items.

### Day 20, Sat 21 Nov: Final run and packaging (BIG)

- All: clone the repo fresh and run it from the README, run the demo once more, package everything the submission needs (decision 10), and lock the repo.

### Sun 22 Nov: Deadline

- Submit in the morning. No new work.

## 6. Prompt pack

Replace the text in \[brackets\] before pasting.

### Prompt 0: Master context (paste first in every agent session)

> You are helping a team of 3 build CoBuy, a B2B group-buying platform where independent cloud kitchens within a 5 km radius combine their orders to meet a supplier's minimum order quantity (MOQ). Read /docs/PROJECT\_CONTEXT.md, then /docs/DECISIONS.md, then /docs/API\_CONTRACT.md before doing anything.
>
> Rules:
>
> 1. Build only what those files describe. Do not add features, tables, columns, endpoints or libraries that are not in them. A payment gateway, refunds, supplier order confirmation, delivery tracking and payouts are NOT in scope.
> 2. If something is ambiguous, or you think an addition would be really good, stop and ask me using the Idea Check format. Do not implement it.
> 3. Stack: as recorded in DECISIONS.md.
> 4. I am \[Dev 1 / Dev 2 / Dev 3\] and I own \[area\]. Do not edit files outside my area; tell me what to ask the owner instead.
> 5. Keep code simple and commented in plain language. I must be able to explain every line in a viva.
> 6. Before coding, tell me your plan and why. After coding, explain it using the explanation format.

### Prompt 1: Daily build

> Today is Day \[N\] (\[date\]). My task: \[paste today's task from the plan\]. Step 1: restate the task, list the files you will create or change, and wait for my OK. Step 2: build in small steps and say what each step did. Step 3: stop and wait for me to ask for the explanation. Do not touch anything outside today's task.

### Prompt 2: Explain the code (the whys, the why-nots, the hows)

> Explain the code you just wrote so I can defend it in a viva. For each file and function: (1) what it does and where it sits in the CoBuy flow (supplier offers, pool, micro-orders, aggregation, MOQ reached); (2) how it works, step by step in plain language; (3) why this approach; (4) the alternatives you could have used, why this one was chosen, and when an alternative would be better; (5) what breaks if it is removed or changed; (6) which tables and columns it touches and why; (7) the limitations I should admit honestly. Finish with 5 viva-style questions for me, one at a time, and grade my answers. Do not introduce new features.

### Prompt 3: End-of-day log

> Write today's DAILY\_LOG entry in under 200 words using this format: Date, Dev, Task / What was built (files) / Schema or API changes (exact) / Decisions made and why / Open questions or blockers / What the other two devs must know or do / How to run and test it.

### Prompt 4: Morning catch-up

> Read /docs/DAILY\_LOG.md and /docs/DECISIONS.md. I am \[Dev X\]. In under 150 words tell me what changed since my last entry, what affects my work today, anything that conflicts with my area, and questions I should ask teammates.

### Prompt 5: Idea Check (cross-check before building anything new)

> You want to propose something that is not in the project files. Do not build it. Write: IDEA / Why it helps CoBuy / Tables, endpoints or screens it touches / Time cost / Risk / Your recommendation (do or skip) / The simplest alternative that stays inside the current scope. Then wait. I will take it to the team and record the decision in DECISIONS.md.

### Prompt 6: Schema or contract change

> I need to change \[table, column or endpoint\]. List every file and every teammate affected, write the migration or the updated API\_CONTRACT.md entry, and draft the message to the affected devs. Do not apply anything until I confirm.

### Prompt 7: Viva drill

> Act as a strict but fair DBMS examiner for CoBuy, using PROJECT\_CONTEXT.md and our actual code. Ask one question at a time on \[ER and relations / normalization / DFD / constraints / transactions / my code module\]. After each answer say what was right, wrong and missing, give the model answer, then ask a harder follow-up. Include traps, such as claiming 4NF is proven by a table's existence, or claiming a feature is implemented when it is only proposed. After 10 questions give me a score and my weak spots.

### Prompt 8: Thursday light review (30 minutes)

> In 10 lines, summarise what \[teammate\]'s code from Day \[N\] does and why it was designed that way. Then ask me 3 questions to check I understand it, and list 3 questions I should ask \[teammate\] to find gaps.

## 7. Items to cross-check with the team

These are my planning suggestions, not project decisions:

- Moving catalogue CRUD from Dev 1 to Dev 2 to even the load (Day 6).
- The concurrency test on Day 10, which shows the lost-update problem from the file's own 350 kg example. It is a test, not a feature.
- Putting the documentation (ER, normalization, DFD) all on Day 14 rather than spreading it out.
- Feature freeze at the end of Day 14.
