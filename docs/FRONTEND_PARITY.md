# CoBuy Frontend Parity Checklist

> **Purpose:** Every row in this file is a contract between the old plain-JS frontend
> and the new React frontend. A React page may only be called "done" once every
> checkbox in its section is ticked and confirmed by Dhruv.
>
> **Migration order:** Auth → Navigation / Shell → Health Banner → Restaurant Dashboard
> → Pool Discovery → Pool Detail → Orders → Kitchen Profile → Supplier Dashboard
> → Catalogue → Create Pool → Supplier Profile → 404 → Cutover

---

## Legend
- [ ] Not started
- [~] In progress
- [x] Done and confirmed

---

## 0. Shared Infrastructure

| Item | Detail |
|------|--------|
| CSS | `src/client/css/theme.css` imported once at app root; supports `:root`, `@media (prefers-color-scheme: dark)`, and `[data-theme]`; no hard-coded hex values anywhere |
| Theme toggle | Visible button in Navbar toggles light/dark; anti-flash inline script in `index.html` reads `localStorage` / OS preference; persists to `cobuy-theme` in `localStorage`; no emojis used |
| Auth token | Stored in `localStorage` as `cobuy_token`; sent as `Authorization: Bearer <token>` header |
| User object | Stored in `localStorage` as `cobuy_user` (JSON); shape `{ userId, username, email, roles[] }` |
| Role | Derived from `user.roles[0]`; two possible values: `restaurant_owner`, `supplier` |
| Location | In-memory default `{ latitude: 12.9716, longitude: 77.5946, address: "Indiranagar 100ft Road, Bangalore" }` |
| Mock fallback | Every API call falls back to `mockData.js` fixtures when the backend is offline or returns 4xx/5xx |
| No emoji | All emoji characters are eliminated across all pages, components, buttons, and headers; grep must return zero |

---

## 1. Auth Page — `/auth`

**Purpose:** Single entry point for both login and account registration.

### User can:
- [ ] Switch between Sign In and Create Account tabs
- [ ] Submit login form (email + password) → receives JWT + user object → redirects to role-appropriate dashboard
- [ ] Submit register form (username, email, password, role radio) → auto-logs in → redirects to dashboard
- [ ] Click "Kitchen A Demo" → logs in with mock kitchen credentials
- [ ] Click "Fresh Foods Supplier Demo" → logs in with mock supplier credentials
- [ ] See inline error message on failed login / register
- [ ] See success message before redirect

### API endpoints:
- `POST /api/users/login` — falls back to `_mockLogin` on network error or 404
- `POST /api/users/register` — falls back to `_mockRegister` on network error or 404

### States:
- [ ] Default (login tab active)
- [ ] Register tab active
- [ ] Submitting (button disabled, loading text)
- [ ] Error (alert box visible, red background)
- [ ] Success (alert box visible, green background)

---

## 2. Navigation & App Shell

**Purpose:** Persistent navbar present on every screen with role navigation, theme toggle, and session controls.

### User can:
- [ ] See the CoBuy wordmark (Newsreader font, no emoji)
- [ ] See the visible Theme Toggle button (toggles "Dark Mode" / "Light Mode", persisted to `localStorage`, zero emojis)
- [ ] See role-appropriate nav links (kitchen links vs supplier links)
- [ ] Click a nav link and navigate to the correct page
- [ ] See the current role badge (chip style, one colour)
- [ ] Click "Switch Role" to toggle between `restaurant_owner` and `supplier` for dev/viva testing
- [ ] Click "Sign Out" to clear session and go to `/auth`
- [ ] On mobile: nav links wrap / stack below the brand row

### States:
- [ ] Logged in (shows links, role badge, switch role, sign out, theme toggle)
- [ ] Logged out (shows theme toggle and "Sign In / Register" button)

---

## 3. Health Banner

**Purpose:** Thin bar at the very top (above navbar) showing live Express + MySQL status.

### User can:
- [ ] See a coloured dot (green = up, red = down)
- [ ] See a status text that describes API server + database state
- [ ] See the banner auto-refresh every 15 seconds without user interaction

### API endpoints:
- `GET /health`

### States:
- [ ] Checking (initial dot = red, text = "Checking...")
- [ ] Healthy — `{ status: "healthy" }` → dot green, shows uptime seconds
- [ ] Degraded — `{ status: "degraded" }` → dot red, shows DB disconnected message
- [ ] Offline — fetch throws → dot red, shows "Backend Offline / using mock" message

---

## 4. Restaurant Dashboard — `/dashboard`

**Purpose:** Main hub for a cloud kitchen owner: stat callouts, featured nearby pools, explainer card.

