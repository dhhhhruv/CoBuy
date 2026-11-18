# CoBuy — Frontend Screen Inventory & Role-Access Specification

> **Owner:** Debangshu (Frontend Lead)  
> **Source of Truth:** [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) and [`docs/API_CONTRACT.md`](API_CONTRACT.md)  
> **Framework:** React + Vite + Tailwind CSS

---

## 1. Role-Based Access Control (RBAC) Matrix

| Screen Name | Path / Route | Public | `restaurant_owner` | `supplier` | Description & Key UI Elements |
|---|---|:---:|:---:|:---:|---|
| **Login / Register** | `/auth` | ✅ | ✅ | ✅ | Email, password, role toggle (`restaurant_owner` / `supplier`). Stores JWT in `localStorage`. |
| **System Health Banner** | Persistent | ✅ | ✅ | ✅ | Real-time status indicator querying `GET /health` (API server + MySQL connection). |
| **Restaurant Dashboard** | `/dashboard` | ❌ | ✅ | ❌ | Overview of active micro-orders, quick links to nearby pools, total pledged liability. |
| **Kitchen Profile Setup** | `/profile/kitchen` | ❌ | ✅ | ❌ | Restaurant name, physical address, and GPS coordinates (`lat`, `lng`) needed for 5 km proximity queries. |
| **Pool Discovery (Explore Pools)**| `/pools` | ❌ | ✅ | ❌ | Live list/grid of buying pools within 5 km. Filter by product, status (`ACTIVE`), and distance. |
| **Pool Detail & MOQ Tracker** | `/pools/:id` | ❌ | ✅ | ❌ | Full pool specs, supplier info, unit price, target MOQ, **interactive visual progress bar**, time remaining. |
| **Micro-Order Placement Modal**| Modal on `/pools/:id`| ❌ | ✅ | ❌ | Input requested quantity. Computes $\text{Pledged Amount} = \text{Requested Qty} \times \text{Unit Price}$. Single-order check. |
| **My Orders & Payment Status** | `/orders` | ❌ | ✅ | ❌ | List of restaurant's micro-orders, pool status badge (`ACTIVE`/`FULFILLED`), and payment status (`PENDING`/`PAID`). |
| **Supplier Dashboard** | `/supplier/dashboard` | ❌ | ❌ | ✅ | Overview of supplier's active pools, catalogue offerings, fulfillment notices. |
| **Supplier Profile Setup** | `/supplier/profile` | ❌ | ❌ | ✅ | Company name, warehouse GPS coordinates, contact details. |
| **Catalogue Management** | `/supplier/catalogue`| ❌ | ❌ | ✅ | Form to add product offers, set unit price, and define supplier Minimum Order Quantity (MOQ). |
| **Pool Creation Studio** | `/supplier/pools/new`| ❌ | ❌ | ✅ | Select catalogue offer, define pool geographic zone & duration, launch active pool. |

---

## 2. Core UI Components Breakdown

### 2.1. `MOQProgressBar`
- **Purpose:** Visual progress tracking towards the supplier's wholesale MOQ.
- **Inputs:** `current_qty` (e.g. 350.00), `target_moq` (e.g. 500.00), `unit` (e.g. "kg"), `status` (`ACTIVE` / `FULFILLED`).
- **Visual States:**
  - `ACTIVE` ($< 100\%$): Vibrant amber/blue progress bar showing `XX%` filled, quantity remaining (e.g. "150 kg to unlock wholesale").
  - `FULFILLED` ($\ge 100\%$): Green glowing bar with "MOQ Unlocked / Fulfilled" banner.
  - `EXPIRED`: Greyed-out bar indicating target was not reached before deadline.

### 2.2. `PoolCard`
- **Purpose:** Compact card rendered in pool discovery grid.
- **Contents:** Product name, wholesale price (e.g. `₹20.00 / kg`), supplier name, distance from kitchen (e.g. `2.4 km away`), embedded `MOQProgressBar`, and "Join Pool" CTA.

### 2.3. `MicroOrderModal`
- **Purpose:** Placement dialog for cloud kitchens pledging micro-orders.
- **Inputs & Validation:**
  - Input: `requested_qty` (numerical, `> 0`).
  - Read-only formula display:
    $$\text{Pledged Amount} = \text{requested\_qty} \times \text{price\_per\_unit}$$
  - Guard logic: Warns or blocks if quantity would push pool beyond reasonable threshold or if kitchen already holds an order in this pool (`UNIQUE(pool_id, restaurant_id)`).

### 2.4. `PaymentStatusBadge`
- **Purpose:** Clear indicator of transaction status.
- **States:**
  - `PENDING` (Yellow pill): Pledged commitment made, awaiting checkout / settlement.
  - `PAID` (Green pill): Settled micro-order.

---

## 3. Data Flow & State Management

1. **Authentication Context (`AuthContext`):**
   - Holds `{ user: { userId, username, email, roles }, token }`.
   - Automatically attaches `Authorization: Bearer <token>` to all API requests via an Axios / Fetch wrapper.
2. **Location State:**
   - Caches the current kitchen's GPS coordinates (`lat`, `lng`) to pass as query parameters to `/api/pools/nearby?lat=...&lng=...&radius=5000`.
3. **Optimistic & Reactive UI Updates:**
   - When a micro-order is successfully submitted, the pool's `current_qty` and progress percentage update immediately in local state before triggering a background refresh.

