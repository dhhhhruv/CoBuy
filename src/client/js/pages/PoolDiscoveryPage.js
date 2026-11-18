// ============================================================================
// File: src/client/js/pages/PoolDiscoveryPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Pool discovery grid with filters & 5 km radius indicators
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { renderPoolCard } from '../components/PoolCard.js';

export async function renderPoolDiscoveryPage() {
  const pools = await api.getNearbyPools(store.location.latitude, store.location.longitude);

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Discover Active Buying Pools</h1>
          <p style="color: var(--text-secondary); margin-top: 0.25rem;">
            Showing bulk deals within <strong>5.0 km</strong> of ${store.location.address}
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <input type="text" id="pool-search" class="form-control" placeholder="Search tomatoes, onions..." style="width: 240px;">
          <select id="filter-status" class="form-control" style="width: 140px;">
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE" selected>Active Only</option>
            <option value="FULFILLED">Fulfilled</option>
          </select>
        </div>
      </div>

      <div id="pools-grid" class="grid-2">
        ${pools.map(renderPoolCard).join('')}
      </div>
    </div>
  `;
}

export function bindPoolDiscoveryEvents() {
  const searchInput = document.getElementById('pool-search');
  const filterSelect = document.getElementById('filter-status');
  const grid = document.getElementById('pools-grid');

  async function filterPools() {
    const query = (searchInput?.value || '').toLowerCase();
    const statusFilter = filterSelect?.value || 'ALL';
    const all = await api.getNearbyPools(store.location.latitude, store.location.longitude);

    const filtered = all.filter(p => {
      const matchName = p.productName.toLowerCase().includes(query) || p.supplierName.toLowerCase().includes(query);
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchName && matchStatus;
    });

    if (grid) {
      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h3>No buying pools match your criteria</h3>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Try adjusting your search terms or status filter.</p>
          </div>
        `;
      } else {
        grid.innerHTML = filtered.map(renderPoolCard).join('');
      }
    }
  }

  searchInput?.addEventListener('input', filterPools);
  filterSelect?.addEventListener('change', filterPools);
}

