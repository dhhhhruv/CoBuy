// ============================================================================
// File: src/client/js/pages/SupplierDashboardPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Supplier hub backed by the company's own catalogue and pools.
// ============================================================================

import { api } from '../api/client.js';
import { renderMOQProgressBar, moqRemaining } from '../components/MOQProgressBar.js';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function renderSupplierDashboardPage() {
  const supplier = await api.getMySupplier();

  if (!supplier) {
    return `
      <div class="container" style="max-width: 720px; padding-top: 2rem;">
        <div class="card" style="padding: 2.5rem;">
          <span class="badge badge-status-pending" style="margin-bottom: 0.75rem;">SETUP NEEDED</span>
          <h1 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem;">Create your supplier company</h1>
          <p style="color: var(--text-2); line-height: 1.6;">
            Catalogue offers and buying pools belong to a supplier company profile. Add your company name,
            contact email and warehouse coordinates to unlock the catalogue.
          </p>
          <a href="#/supplier/profile" class="btn btn-primary" style="margin-top: 1.5rem;">Create Company Profile</a>
        </div>
      </div>
    `;
  }

  const [catalogue, pools] = await Promise.all([
    api.getMyCatalogue(),
    api.getPools({ supplierId: supplier.supplierId })
  ]);

  const activePools = pools.filter((pool) => pool.status === 'ACTIVE');
  const fulfilledPools = pools.filter((pool) => pool.status === 'FULFILLED');
  const totalPooled = pools.reduce((sum, pool) => sum + Number(pool.currentQty || 0), 0);
  const warehouse = supplier.warehouseLocation;

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Supplier Hub: ${supplier.companyName}</h1>
          <p style="color: var(--text-2); margin-top: 0.25rem;">
            Warehouse ${warehouse ? `${warehouse.latitude.toFixed(4)}, ${warehouse.longitude.toFixed(4)}` : 'not set'}
            · ${supplier.contactEmail}
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <a href="#/supplier/catalogue" class="btn btn-outline btn-sm">Manage Catalogue</a>
          <a href="#/supplier/pools/new" class="btn btn-primary btn-sm">+ Launch New Pool</a>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-label">Catalogue Offers</div>
          <div class="stat-value">${catalogue.length}</div>
          <div class="form-help">Products with price & MOQ</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Active Pools</div>
          <div class="stat-value" style="color: var(--accent);">${activePools.length}</div>
          <div class="form-help">Collecting micro-orders</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Fulfilled Pools</div>
          <div class="stat-value" style="color: var(--accent);">${fulfilledPools.length}</div>
          <div class="form-help">MOQ reached</div>
        </div>

        <div class="stat-box">
          <div class="stat-label">Quantity Pooled</div>
          <div class="stat-value" style="color: var(--accent);">${totalPooled.toFixed(1)}</div>
          <div class="form-help">Across all your pools</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.25rem; font-weight: 700;">Your Wholesale Catalogue</h3>
          <a href="#/supplier/catalogue" class="btn btn-outline btn-sm">Edit Offers</a>
        </div>
        ${catalogue.length === 0 ? `
          <p style="color: var(--text-2);">
            No offers yet. <a href="#/supplier/catalogue" style="color: var(--accent);">Publish your first offer</a> to start a pool.
          </p>
        ` : `
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
                ${catalogue.map((offer) => `
                  <tr>
                    <td><strong>${offer.productName}</strong></td>
                    <td>${offer.unitOfMeasure}</td>
                    <td style="color: var(--accent); font-weight: 700;">₹${money(offer.pricePerUnit)}</td>
                    <td><strong>${money(offer.minOrderQty)}</strong> ${offer.unitOfMeasure}</td>
                    <td>
                      <a href="#/supplier/pools/new?catalogueId=${offer.catalogueId}" class="btn btn-primary btn-sm">Launch Pool</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.25rem; font-weight: 700;">Your Buying Pools (${pools.length})</h3>
          <a href="#/supplier/pools/new" class="btn btn-primary btn-sm">+ Launch Pool</a>
        </div>
        ${pools.length === 0 ? `
          <p style="color: var(--text-2);">
            No pools yet. <a href="#/supplier/pools/new" style="color: var(--accent);">Launch one</a> from a catalogue offer.
          </p>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${pools.map((pool) => {
              const remaining = moqRemaining(pool);
              return `
                <div style="border: 1px solid var(--border); padding: 1rem; border-radius: var(--radius-card);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
                    <div>
                      <strong style="font-size: 1rem;">${pool.productName}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-2); margin-top: 0.15rem;">
                        ₹${money(pool.pricePerUnit)} / ${pool.unitOfMeasure}
                        · ${remaining > 0 ? `${remaining.toFixed(1)} ${pool.unitOfMeasure} still needed` : 'MOQ reached'}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                      <span class="badge badge-status-${pool.status.toLowerCase()}">${pool.status}</span>
                      <a href="#/supplier/pools/${pool.poolId}" class="btn btn-outline btn-sm">View Orders</a>
                    </div>
                  </div>
                  ${renderMOQProgressBar(pool)}
                  <div style="font-size: 0.72rem; color: var(--text-2); margin-top: 0.5rem;">
                    ${pool.expirationTime ? `Closes ${new Date(pool.expirationTime).toLocaleString()}` : 'No expiry set'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
