// ============================================================================
// File: src/client/js/components/Navbar.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Main persistent navigation bar with dynamic role switching & auth state
// ============================================================================

import { store } from '../state.js';
import { api } from '../api/client.js';

export function renderNavbar() {
  const user = store.user;
  const role = store.role;

  const kitchenLinks = `
    <li><a href="#/dashboard" class="nav-link">Overview</a></li>
    <li><a href="#/pools" class="nav-link">Explore Pools (5km)</a></li>
    <li><a href="#/orders" class="nav-link">My Micro-Orders</a></li>
    <li><a href="#/profile/kitchen" class="nav-link">Kitchen Location</a></li>
  `;

  const supplierLinks = `
    <li><a href="#/supplier/dashboard" class="nav-link">Supplier Hub</a></li>
    <li><a href="#/supplier/catalogue" class="nav-link">Wholesale Catalogue</a></li>
    <li><a href="#/supplier/pools/new" class="nav-link">Create Pool</a></li>
    <li><a href="#/supplier/profile" class="nav-link">Warehouse Profile</a></li>
  `;

  return `
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="#/dashboard" class="brand">
          CoBuy
          <span class="brand-badge">B2B POOLING</span>
        </a>

        <ul class="nav-links">
          ${user ? (role === 'supplier' ? supplierLinks : kitchenLinks) : ''}
        </ul>

        <div class="nav-actions">
          <!-- Theme Toggle (plain text, no emoji) -->
          <button id="btn-theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme" title="Toggle theme">
            <span id="theme-toggle-text">Theme</span>
          </button>

          ${user ? `
            <span class="badge badge-role-${role === 'supplier' ? 'supplier' : 'kitchen'}">
              ${role === 'supplier' ? 'Supplier' : 'Cloud Kitchen'}
            </span>

            <!-- Quick Role Switcher for local dev & viva demo -->
            <button id="btn-toggle-role" class="btn btn-outline btn-sm" title="Toggle role for testing">
              Switch Role
            </button>

            <button id="btn-logout" class="btn btn-outline btn-sm">
              Sign Out (${user.username || 'User'})
            </button>
          ` : `
            <a href="#/auth" class="btn btn-primary btn-sm">Sign In / Register</a>
          `}
        </div>
      </div>
    </header>
  `;
}

export function bindNavbarEvents(router) {
  // Theme toggle
  const html = document.documentElement;
  const themeBtn = document.getElementById('btn-theme-toggle');
  const themeText = document.getElementById('theme-toggle-text');

  function updateThemeUI(theme) {
    if (themeText) {
      themeText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
  }

  const currentTheme = html.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  updateThemeUI(currentTheme);

  themeBtn?.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    try {
      localStorage.setItem('cobuy-theme', next);
    } catch (e) {}
    updateThemeUI(next);
  });

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      store.setUser(null, null);
      api.setToken(null);
      router.navigate('/auth');
    });
  }

  const btnToggleRole = document.getElementById('btn-toggle-role');
  if (btnToggleRole) {
    btnToggleRole.addEventListener('click', () => {
      const nextRole = store.role === 'restaurant_owner' ? 'supplier' : 'restaurant_owner';
      store.switchRole(nextRole);
      router.navigate(nextRole === 'supplier' ? '/supplier/dashboard' : '/dashboard');
    });
  }
}