### User can:
- [ ] See four stat boxes: active nearby pools, fulfilled pools, micro-orders count, pledged liability total
- [ ] See up to 2 featured pool cards (from the same pool list as Pool Discovery)
- [ ] Click "Explore Available Pools" button → navigates to `/pools`
- [ ] Click "View All Pools (N)" link → navigates to `/pools`
- [ ] Click a pool card CTA → navigates to that pool's detail page
- [ ] See the "How CoBuy Group Buying Works" explainer card

### API endpoints:
- `GET /api/pools/nearby?lat=&lng=&radius=` — falls back to `mockBuyingPools`
- `GET /api/orders/my` — falls back to `mockOrders`

### States:
- [ ] Loading (data fetch in progress)
- [ ] Loaded (all data present)
- [ ] Error (fetch throws — currently silently falls back to mock; parity: same behaviour)

### Role guard:
- [ ] Redirect to `/supplier/dashboard` if `role === 'supplier'`

---

## 5. Pool Discovery — `/pools`

**Purpose:** Grid of all buying pools within 5 km with live search and status filter.

### User can:
- [ ] See a grid of pool cards
- [ ] Type in the search box → filters cards by product name or supplier name in real time
- [ ] Change the status dropdown (All / Active Only / Fulfilled) → filters cards
- [ ] See an empty state card when no pools match the filter
- [ ] Click the CTA on a pool card → navigates to `/pools/:id`

### API endpoints:
- `GET /api/pools/nearby?lat=&lng=&radius=` — falls back to `mockBuyingPools`

### States:
- [ ] Loading
- [ ] Loaded with results
- [ ] Empty (zero results after filter)

### Role guard:
- [ ] Accessible to `restaurant_owner` only; `supplier` redirects to `/supplier/dashboard`

---

## 6. Pool Card Component (shared)

**Purpose:** Single card used in both Dashboard and Pool Discovery.

### Displays:
- [ ] Product name (card-title / Newsreader)
- [ ] Supplier name
- [ ] Status chip (one chip style)
- [ ] Wholesale price and unit
- [ ] Distance in km
- [ ] MOQ progress bar
- [ ] CTA button ("Join Pool & Pledge Qty" if active, "View Pool Details" if fulfilled)

---

## 7. MOQ Progress Bar Component (shared)

**Purpose:** 8 px tall progress bar showing current vs target MOQ.

### Displays:
- [ ] "X of Y unit pooled" header
- [ ] Percentage label (right-aligned)
- [ ] Track + fill bar (fill colour from `--fill`)
- [ ] Footer: "Need X more..." or "Wholesale MOQ unlocked!" when fulfilled
- [ ] Status chip at footer right

---

## 8. Pool Detail — `/pools/:id`

**Purpose:** Full detail view of a single pool with micro-order modal.

### User can:
- [ ] Click "Back to Pool Discovery" → navigates to `/pools`
- [ ] See pool product name, supplier, price, status chip
- [ ] See MOQ progress bar + stat grid (Target MOQ / Current Pooled / Status)
- [ ] Click "Pledge Micro-Order For This Pool" → opens modal (disabled if fulfilled)
- [ ] In modal: type a quantity → see live calculation update (qty × price = pledged total)
- [ ] Submit the modal form → `POST /api/orders` → on success navigate to `/orders`
- [ ] Cancel or close the modal → modal closes, no navigation

### API endpoints:
- `GET /api/pools/:id` — falls back to `mockBuyingPools`
- `POST /api/orders` — falls back to mock order creation

### States:
- [ ] Loading
- [ ] Loaded (active pool — pledge button enabled)
- [ ] Loaded (fulfilled pool — pledge button disabled)
- [ ] Modal open
- [ ] Modal submitting (button disabled)
- [ ] Modal error (alert shown)

---

## 9. Orders Page — `/orders`

**Purpose:** Table of all micro-orders placed by this kitchen.

### User can:
- [ ] See a table with columns: Product, Requested Qty, Price, Pledged Amount, Pool Status, Payment Status, Date, Action
- [ ] See a "Pay ₹X" button for PENDING orders → clicking it simulates payment (changes to "Settled" text, no API call)
- [ ] See "Settled" text for already-PAID orders
- [ ] Click "+ Join Another Pool" → navigates to `/pools`
- [ ] See the Viva Engineering Note card below the table

### API endpoints:
- `GET /api/orders/my` — falls back to `mockOrders`

### States:
- [ ] Loading
- [ ] Empty (no orders) — empty state card with "Discover Pools" CTA
- [ ] Loaded with orders (table visible)

### Role guard:
- [ ] Accessible to `restaurant_owner` only

