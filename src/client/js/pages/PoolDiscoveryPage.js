// ============================================================================
// File: src/client/js/pages/PoolDiscoveryPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: 5 km pool discovery with radius, status and text filters.
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { renderPoolCard } from '../components/PoolCard.js';
import { showError } from '../components/Toast.js';

const RADIUS_OPTIONS = [2000, 5000, 10000];
let radius = 5000;
let initialPools = [];

function emptyState(message, hint) {
  return `
    <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
      <h3>${message}</h3>
      <p style="color: var(--text-2); margin-top: 0.5rem;">${hint}</p>
    </div>
  `;
}

export async function renderPoolDiscoveryPage() {
  const [active, fulfilled] = await Promise.all([
    api.getNearbyPools(store.location.latitude, store.location.longitude, radius, 'ACTIVE'),
    api.getNearbyPools(store.location.latitude, store.location.longitude, radius, 'FULFILLED')
  ]);
  const pools = [...active, ...fulfilled].sort(
    (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
  );
  initialPools = pools;

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Discover Buying Pools</h1>
          <p style="color: var(--text-2); margin-top: 0.25rem;">
            Around <strong>${store.location.address}</strong> · <span id="pool-count">${pools.length}</span> pool(s) in range
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <input type="text" id="pool-search" class="form-control" placeholder="Search product or supplier" style="width: 220px;">
          <select id="filter-status" class="form-control" style="width: 150px;">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE" selected>Active only</option>
            <option value="FULFILLED">Fulfilled</option>
          </select>
          <select id="filter-radius" class="form-control" style="width: 150px;">
            ${RADIUS_OPTIONS.map((option) => `
              <option value="${option}" ${option === radius ? 'selected' : ''}>
                Within ${option / 1000} km
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <div id="pools-grid" class="grid-2">
        ${pools.length === 0
          ? emptyState('No buying pools in range', 'Ask a supplier to launch a pool near your kitchen, or widen the radius.')
          : pools.map(renderPoolCard).join('')}
      </div>

      <div class="card" style="margin-top: 2rem; background: var(--bg);">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">How the radius filter works</h4>
        <p style="font-size: 0.825rem; color: var(--text-2); line-height: 1.6;">
          Distance is computed by MySQL with <code>ST_Distance_Sphere</code> between your kitchen's
          <code>POINT SRID 4326</code> and the pool's zone centre. Pledging is only permitted within 5 km,
          even if you widen the view radius — the server re-checks proximity inside the order transaction.
        </p>
      </div>
    </div>
  `;
}

export function bindPoolDiscoveryEvents() {
  const searchInput = document.getElementById('pool-search');
  const statusSelect = document.getElementById('filter-status');
  const radiusSelect = document.getElementById('filter-radius');
  const grid = document.getElementById('pools-grid');
  const count = document.getElementById('pool-count');

  let cache = initialPools;

  async function load() {
    try {
      const [active, fulfilled] = await Promise.all([
        api.getNearbyPools(store.location.latitude, store.location.longitude, radius, 'ACTIVE'),
        api.getNearbyPools(store.location.latitude, store.location.longitude, radius, 'FULFILLED')
      ]);
      cache = [...active, ...fulfilled].sort(
        (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
      );
      applyFilters();
    } catch (error) {
      showError(error);
      if (grid) grid.innerHTML = emptyState('Could not load pools', error.message);
    }
  }

  function applyFilters() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const status = statusSelect?.value || 'ALL';

    const filtered = cache.filter((pool) => {
      const matchesText = !query
        || pool.productName.toLowerCase().includes(query)
        || pool.supplierName.toLowerCase().includes(query);
      const matchesStatus = status === 'ALL' || pool.status === status;
      return matchesText && matchesStatus;
    });

    if (count) count.textContent = String(filtered.length);

    if (!grid) return;
    grid.innerHTML = filtered.length === 0
      ? emptyState('No buying pools match your filters', 'Try another search term, status or radius.')
      : filtered.map(renderPoolCard).join('');
  }

  searchInput?.addEventListener('input', applyFilters);
  statusSelect?.addEventListener('change', applyFilters);
  radiusSelect?.addEventListener('change', () => {
    radius = Number(radiusSelect.value);
    load();
  });

  // The initial render already fetched this radius; only re-fetch when it changes.
  applyFilters();
}
