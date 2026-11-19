// ============================================================================
// File: src/client/js/pages/CataloguePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Supplier catalogue CRUD — publish offers, edit price/MOQ, delete.
// ============================================================================

import { api } from '../api/client.js';
import { showToast, showError } from '../components/Toast.js';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export async function renderCataloguePage() {
  const [offers, products] = await Promise.all([api.getMyCatalogue(), api.getProducts()]);
  const offeredIds = new Set(offers.map((offer) => offer.productId));
  const availableProducts = products.filter((product) => !offeredIds.has(product.productId));

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">Wholesale Catalogue</h1>
          <p style="color: var(--text-2); margin-top: 0.25rem;">
            ${offers.length} active offer${offers.length === 1 ? '' : 's'} · prices and MOQs drive every pool you launch
          </p>
        </div>
        <a href="#/supplier/dashboard" class="btn btn-outline btn-sm">← Supplier Hub</a>
      </div>

      <div class="grid-2" style="align-items: start;">
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.25rem;">Publish an Offer</h3>
            ${availableProducts.length === 0 ? `
              <p style="color: var(--text-2); font-size: 0.9rem;">
                Every product in the shared catalogue already has an offer from your company.
                Add a new base product below to expand your range.
              </p>
            ` : `
              <form id="form-add-offer">
                <div class="form-group">
                  <label class="form-label" for="offer-product">Product</label>
                  <select id="offer-product" class="form-control" required>
                    ${availableProducts.map((product) => `
                      <option value="${product.productId}" data-unit="${product.unitOfMeasure}">
                        ${product.productName} (${product.unitOfMeasure})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label" for="offer-price">Price per Unit (₹)</label>
                    <input type="number" min="0.01" step="0.01" id="offer-price" class="form-control" placeholder="20.00" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="offer-moq">Minimum Order Qty</label>
                    <input type="number" min="0.01" step="0.01" id="offer-moq" class="form-control" placeholder="500.00" required>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%;">Add to Catalogue</button>
              </form>
            `}
          </div>

          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem;">Add a Base Product</h3>
            <p style="font-size: 0.8rem; color: var(--text-2); margin-bottom: 1rem;">
              Base products are shared across suppliers; adding one only defines what the ingredient is.
            </p>
            <form id="form-add-product">
              <div class="form-group">
                <label class="form-label" for="product-name">Product Name</label>
                <input type="text" id="product-name" class="form-control" placeholder="Basmati Rice" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="product-unit">Unit</label>
                  <input type="text" id="product-unit" class="form-control" placeholder="kg" maxlength="20" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="product-category">Category</label>
                  <input type="text" id="product-category" class="form-control" placeholder="Grains" maxlength="50">
                </div>
              </div>
              <button type="submit" class="btn btn-outline" style="width: 100%;">Add Product</button>
            </form>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Active Offers (${offers.length})</h3>
          ${offers.length === 0 ? `
            <p style="color: var(--text-2); font-size: 0.9rem;">
              No offers yet. Publish one on the left, then launch a buying pool from it.
            </p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${offers.map((offer) => `
                <div class="offer-row" data-offer-id="${offer.catalogueId}" style="border: 1px solid var(--border); padding: 1rem; border-radius: var(--radius-card);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
                    <div>
                      <strong style="font-size: 1rem;">${offer.productName}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-2); margin-top: 0.15rem;">
                        ${offer.category ? `${offer.category} · ` : ''}per ${offer.unitOfMeasure}
                      </div>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm offer-delete" data-offer-id="${offer.catalogueId}">Delete</button>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.6rem; align-items: end; margin-top: 0.85rem;">
                    <div>
                      <label class="form-label" style="font-size: 0.7rem;" for="price-${offer.catalogueId}">Price (₹)</label>
                      <input type="number" min="0.01" step="0.01" class="form-control offer-price" id="price-${offer.catalogueId}" value="${offer.pricePerUnit}">
                    </div>
                    <div>
                      <label class="form-label" style="font-size: 0.7rem;" for="moq-${offer.catalogueId}">MOQ (${offer.unitOfMeasure})</label>
                      <input type="number" min="0.01" step="0.01" class="form-control offer-moq" id="moq-${offer.catalogueId}" value="${offer.minOrderQty}">
                    </div>
                    <button type="button" class="btn btn-primary btn-sm offer-save" data-offer-id="${offer.catalogueId}">Save</button>
                  </div>

                  <div class="offer-summary" style="display: flex; justify-content: space-between; margin-top: 0.6rem; font-size: 0.72rem; color: var(--text-2);">
                    <span>Current: ₹${money(offer.pricePerUnit)} / ${offer.unitOfMeasure}</span>
                    <span>MOQ ${qty(offer.minOrderQty)} ${offer.unitOfMeasure}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="card" style="margin-top: 2rem; background: var(--bg);">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">Why MOQ is copied into the pool</h4>
        <p style="font-size: 0.825rem; color: var(--text-2); line-height: 1.6;">
          <code>target_moq</code> is snapshotted from <code>min_order_qty</code> when a pool is created, so changing the
          catalogue later never rewrites a pool that kitchens have already joined. Offers that already have pools cannot be
          deleted (database <code>ON DELETE RESTRICT</code>).
        </p>
      </div>
    </div>
  `;
}

export function bindCatalogueEvents(router) {
  const offerForm = document.getElementById('form-add-offer');
  const productForm = document.getElementById('form-add-product');

  offerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = offerForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Publishing...';
    try {
      await api.createOffer({
        productId: document.getElementById('offer-product').value,
        pricePerUnit: Number(document.getElementById('offer-price').value),
        minOrderQty: Number(document.getElementById('offer-moq').value)
      });
      showToast('Catalogue offer published.', 'success');
      await router.handleRoute();
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.textContent = 'Add to Catalogue';
    }
  });

  productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = productForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Adding...';
    try {
      await api.createProduct({
        productName: document.getElementById('product-name').value.trim(),
        unitOfMeasure: document.getElementById('product-unit').value.trim(),
        category: document.getElementById('product-category').value.trim() || null
      });
      showToast('Base product added to the shared catalogue.', 'success');
      await router.handleRoute();
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.textContent = 'Add Product';
    }
  });

  document.querySelectorAll('.offer-save').forEach((button) => {
    button.addEventListener('click', async () => {
      const offerId = button.getAttribute('data-offer-id');
      const row = button.closest('.offer-row');
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        const price = Number(row.querySelector('.offer-price').value);
        const moq = Number(row.querySelector('.offer-moq').value);
        const updated = await api.updateOffer(offerId, { pricePerUnit: price, minOrderQty: moq });

        const summary = row.querySelectorAll('.offer-summary span');
        if (summary.length >= 2) {
          summary[0].textContent = `Current: ₹${money(updated.pricePerUnit)} / ${updated.unitOfMeasure}`;
          summary[1].textContent = `MOQ ${qty(updated.minOrderQty)} ${updated.unitOfMeasure}`;
        }

        showToast('Offer updated. Existing pools keep their snapshot.', 'success');
        button.textContent = 'Saved';
        setTimeout(() => {
          button.disabled = false;
          button.textContent = 'Save';
        }, 1500);
      } catch (error) {
        showError(error);
        button.disabled = false;
        button.textContent = 'Save';
      }
    });
  });

  document.querySelectorAll('.offer-delete').forEach((button) => {
    button.addEventListener('click', async () => {
      const offerId = button.getAttribute('data-offer-id');
      if (!window.confirm('Delete this catalogue offer? Offers used by a pool cannot be deleted.')) return;
      button.disabled = true;
      try {
        await api.deleteOffer(offerId);
        showToast('Offer deleted.', 'success');
        await router.handleRoute();
      } catch (error) {
        showError(error);
        button.disabled = false;
      }
    });
  });
}