---

## 10. Kitchen Profile — `/profile/kitchen`

**Purpose:** Form to set the kitchen's business name, address and GPS coordinates.

### User can:
- [ ] Edit kitchen name, address, latitude, longitude
- [ ] Submit the form → updates in-memory location → navigates to `/pools`
- [ ] See the Viva Engineering Note about `ST_Distance_Sphere`

### API endpoints:
- None (updates client-side `location` state only)

### States:
- [ ] Default (fields pre-filled from current location state)
- [ ] Submitting (button disabled)
- [ ] Saved (navigate away)

---

## 11. Supplier Dashboard — `/supplier/dashboard`

**Purpose:** Wholesale hub: stat boxes, catalogue table with "Launch Pool" action.

### User can:
- [ ] See three stat boxes: catalogue offers count, active pools count, fulfilled pools count
- [ ] See a table of catalogue items with product, unit, price, MOQ and a "Launch Pool" link
- [ ] Click "Manage Catalogue" → navigates to `/supplier/catalogue`
- [ ] Click "+ Launch New Pool" → navigates to `/supplier/pools/new`
- [ ] Click "Launch Pool" in the table → navigates to `/supplier/pools/new`

### API endpoints:
- `GET /api/pools/nearby` — falls back to `mockBuyingPools` (for stat boxes)
- `getCatalogue()` — returns `mockCatalogue` (no real endpoint)

### States:
- [ ] Loading
- [ ] Loaded

### Role guard:
- [ ] Accessible to `supplier` only; `restaurant_owner` redirects to `/dashboard`

---

## 12. Wholesale Catalogue — `/supplier/catalogue`

**Purpose:** Two-column layout: add-offer form on the left, active offers list on the right.

### User can:
- [ ] Select a product from the dropdown, enter price and MOQ, submit → alert "added" → navigate to `/supplier/dashboard`
- [ ] See the list of current catalogue offers (name, MOQ, price per unit)

### API endpoints:
- `getProducts()` — returns `mockProducts`
- `getCatalogue()` — returns `mockCatalogue`

### States:
- [ ] Loading
- [ ] Loaded

---

## 13. Create Pool — `/supplier/pools/new`

**Purpose:** Form for suppliers to create a new buying pool from a catalogue offer.

### User can:
- [ ] Select a catalogue offer from dropdown (pre-fills product name, unit, MOQ, price)
- [ ] Enter center latitude and longitude for the pool's geographic zone
- [ ] Enter pool duration in days
- [ ] Submit → creates a mock pool, pushes to `mockBuyingPools`, navigates to `/pools`
- [ ] See the Viva Engineering Note about `target_moq` snapshot

### API endpoints:
- `getCatalogue()` — returns `mockCatalogue` (for dropdown)
- Pool creation is mock-only (pushes to in-memory array)

### States:
- [ ] Loading (catalogue fetch)
- [ ] Loaded (form ready)
- [ ] Submitting

---

## 14. Supplier Profile — `/supplier/profile`

**Purpose:** Form to set company name, billing email, warehouse GPS coordinates.

### User can:
- [ ] Edit company name, email, warehouse latitude and longitude
- [ ] Submit → alert "updated" → navigate to `/supplier/dashboard`

### API endpoints:
- None (UI-only, no real endpoint)

### States:
- [ ] Default (fields pre-filled with mock data)
- [ ] Submitting

---

## 15. 404 — any unmatched route

**Purpose:** Graceful fallback for unknown paths.

### User can:
- [ ] See a card with "404 — Page Not Found" and the unmatched path
- [ ] Click "Return to Dashboard" → navigates to `/dashboard`

---

## 16. Cross-cutting concerns

| Concern | Requirement |
|---------|-------------|
| Protected routes | Any route with `auth: true` in the old router redirects to `/auth` when there is no session. React version must do the same. |
| Role routing | `restaurant_owner` cannot reach `/supplier/*`. `supplier` cannot reach kitchen-only routes. Both are silently redirected. |
| No emoji | Zero emojis across all JSX, JS, CSS, and HTML files. Grep test must return 0 matches. |
| Mock fallback | Every API call that hits a 4xx/5xx or throws falls back to the matching mock fixture — same as the old client. |
| Token header | Every authenticated request sends `Authorization: Bearer <token>` from `localStorage`. |
| Theme | Sage & Linen theme; visible theme toggle button in Navbar; inline head anti-flash script in `index.html`; theme stored in `localStorage` under `cobuy-theme`; supports both system media query and manual `data-theme`. |
| Fonts | Newsreader 500 for wordmark, page titles, card titles. Hanken Grotesk 400/500 everywhere else. |
