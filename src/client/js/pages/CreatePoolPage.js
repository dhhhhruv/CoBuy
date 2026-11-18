// ============================================================================
// File: src/client/js/pages/CreatePoolPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Form for suppliers to launch new Buying Pools from catalogue offers
// ============================================================================

import { api } from '../api/client.js';
import { mockBuyingPools } from '../api/mockData.js';

export async function renderCreatePoolPage() {
  const catalogue = await api.getCatalogue();

  return `
    <div class="container" style="max-width: 680px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Launch Buying Pool</h2>
            <p class="card-subtitle">Open a collective purchasing pool for local cloud kitchens</p>
          </div>
        </div>

        <form id="form-create-pool">
          <div class="form-group">
            <label class="form-label">Select Catalogue Offer</label>
            <select id="pool-catalogue-id" class="form-control" required>
              ${catalogue.map(c => `
                <option value="${c.catalogueId}" data-moq="${c.minOrderQty}" data-product="${c.productName}" data-unit="${c.unitOfMeasure}" data-price="${c.pricePerUnit}">
                  ${c.productName} — ₹${c.pricePerUnit}/${c.unitOfMeasure} (MOQ: ${c.minOrderQty})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="pool-lat">Center Latitude</label>
              <input type="number" step="0.000001" id="pool-lat" class="form-control" value="12.9716" required>
              <span class="form-help">Pool geographic anchor</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="pool-lng">Center Longitude</label>
              <input type="number" step="0.000001" id="pool-lng" class="form-control" value="77.5946" required>
              <span class="form-help">SRID 4326</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="pool-duration">Pool Duration (Days)</label>
            <input type="number" id="pool-duration" class="form-control" value="3" min="1" max="14" required>
            <span class="form-help">Kitchens have this window to pool orders towards the MOQ</span>
          </div>

          <div style="background-color: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.85rem;">
            <strong>Viva Engineering Note:</strong> <code>target_moq</code> is copied directly from <code>min_order_qty</code> at pool creation time. 
            This snapshot preserves historical integrity in case the supplier later edits their catalog minimum.
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%;">Create & Activate Pool</button>
        </form>
      </div>
    </div>
  `;
}

export function bindCreatePoolEvents(router) {
  const form = document.getElementById('form-create-pool');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const select = document.getElementById('pool-catalogue-id');
    const selectedOpt = select.options[select.selectedIndex];

    const newPool = {
      poolId: `bp-${Date.now()}`,
      catalogueId: select.value,
      productName: selectedOpt.getAttribute('data-product'),
      unitOfMeasure: selectedOpt.getAttribute('data-unit'),
      supplierName: 'Fresh Foods Wholesale Ltd.',
      pricePerUnit: selectedOpt.getAttribute('data-price'),
      targetMoq: selectedOpt.getAttribute('data-moq'),
      currentQty: '0.00',
      status: 'ACTIVE',
      distanceMeters: 1200,
      geographicZone: {
        latitude: parseFloat(document.getElementById('pool-lat').value),
        longitude: parseFloat(document.getElementById('pool-lng').value)
      },
      expirationTime: new Date(Date.now() + 86400000 * 3).toISOString()
    };

    mockBuyingPools.unshift(newPool);
    alert('Buying pool created and activated! Nearby kitchens can now discover it.');
    router.navigate('/pools');
  });
}

