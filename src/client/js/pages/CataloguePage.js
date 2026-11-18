// ============================================================================
// File: src/client/js/pages/CataloguePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Manage wholesale catalogue entries (price per unit, MOQ)
// ============================================================================

import { api } from '../api/client.js';

export async function renderCataloguePage() {
  const catalogue = await api.getCatalogue();
  const products = await api.getProducts();

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Wholesale Catalogue Offers</h1>
          <p style="color: var(--text-secondary); margin-top: 0.25rem;">
            Define product wholesale prices and Minimum Order Quantities (MOQ)
          </p>
        </div>
      </div>

      <div class="grid-2">
        <!-- New Catalogue Entry Form -->
        <div class="card">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1.25rem;">Add New Product Offer</h3>
          <form id="form-add-catalogue">
            <div class="form-group">
              <label class="form-label">Select Product</label>
              <select id="cat-product" class="form-control" required>
                ${products.map(p => `
                  <option value="${p.productId}">${p.name} (${p.unitOfMeasure})</option>
                `).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label" for="cat-price">Wholesale Price (₹)</label>
                <input type="number" step="0.50" id="cat-price" class="form-control" placeholder="20.00" required>
              </div>

              <div class="form-group">
                <label class="form-label" for="cat-moq">Minimum Order Qty (MOQ)</label>
                <input type="number" step="10" id="cat-moq" class="form-control" placeholder="500.00" required>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Add to Catalogue</button>
          </form>
        </div>

        <!-- Current Catalogue List -->
        <div>
          <div class="card">
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Active Offers (${catalogue.length})</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${catalogue.map(c => `
                <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="font-size: 1rem;">${c.productName}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                      MOQ: <strong>${c.minOrderQty} ${c.unitOfMeasure}</strong>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary);">₹${c.pricePerUnit}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">per ${c.unitOfMeasure}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function bindCatalogueEvents(router) {
  const form = document.getElementById('form-add-catalogue');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Catalogue offer added successfully!');
    router.navigate('/supplier/dashboard');
  });
}

