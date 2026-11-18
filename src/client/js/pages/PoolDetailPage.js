// ============================================================================
// File: src/client/js/pages/PoolDetailPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Pool detail inspection, reactive progress tracking & micro-order modal
// ============================================================================

import { api } from '../api/client.js';
import { renderMOQProgressBar } from '../components/MOQProgressBar.js';

export async function renderPoolDetailPage(params) {
  const poolId = params.id;
  const pool = await api.getPoolById(poolId);
  const isFulfilled = pool.status === 'FULFILLED' || Number(pool.currentQty) >= Number(pool.targetMoq);

  return `
    <div class="container" style="max-width: 800px;">
      <div style="margin-bottom: 1.5rem;">
        <a href="#/pools" style="color: var(--text-secondary); text-decoration: none; font-size: 0.9rem;">
          ← Back to Pool Discovery
        </a>
      </div>

      <div class="card" style="padding: 2.5rem; margin-bottom: 2rem;">
        <div class="card-header">
          <div>
            <span class="badge ${isFulfilled ? 'badge-status-fulfilled' : 'badge-status-active'}" style="margin-bottom: 0.5rem;">
              ${isFulfilled ? 'MOQ UNLOCKED' : 'POOL ACTIVE'}
            </span>
            <h1 style="font-size: 2rem; font-weight: 800; color: var(--text-primary);">${pool.productName}</h1>
            <p class="card-subtitle" style="font-size: 1rem; margin-top: 0.25rem;">
              Wholesale Partner: <strong>${pool.supplierName}</strong>
            </p>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Wholesale Price</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--primary);">₹${pool.pricePerUnit} <span style="font-size: 1rem; color: var(--text-muted);">/ ${pool.unitOfMeasure}</span></div>
          </div>
        </div>

        <div id="pool-progress-area">
          ${renderMOQProgressBar({
            currentQty: pool.currentQty,
            targetMoq: pool.targetMoq,
            unitOfMeasure: pool.unitOfMeasure,
            status: pool.status
          })}
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0; padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Target MOQ</div>
            <div style="font-weight: 700; font-size: 1.1rem;">${pool.targetMoq} ${pool.unitOfMeasure}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Pooled</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--primary);" id="detail-current-qty">${pool.currentQty} ${pool.unitOfMeasure}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Status</div>
            <div style="font-weight: 700; font-size: 1.1rem;">${pool.status}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button id="btn-open-order-modal" class="btn btn-primary" ${isFulfilled ? 'disabled' : ''}>
            ${isFulfilled ? 'Wholesale MOQ Reached' : 'Pledge Micro-Order For This Pool'}
          </button>
        </div>
      </div>

      <!-- MICRO-ORDER MODAL (Hidden by default) -->
      <div id="modal-order" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <button id="btn-close-modal" class="modal-close">&times;</button>
          
          <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Pledge Micro-Order</h2>
          <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
            Commit your cloud kitchen's quantity to help this pool unlock the wholesale rate.
          </p>

          <form id="form-micro-order">
            <div class="form-group">
              <label class="form-label" for="order-qty">Requested Quantity (${pool.unitOfMeasure})</label>
              <input type="number" id="order-qty" class="form-control" placeholder="e.g. 150" min="1" max="1000" step="1" required value="150">
              <span class="form-help">Enter the exact volume your kitchen needs</span>
            </div>

            <!-- Live Calculation Breakdown -->
            <div style="background-color: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span style="color: var(--text-secondary);">Unit Wholesale Price:</span>
                <span>₹${pool.pricePerUnit} / ${pool.unitOfMeasure}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span style="color: var(--text-secondary);">Your Pledged Quantity:</span>
                <span id="calc-qty">150.00 ${pool.unitOfMeasure}</span>
              </div>
              <div style="border-top: 1px solid var(--border-dark); padding-top: 0.6rem; display: flex; justify-content: space-between; font-weight: 700;">
                <span>Total Pledged Liability:</span>
                <span id="calc-total" style="color: var(--primary-hover); font-size: 1.15rem;">₹3000.00</span>
              </div>
              <div class="form-help" style="margin-top: 0.5rem;">
                Formula: <code>pledged_amount = requested_qty * price_per_unit</code>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-modal" class="btn btn-outline">Cancel</button>
              <button type="submit" id="btn-submit-order" class="btn btn-primary">Confirm & Pledge</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `;
}

export function bindPoolDetailEvents(params, router) {
  const poolId = params.id;
  const modal = document.getElementById('modal-order');
  const btnOpen = document.getElementById('btn-open-order-modal');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const form = document.getElementById('form-micro-order');
  const qtyInput = document.getElementById('order-qty');
  const calcQty = document.getElementById('calc-qty');
  const calcTotal = document.getElementById('calc-total');

  let currentPool = null;
  api.getPoolById(poolId).then(p => { currentPool = p; });

  function openModal() {
    if (modal) modal.style.display = 'flex';
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  btnOpen?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  // Live Math Calculation
  qtyInput?.addEventListener('input', () => {
    const qty = parseFloat(qtyInput.value) || 0;
    const price = currentPool ? parseFloat(currentPool.pricePerUnit) : 20.00;
    const total = qty * price;
    if (calcQty) calcQty.textContent = `${qty.toFixed(2)} ${currentPool?.unitOfMeasure || 'kg'}`;
    if (calcTotal) calcTotal.textContent = `₹${total.toFixed(2)}`;
  });

  // Submit Order
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseFloat(qtyInput.value);
    const submitBtn = document.getElementById('btn-submit-order');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Committing Micro-Order...';

    try {
      await api.placeMicroOrder(poolId, qty);
      closeModal();
      alert(`Success! Micro-order for ${qty} ${currentPool?.unitOfMeasure} placed.`);
      router.navigate('/orders');
    } catch (err) {
      alert(`Order Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Pledge';
    }
  });
}

