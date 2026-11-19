// ============================================================================
// File: src/client/js/pages/PoolDetailPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Pool detail for kitchens (pledge) and suppliers (orders + payments).
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { renderMOQProgressBar } from '../components/MOQProgressBar.js';
import { showToast, showError } from '../components/Toast.js';

let activeKeyHandler = null;

const STATUS_BADGE = {
  ACTIVE: 'badge-status-active',
  FULFILLED: 'badge-status-fulfilled',
  EXPIRED: 'badge-status-expired',
  CANCELLED: 'badge-status-cancelled'
};

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const dateLabel = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export async function renderPoolDetailPage(params) {
  const poolId = params.id;
  const pool = await api.getPoolById(poolId);
  const isSupplier = store.role === 'supplier';

  let kitchenProfile = null;
  let myOrder = null;
  if (!isSupplier) {
    const [restaurants, myOrders] = await Promise.all([api.getMyRestaurants(), api.getMyOrders()]);
    kitchenProfile = restaurants[0] || null;
    myOrder = myOrders.find((order) => order.poolId === poolId) || null;
  }

  const canPledge = pool.status === 'ACTIVE' && !isSupplier && kitchenProfile && !myOrder;
  const overfill = pool.currentQty > pool.targetMoq
    ? (pool.currentQty - pool.targetMoq).toFixed(2)
    : null;
  const suggestedQty = Math.max(0.01, Math.min(150, Number((pool.targetMoq - pool.currentQty).toFixed(2)) || 150));

  const pledgePanel = isSupplier
    ? `<p style="color: var(--text-2); font-size: 0.85rem;">
         You are viewing this pool as its supplier. Settle payments from the order list below.
       </p>`
    : `
      ${!kitchenProfile ? `
        <div class="form-alert form-alert--error" style="margin-bottom: 1rem;">
          Create your kitchen profile before pledging.
          <a href="#/profile/kitchen" style="color: inherit; text-decoration: underline;">Open profile</a>
        </div>
      ` : ''}
      ${myOrder ? `
        <div class="form-alert form-alert--success" style="margin-bottom: 1rem;">
          Your kitchen already pledged <strong>${qty(myOrder.requestedQty)} ${pool.unitOfMeasure}</strong>
          (₹${money(myOrder.pledgedAmount)}) · payment ${myOrder.paymentStatus}.
          <a href="#/orders" style="color: inherit; text-decoration: underline;">View order</a>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: flex-end; gap: 1rem;">
        <button id="btn-open-order-modal" class="btn btn-primary"
                ${canPledge ? '' : 'disabled'}
                data-price="${pool.pricePerUnit}" data-unit="${pool.unitOfMeasure}"
                data-suggested="${suggestedQty}">
          ${pool.status === 'ACTIVE'
            ? (myOrder ? 'Already Pledged' : 'Pledge Micro-Order')
            : `Pool ${pool.status}`}
        </button>
      </div>
    `;

  return `
    <div class="container" style="max-width: 960px;">
      <div style="margin-bottom: 1.5rem;">
        <a href="${isSupplier ? '#/supplier/dashboard' : '#/pools'}" style="color: var(--text-2); text-decoration: none; font-size: 0.9rem;">
          ← Back to ${isSupplier ? 'Supplier Hub' : 'Pool Discovery'}
        </a>
      </div>

      <div class="card" style="padding: 2.5rem; margin-bottom: 2rem;">
        <div class="card-header">
          <div>
            <span class="badge ${STATUS_BADGE[pool.status] || STATUS_BADGE.ACTIVE}" style="margin-bottom: 0.5rem;">${pool.status}</span>
            <h1 style="font-size: 2rem; font-weight: 800; color: var(--text);">${pool.productName}</h1>
            <p class="card-subtitle" style="font-size: 1rem; margin-top: 0.25rem;">
              Wholesale partner: <strong>${pool.supplierName}</strong>
            </p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-2); text-transform: uppercase;">Wholesale Price</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--accent);">
              ₹${money(pool.pricePerUnit)}
              <span style="font-size: 1rem; color: var(--text-2);">/ ${pool.unitOfMeasure}</span>
            </div>
          </div>
        </div>

        ${renderMOQProgressBar(pool)}

        <div class="grid-4" style="margin: 2rem 0; padding: 1.25rem; background: var(--bg); border-radius: var(--radius-card);">
          <div>
            <div style="font-size: 0.72rem; color: var(--text-2); text-transform: uppercase;">Target MOQ</div>
            <div style="font-weight: 700; font-size: 1.05rem;">${qty(pool.targetMoq)} ${pool.unitOfMeasure}</div>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: var(--text-2); text-transform: uppercase;">Pooled</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--accent);">${qty(pool.currentQty)} ${pool.unitOfMeasure}</div>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: var(--text-2); text-transform: uppercase;">Participants</div>
            <div style="font-weight: 700; font-size: 1.05rem;">${pool.participantCount}</div>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: var(--text-2); text-transform: uppercase;">Closes</div>
            <div style="font-weight: 700; font-size: 0.95rem;">${dateLabel(pool.expirationTime)}</div>
          </div>
        </div>

        ${overfill ? `
          <p style="color: var(--chip-text); font-size: 0.85rem; margin-bottom: 1rem;">
            This pool is overfilled by ${overfill} ${pool.unitOfMeasure}; the supplier minimum is already covered.
          </p>
        ` : ''}

        ${pledgePanel}
      </div>

      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">
          Micro-Orders (${pool.orders.length})
        </h3>
        ${pool.orders.length === 0 ? `
          <p style="color: var(--text-2);">No contributions yet.</p>
        ` : `
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Kitchen</th>
                  <th>Quantity</th>
                  <th>Pledged Amount</th>
                  <th>Payment</th>
                  <th>Placed</th>
                  ${isSupplier ? '<th>Action</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${pool.orders.map((order) => `
                  <tr>
                    <td><strong>${order.restaurantName || 'Kitchen'}</strong></td>
                    <td>${qty(order.requestedQty)} ${pool.unitOfMeasure}</td>
                    <td>₹${money(order.pledgedAmount)}</td>
                    <td>
                      <span class="badge ${order.paymentStatus === 'PAID' ? 'badge-status-paid' : 'badge-status-pending'}">
                        ${order.paymentStatus}
                      </span>
                    </td>
                    <td style="font-size: 0.78rem; color: var(--text-2);">${new Date(order.createdAt).toLocaleDateString()}</td>
                    ${isSupplier ? `
                      <td>
                        ${order.paymentStatus === 'PAID'
                          ? '<span style="color: var(--accent); font-size: 0.82rem; font-weight: 600;">Settled</span>'
                          : `<button class="btn btn-outline btn-sm btn-mark-paid" data-order-id="${order.orderId}">Mark Paid</button>`}
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${isSupplier ? '' : `
        <div id="modal-order" class="modal-overlay" style="display: none;">
          <div class="modal-content">
            <button type="button" id="btn-close-modal" class="modal-close">&times;</button>

            <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Pledge Micro-Order</h2>
            <p style="color: var(--text-2); font-size: 0.875rem; margin-bottom: 1.5rem;">
              Commit your kitchen's quantity. A pledge is final for this pool — one order per kitchen.
            </p>

            <form id="form-micro-order">
              <div class="form-group">
                <label class="form-label" for="order-qty">Requested Quantity (${pool.unitOfMeasure})</label>
                <input type="number" id="order-qty" class="form-control" min="0.01" step="0.01" required
                       value="${suggestedQty.toFixed(2)}">
                <span class="form-help">Enter the volume your kitchen actually needs</span>
              </div>

              <div style="background-color: var(--bg); padding: 1rem; border-radius: var(--radius-card); margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-2);">Unit price:</span>
                  <span>₹${money(pool.pricePerUnit)} / ${pool.unitOfMeasure}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-2);">Your quantity:</span>
                  <span id="calc-qty">0.00 ${pool.unitOfMeasure}</span>
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 0.6rem; display: flex; justify-content: space-between; font-weight: 700;">
                  <span>Pledged liability:</span>
                  <span id="calc-total" style="color: var(--accent); font-size: 1.15rem;">₹0.00</span>
                </div>
                <div class="form-help" style="margin-top: 0.5rem;">
                  <code>pledged_amount = requested_qty × price_per_unit</code>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                <button type="button" id="btn-cancel-modal" class="btn btn-outline">Cancel</button>
                <button type="submit" id="btn-submit-order" class="btn btn-primary">Confirm & Pledge</button>
              </div>
            </form>
          </div>
        </div>
      `}
    </div>
  `;
}

