// ============================================================================
// File: src/client/js/pages/CreatePoolPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Launch a buying pool from one of the supplier's catalogue offers.
// ============================================================================

import { api } from '../api/client.js';
import { showToast, showError } from '../components/Toast.js';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function renderCreatePoolPage(params, query) {
  const [offers, supplier] = await Promise.all([api.getMyCatalogue(), api.getMySupplier()]);
  const preselected = query?.get?.('catalogueId');
  const selected = offers.find((offer) => offer.catalogueId === preselected) || offers[0] || null;

  if (offers.length === 0) {
    return `
      <div class="container" style="max-width: 680px; padding-top: 2rem;">
        <div class="card" style="padding: 2.5rem;">
          <span class="badge badge-status-pending" style="margin-bottom: 0.75rem;">CATALOGUE EMPTY</span>
          <h2 style="font-weight: 800; margin-bottom: 0.5rem;">Publish an offer first</h2>
          <p style="color: var(--text-2); line-height: 1.6;">
            A buying pool is opened from a catalogue offer: the offer supplies the product, unit price and MOQ.
          </p>
          <a href="#/supplier/catalogue" class="btn btn-primary" style="margin-top: 1.5rem;">Go to Catalogue</a>
        </div>
      </div>
    `;
  }

  const warehouse = supplier?.warehouseLocation || { latitude: 12.9716, longitude: 77.5946 };

  return `
    <div class="container" style="max-width: 720px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Launch Buying Pool</h2>
            <p class="card-subtitle">Open a collective purchasing window for kitchens within 5 km of the zone centre.</p>
          </div>
        </div>

        <form id="form-create-pool">
          <div class="form-group">
            <label class="form-label" for="pool-catalogue-id">Catalogue Offer</label>
            <select id="pool-catalogue-id" class="form-control" required>
              ${offers.map((offer) => `
                <option value="${offer.catalogueId}"
                        data-product="${offer.productName}"
                        data-unit="${offer.unitOfMeasure}"
                        data-price="${offer.pricePerUnit}"
                        data-moq="${offer.minOrderQty}"
                        ${selected && offer.catalogueId === selected.catalogueId ? 'selected' : ''}>
                  ${offer.productName} — ₹${money(offer.pricePerUnit)}/${offer.unitOfMeasure} (MOQ ${money(offer.minOrderQty)})
                </option>
              `).join('')}
            </select>
            <span class="form-help">Only your company's offers are listed.</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="pool-lat">Zone Centre Latitude</label>
              <input type="number" step="0.000001" min="-90" max="90" id="pool-lat" class="form-control"
                     value="${warehouse.latitude}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="pool-lng">Zone Centre Longitude</label>
              <input type="number" step="0.000001" min="-180" max="180" id="pool-lng" class="form-control"
                     value="${warehouse.longitude}" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="pool-duration">Collection Window (Days)</label>
            <input type="number" id="pool-duration" class="form-control" value="7" min="1" max="90" required>
            <span class="form-help">After this window the pool stops accepting pledges (1–90 days).</span>
          </div>

          <div id="pool-preview" style="background-color: var(--bg); padding: 1rem; border-radius: var(--radius-card); margin-bottom: 1.5rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="color: var(--text-2);">Target MOQ (snapshot):</span>
              <strong id="preview-moq">—</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-2);">Wholesale price:</span>
              <strong id="preview-price">—</strong>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-2); margin-top: 0.6rem;">
              <code>target_moq</code> is copied from <code>min_order_qty</code> now, preserving this pool if the catalogue changes later.
            </p>
          </div>

          <button type="submit" id="btn-create-pool" class="btn btn-primary" style="width: 100%;">Create & Activate Pool</button>
        </form>
      </div>
    </div>
  `;
}

export function bindCreatePoolEvents(router) {
  const form = document.getElementById('form-create-pool');
  const select = document.getElementById('pool-catalogue-id');
  const previewMoq = document.getElementById('preview-moq');
  const previewPrice = document.getElementById('preview-price');

  function refreshPreview() {
    const option = select?.options[select.selectedIndex];
    if (!option) return;
    previewMoq.textContent = `${money(option.dataset.moq)} ${option.dataset.unit}`;
    previewPrice.textContent = `₹${money(option.dataset.price)} / ${option.dataset.unit}`;
  }

  select?.addEventListener('change', refreshPreview);
  refreshPreview();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('btn-create-pool');
    button.disabled = true;
    button.textContent = 'Creating Pool...';

    try {
      const pool = await api.createPool({
        catalogueId: select.value,
        latitude: Number(document.getElementById('pool-lat').value),
        longitude: Number(document.getElementById('pool-lng').value),
        durationDays: Number(document.getElementById('pool-duration').value)
      });
      showToast('Buying pool activated. Nearby kitchens can now join.', 'success');
      router.navigate(`/supplier/pools/${pool.poolId}`);
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.textContent = 'Create & Activate Pool';
    }
  });
}
