// ============================================================================
// File: src/client/js/app.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Main frontend application bootstrap, route registration & state binding
// ============================================================================

import { Router } from './router.js';
import { store } from './state.js';
import { renderNavbar, bindNavbarEvents } from './components/Navbar.js';
import { renderHealthBanner, initHealthCheck } from './components/HealthBanner.js';

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

function updateNav() {
  const navContainer = document.getElementById('navbar-container');
  if (navContainer) {
    navContainer.innerHTML = renderNavbar();
    bindNavbarEvents(router);
  }
}

// ----------------------------------------------------------------------------
// Route Registrations
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
  afterRender: bindPoolDiscoveryEvents
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
  afterRender: bindOrdersEvents
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
  afterRender: () => bindCreatePoolEvents(router)
});

// App Startup
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    ${renderHealthBanner()}
    <div id="navbar-container"></div>
    <main id="view-container" class="main-content"></main>
    <div id="toast-container" class="toast-container"></div>
  `;

  router.setContainer(document.getElementById('view-container'));

  updateNav();
  initHealthCheck();

  store.subscribe(() => {
    updateNav();
    router.handleRoute();
  });

  // Default redirect if unauthenticated or fresh visit
  if (!window.location.hash) {
    if (!store.user) {
      router.navigate('/auth');
    } else {
      router.navigate(store.role === 'supplier' ? '/supplier/dashboard' : '/dashboard');
    }
  } else {
    router.handleRoute();
  }
});