export function bindPoolDetailEvents(params, router) {
  const poolId = params.id;
  const modal = document.getElementById('modal-order');
  const openButton = document.getElementById('btn-open-order-modal');
  const form = document.getElementById('form-micro-order');
  const qtyInput = document.getElementById('order-qty');
  const calcQty = document.getElementById('calc-qty');
  const calcTotal = document.getElementById('calc-total');
  const unit = openButton?.dataset.unit || '';
  const price = Number(openButton?.dataset.price || 0);

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  openButton?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  if (activeKeyHandler) document.removeEventListener('keydown', activeKeyHandler);
  activeKeyHandler = (event) => {
    if (event.key === 'Escape' && modal && modal.style.display === 'flex') closeModal();
  };
  document.addEventListener('keydown', activeKeyHandler);

  function refreshCalculation() {
    const value = parseFloat(qtyInput?.value) || 0;
    if (calcQty) calcQty.textContent = `${value.toFixed(2)} ${unit}`;
    if (calcTotal) calcTotal.textContent = `₹${money(value * price)}`;
  }

  qtyInput?.addEventListener('input', refreshCalculation);
  refreshCalculation();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.getElementById('btn-submit-order');
    submit.disabled = true;
    submit.textContent = 'Committing...';

    try {
      const result = await api.placeMicroOrder(poolId, parseFloat(qtyInput.value));
      closeModal();
      const overfill = Number(result.overfillBy || 0);
      showToast(
        overfill > 0
          ? `Order placed. Pool overfilled by ${overfill.toFixed(2)} ${unit}.`
          : 'Micro-order placed successfully.',
        'success'
      );
      router.navigate('/orders');
    } catch (error) {
      showError(error);
      submit.disabled = false;
      submit.textContent = 'Confirm & Pledge';
    }
  });

  document.querySelectorAll('.btn-mark-paid').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.getAttribute('data-order-id');
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        await api.updatePaymentStatus(orderId, 'PAID');
        showToast('Payment marked as PAID.', 'success');
        await router.handleRoute();
      } catch (error) {
        showError(error);
        button.disabled = false;
        button.textContent = 'Mark Paid';
      }
    });
  });
}
