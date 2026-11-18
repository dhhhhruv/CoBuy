// ============================================================================
// File: src/client/js/pages/SupplierDashboardPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Wholesale supplier management hub
// ============================================================================

import { api } from '../api/client.js';

export async function renderSupplierDashboardPage() {
  const catalogue = await api.getCatalogue();
  const pools = await api.getNearbyPools();

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Supplier Hub: Fresh Foods Wholesale</h1>
          <p style="color: var(--text-secondary); margin-top: 0.25rem;">
            Manage wholesale catalogue items, track group-buying pools, and monitor MOQ fulfillments
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <a href="#/supplier/catalogue" class="btn btn-outline btn-sm">Manage Catalogue</a>
          <a href="#/supplier/pools/new" class="btn btn-primary btn-sm">+ Launch New Pool</a>
        </div>
      </div>

      <div class="grid-3" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-label">Catalogue Offers</div>
          <div class="stat-value">${catalogue.length}</div>
          <div class="form-help">Active products with MOQ</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Active Pools</div>
          <div class="stat-value" style="color: var(--secondary);">
            ${pools.filter(p => p.status === 'ACTIVE').length}
          </div>
          <div class="form-help">Collecting restaurant micro-orders</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Fulfilled Pools</div>
          <div class="stat-value" style="color: var(--primary);">
            ${pools.filter(p => p.status === 'FULFILLED').length}
          </div>
          <div class="form-help">Ready for batch dispatch</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">Your Wholesale Catalogue</h3>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Price / Unit</th>
                <th>Supplier MOQ</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${catalogue.map(c => `
                <tr>
                  <td><strong>${c.productName}</strong></td>
                  <td>${c.unitOfMeasure}</td>
                  <td style="color: var(--primary); font-weight: 700;">₹${c.pricePerUnit}</td>
                  <td><strong>${c.minOrderQty}</strong> ${c.unitOfMeasure}</td>
                  <td>
                    <a href="#/supplier/pools/new" class="btn btn-primary btn-sm">Launch Pool</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

