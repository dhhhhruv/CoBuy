// ============================================================================
// File: src/client/js/components/Navbar.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Role-aware navigation, session identity, logout and theme switch.
// ============================================================================

import { store } from '../state.js';
import { api } from '../api/client.js';
import { showToast } from './Toast.js';

const ROLE_LABELS = {
  restaurant_owner: 'Cloud Kitchen',
  supplier: 'Supplier'
};

const ROLE_BADGES = {
  restaurant_owner: 'badge-role-kitchen',
  supplier: 'badge-role-supplier'
};

const NAV_LINKS = {
  restaurant_owner: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/pools', label: 'Discover Pools' },
    { href: '/orders', label: 'My Orders' },
    { href: '/profile/kitchen', label: 'Kitchen Profile' }
  ],
  supplier: [
    { href: '/supplier/dashboard', label: 'Dashboard' },
    { href: '/supplier/catalogue', label: 'Catalogue' },
    { href: '/supplier/pools/new', label: 'Create Pool' },
    { href: '/supplier/profile', label: 'Supplier Profile' }
  ]
};

function displayName(user) {
  return user?.username || user?.name || user?.email || 'Account';
}

function currentRoute() {
  return (window.location.hash || '#/').replace('#', '') || '/';
}

function themeLabel() {
  return document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
}

export function renderNavbar() {
  const { user, role } = store;
  const route = currentRoute();
  const isActive = (prefix) => route === prefix || route.startsWith(`${prefix}/`);

  const links = !user
    ? ''
    : (NAV_LINKS[role] || [])
        .map(({ href, label }) => `
          <a href="#${href}" class="nav-link${isActive(href) ? ' active' : ''}">${label}</a>
        `)
        .join('');

  const otherRoles = (user?.roles || []).filter((candidate) => candidate !== role);
  const switchRole = otherRoles.length > 0
    ? `<button type="button" id="btn-switch-role" class="btn btn-outline btn-sm"
               data-role="${otherRoles[0]}">Switch to ${ROLE_LABELS[otherRoles[0]] || otherRoles[0]}</button>`
    : '';

  const identity = user
    ? `<span class="text-muted">${displayName(user)}</span>
       <span class="badge ${ROLE_BADGES[role] || 'badge'}">${ROLE_LABELS[role] || role || ''}</span>
       ${switchRole}
       <button type="button" id="btn-logout" class="btn btn-outline btn-sm">Sign Out</button>`
    : `<a href="#/auth" class="btn btn-primary btn-sm">Sign In / Register</a>`;

  return `
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="#/" class="brand">
          <span class="brand-badge">C</span>
          CoBuy
        </a>

        <nav class="nav-links">
          ${links}
        </nav>

        <div class="nav-actions">
          <button type="button" id="btn-theme" class="btn btn-outline btn-sm" title="Toggle colour theme">
            ${themeLabel()}
          </button>
          ${identity}
        </div>
      </div>
    </header>
  `;
}

export function bindNavbarEvents(router) {
  document.getElementById('btn-theme')?.addEventListener('click', (event) => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    event.currentTarget.textContent = themeLabel();
    try {
      localStorage.setItem('cobuy-theme', next);
    } catch (e) {
      /* private mode — theme simply won't persist */
    }
  });

  document.getElementById('btn-switch-role')?.addEventListener('click', (event) => {
    const nextRole = event.currentTarget.getAttribute('data-role');
    store.switchRole(nextRole);
    router.navigate(nextRole === 'supplier' ? '/supplier/dashboard' : '/dashboard');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch (error) {
      // The server session may already be gone (expired token); still clear locally.
      console.warn('[Navbar] Logout request failed:', error.message);
    }
    store.setUser(null);
    showToast('Signed out.');
    // If we are already on /auth the hash does not change, so re-render directly.
    if (window.location.hash === '#/auth') router.handleRoute();
    else router.navigate('/auth');
  });
}
