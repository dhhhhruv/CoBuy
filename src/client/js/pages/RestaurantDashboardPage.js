// ============================================================================
// File: src/client/js/pages/RestaurantDashboardPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Main hub for cloud kitchen owners (orders, savings, nearby pools)
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { renderPoolCard } from '../components/PoolCard.js';

export async function renderRestaurantDashboardPage() {
  const pools = await api.getNearbyPools(store.location.latitude, store.location.longitude);
  const orders = await api.getMyOrders();

  const activePoolsCount = pools.filter(p => p.status === 'ACTIVE').length;
  const fulfilledPoolsCount = pools.filter(p => p.status === 'FULFILLED').length;
  const totalPledged = orders.reduce((sum, o) => sum + Number(o.pledgedAmount || 0), 0);

  return `
    <div class="container">
      <!-- Welcome Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Kitchen Procurement Dashboard</h1>
          <p style="color: var(--text-secondary); margin-top: 0.25rem;">
            Location: <strong>${store.location.address}</strong> (≤ 5.0 km cluster active)
          </p>
        </div>
        <a href="#/pools" class="btn btn-primary">
          Explore Available Pools →
        </a>
      </div>

      <!-- Stat Callouts -->
      <div class="grid-4" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-label">Active Nearby Pools</div>
          <div class="stat-value" style="color: var(--secondary);">${activePoolsCount}</div>
          <div class="form-help">Within 5 km radius</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Wholesale Unlocked</div>
          <div class="stat-value" style="color: var(--primary);">${fulfilledPoolsCount}</div>
          <div class="form-help">Target MOQ achieved</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">My Micro-Orders</div>
          <div class="stat-value">${orders.length}</div>
          <div class="form-help">Pledged contributions</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Pledged Liability</div>
          <div class="stat-value" style="color: var(--primary-hover);">₹${totalPledged.toFixed(2)}</div>
          <div class="form-help">Est. savings: ~35% vs retail</div>
        </div>
      </div>

      <!-- Featured Nearby Pools -->
      <div style="margin-bottom: 2.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.25rem; font-weight: 700;">Buying Pools Near Your Kitchen</h2>
          <a href="#/pools" style="color: var(--primary); font-weight: 600; text-decoration: none;">View All Pools (${pools.length})</a>
        </div>

        <div class="grid-2">
          ${pools.slice(0, 2).map(renderPoolCard).join('')}
        </div>
      </div>

      <!-- Quick Concept Explainer for Viva -->
      <div class="card" style="border-color: var(--border);">
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div>
            <h4 style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
              How CoBuy Group Buying Works (The 5 km Cluster Rule)
            </h4>
            <p style="font-size: 0.875rem; color: var(--text-secondary);">
              You pledge only what your kitchen needs (e.g. 150 kg). Nearby kitchens in your 5 km cluster contribute the rest. 
              Once the pool reaches the wholesale MOQ (e.g. 500 kg), the order locks at bulk rates.
            </p>
          </div>
        </div>
      </div>

    </div>
  `;
}

