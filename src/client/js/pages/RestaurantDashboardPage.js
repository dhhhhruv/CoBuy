// ============================================================================
// File: src/client/js/pages/RestaurantDashboardPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Kitchen hub: profile anchor, nearby pools, pledged liability.
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { renderPoolCard } from '../components/PoolCard.js';
import { renderMOQProgressBar } from '../components/MOQProgressBar.js';

export async function renderRestaurantDashboardPage() {
  const restaurants = await api.getMyRestaurants();
  const profile = restaurants[0] || null;

  if (profile?.location) {
    store.setLocation(
      profile.location.latitude,
      profile.location.longitude,
      profile.addressText || store.location.address
    );
  }

  const pools = await api.getNearbyPools(store.location.latitude, store.location.longitude);
  const orders = profile ? await api.getMyOrders() : [];

  const activePools = pools.filter((pool) => pool.status === 'ACTIVE');
  const fulfilledPools = pools.filter((pool) => pool.status === 'FULFILLED');
  const pendingAmount = orders
    .filter((order) => order.paymentStatus === 'PENDING')
    .reduce((sum, order) => sum + Number(order.pledgedAmount || 0), 0);
  const totalPledged = orders.reduce((sum, order) => sum + Number(order.pledgedAmount || 0), 0);

  const setupBanner = profile ? '' : `
    <div class="card" style="border-color: var(--chip-text); margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h4 style="font-weight: 700; margin-bottom: 0.25rem;">Finish your kitchen setup</h4>
          <p style="font-size: 0.875rem; color: var(--text-2);">
            Discovery works now, but pledging into a pool requires a kitchen profile with GPS coordinates.
          </p>
        </div>
        <a href="#/profile/kitchen" class="btn btn-primary btn-sm">Create Kitchen Profile</a>
      </div>
    </div>
  `;

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Kitchen Procurement Dashboard</h1>
          <p style="color: var(--text-2); margin-top: 0.25rem;">
            ${profile ? `Location: <strong>${store.location.address}</strong>` : 'No kitchen profile yet'} · 5 km cluster active
          </p>
        </div>
        <a href="#/pools" class="btn btn-primary">Explore Available Pools →</a>
      </div>

      ${setupBanner}

      <div class="grid-4" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-label">Active Nearby Pools</div>
          <div class="stat-value" style="color: var(--accent);">${activePools.length}</div>
          <div class="form-help">Within 5 km radius</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Wholesale Unlocked</div>
          <div class="stat-value" style="color: var(--accent);">${fulfilledPools.length}</div>
          <div class="form-help">Target MOQ achieved</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">My Micro-Orders</div>
          <div class="stat-value">${orders.length}</div>
          <div class="form-help">Pledged contributions</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Payment Due</div>
          <div class="stat-value" style="color: var(--accent);">₹${pendingAmount.toFixed(2)}</div>
          <div class="form-help">Total pledged: ₹${totalPledged.toFixed(2)}</div>
        </div>
      </div>

      <div style="margin-bottom: 2.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.25rem; font-weight: 700;">Buying Pools Near Your Kitchen</h2>
          <a href="#/pools" style="color: var(--accent); font-weight: 600; text-decoration: none;">View All Pools (${pools.length})</a>
        </div>

        ${pools.length === 0 ? `
          <div class="card" style="text-align: center; padding: 2.5rem;">
            <h3>No active pools within 5 km</h3>
            <p style="color: var(--text-2); margin-top: 0.5rem;">Ask a supplier to launch a pool for your cluster.</p>
          </div>
        ` : `
          <div class="grid-2">
            ${pools.slice(0, 2).map(renderPoolCard).join('')}
          </div>
        `}
      </div>

      ${orders.length > 0 ? `
        <div class="card" style="margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Latest Pledge</h3>
            <a href="#/orders" class="btn btn-outline btn-sm">All Orders</a>
          </div>
          ${renderMOQProgressBar({
            currentQty: orders[0].poolCurrentQty,
            targetMoq: orders[0].poolTargetMoq,
            unitOfMeasure: orders[0].unitOfMeasure,
            status: orders[0].poolStatus
          })}
        </div>
      ` : ''}

      <div class="card">
        <h4 style="font-weight: 700; margin-bottom: 0.25rem;">How CoBuy Group Buying Works</h4>
        <p style="font-size: 0.875rem; color: var(--text-2);">
          You pledge only what your kitchen needs (e.g. 150 kg). Nearby kitchens in your 5 km cluster contribute the rest.
          Once the pool reaches the wholesale MOQ, the collective order is fulfilled at bulk rates.
        </p>
      </div>
    </div>
  `;
}
