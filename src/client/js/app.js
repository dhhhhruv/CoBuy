// ============================================================================
// File: src/client/js/app.js
// Owner: Debangshu (Frontend Lead)
// Purpose: SPA bootstrap — app shell, session hydration, route table, guards.
// ============================================================================

import { Router } from './router.js';
import { store } from './state.js';
import { api } from './api/client.js';
import { renderNavbar, bindNavbarEvents } from './components/Navbar.js';
import { initHealthCheck } from './components/HealthBanner.js';

// Pages
import { renderAuthPage, bindAuthEvents } from './pages/AuthPage.js';
import { renderRestaurantDashboardPage } from './pages/RestaurantDashboardPage.js';
import { renderKitchenProfilePage, bindKitchenProfileEvents } from './pages/KitchenProfilePage.js';
import { renderPoolDiscoveryPage, bindPoolDiscoveryEvents } from './pages/PoolDiscoveryPage.js';
import { renderPoolDetailPage, bindPoolDetailEvents } from './pages/PoolDetailPage.js';
import { renderOrdersPage, bindOrdersEvents } from './pages/OrdersPage.js';
import { renderSupplierDashboardPage } from './pages/SupplierDashboardPage.js';
import { renderSupplierProfilePage, bindSupplierProfileEvents } from './pages/SupplierProfilePage.js';
import { renderCataloguePage, bindCatalogueEvents } from './pages/CataloguePage.js';
import { renderCreatePoolPage, bindCreatePoolEvents } from './pages/CreatePoolPage.js';

const router = new Router();

function homeFor(role) {
  return role === 'supplier' ? '/supplier/dashboard' : '/dashboard';
}

function updateNav() {
  const navContainer = document.getElementById('navbar-container');
  if (navContainer) {
    navContainer.innerHTML = renderNavbar();
    bindNavbarEvents(router);
  }
}

// ----------------------------------------------------------------------------
// Route table. `auth` requires a hydrated session, `role` enforces the actor.
// ----------------------------------------------------------------------------
router.register('/auth', {
  render: renderAuthPage,
  afterRender: () => bindAuthEvents(router)
});

router.register('/dashboard', {
  auth: true,
  role: 'restaurant_owner',
  render: renderRestaurantDashboardPage
});

router.register('/profile/kitchen', {
  auth: true,
  role: 'restaurant_owner',
  render: renderKitchenProfilePage,
  afterRender: () => bindKitchenProfileEvents(router)
});

router.register('/pools', {
  auth: true,
  role: 'restaurant_owner',
  render: renderPoolDiscoveryPage,
  afterRender: () => bindPoolDiscoveryEvents()
});

router.register('/pools/:id', {
  auth: true,
  role: 'restaurant_owner',
  render: renderPoolDetailPage,
  afterRender: (params) => bindPoolDetailEvents(params, router)
});

router.register('/orders', {
  auth: true,
  role: 'restaurant_owner',
  render: renderOrdersPage,
  afterRender: () => bindOrdersEvents(router)
});

router.register('/supplier/dashboard', {
  auth: true,
  role: 'supplier',
  render: renderSupplierDashboardPage
});

router.register('/supplier/profile', {
  auth: true,
  role: 'supplier',
  render: renderSupplierProfilePage,
  afterRender: () => bindSupplierProfileEvents(router)
});

router.register('/supplier/catalogue', {
  auth: true,
  role: 'supplier',
  render: renderCataloguePage,
  afterRender: () => bindCatalogueEvents(router)
});

router.register('/supplier/pools/new', {
  auth: true,
  role: 'supplier',
  render: renderCreatePoolPage,
  afterRender: (params, query) => bindCreatePoolEvents(router, query)
});

// Suppliers inspect their own pools through the same detail view kitchens use.
router.register('/supplier/pools/:id', {
  auth: true,
  role: 'supplier',
  render: renderPoolDetailPage,
  afterRender: (params) => bindPoolDetailEvents(params, router)
});

// ----------------------------------------------------------------------------
// Session bootstrap: a stored token is verified against /api/users/me so role
// changes and revoked sessions can never leave a stale UI signed in.
// ----------------------------------------------------------------------------
async function hydrateSession() {
  if (!api.getToken()) {
    store.setUser(null);
    return null;
  }

  try {
    const me = await api.getMe();
    store.setUser(me);

    // A returning kitchen must discover pools around its own profile, not
    // around the placeholder location held in the store.
    if (store.role === 'restaurant_owner') {
      try {
        const restaurants = await api.getMyRestaurants();
        const profile = restaurants[0];
        if (profile?.location) {
          store.setLocation(
            profile.location.latitude,
            profile.location.longitude,
            profile.addressText || store.location.address
          );
        }
      } catch (profileError) {
        // Profile setup is optional; discovery still works with the default zone.
        console.warn('[Session] Could not load kitchen location:', profileError.message);
      }
    }

    return me;
  } catch (error) {
    // A network outage should not log the user out; only an auth failure does.
    if (error.status === 401) {
      api.clearTokens();
      store.setUser(null);
    }
    return store.user;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div id="navbar-container"></div>
    <main id="view-container" class="main-content"></main>
    <div id="toast-container" class="toast-container"></div>
  `;

  router.setContainer(document.getElementById('view-container'));
  store.subscribe(() => updateNav());
  initHealthCheck();

  // A failed refresh means the session is over; drop local state and force auth.
  window.addEventListener('cobuy:session-expired', () => {
    if (!store.user) return;
    api.clearTokens();
    store.setUser(null);
    router.navigate('/auth');
  });

  const user = await hydrateSession();
  updateNav();

  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    router.navigate(user ? homeFor(store.role) : '/auth');
    return;
  }

  if (user && hash.startsWith('#/auth')) {
    router.navigate(homeFor(store.role));
    return;
  }

  router.handleRoute();
});
