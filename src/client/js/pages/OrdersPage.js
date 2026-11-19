// ============================================================================
// File: src/client/js/pages/OrdersPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Kitchen micro-orders, pool progress and payment settlement.
// ============================================================================

import { api } from '../api/client.js';
import { showToast, showError } from '../components/Toast.js';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STATUS_CLASS = {
  ACTIVE: 'badge-status-active',
  FULFILLED: 'badge-status-fulfilled',
  EXPIRED: 'badge-status-expired',
  CANCELLED: 'badge-status-cancelled'
};

export async function renderOrdersPage() {
  const orders = await api.getMyOrders();
  const pending = orders.filter((order) => order.paymentStatus === 'PENDING');
  const pendingAmount = pending.reduce((sum, order) => sum + order.pledgedAmount, 0);
  const paidAmount = orders
    .filter((order) => order.paymentStatus === 'PAID')
    .reduce((sum, order) => sum + order.pledgedAmount, 0);

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">My Micro-Orders</h1>
          <p style="color: var(--text-2); margin-top: 0.25rem;">
            Pledged quantities, pooling progress and payment settlement
          </p>
        </div>
        <a href="#/pools" class="btn btn-primary btn-sm">+ Join Another Pool</a>
      </div>

      <div class="grid-4" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-label">Total Orders</div>
          <div class="stat-value">${orders.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Awaiting Payment</div>
          <div class="stat-value" style="color: var(--chip-text);">${pending.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Payment Due</div>
          <div class="stat-value" style="color: var(--accent);">₹${money(pendingAmount)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Settled</div>
          <div class="stat-value" style="color: var(--accent);">₹${money(paidAmount)}</div>
        </div>
      </div>

      ${orders.length === 0 ? `
        <div class="card" style="text-align: center; padding: 3rem;">
          <h3>No micro-orders placed yet</h3>
          <p style="color: var(--text-2); margin: 0.75rem 0 1.5rem;">
            Browse active pools in your cluster to start pooling procurement.
          </p>
          <a href="#/pools" class="btn btn-primary">Discover Pools</a>
        </div>
      ` : `
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Pledged</th>
                <th>Pool</th>
                <th>Payment</th>
                <th>Placed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((order) => {
                const isPaid = order.paymentStatus === 'PAID';
                const poolClass = STATUS_CLASS[order.poolStatus] || 'badge-status-active';
                return `
                  <tr>
                    <td>
                      <strong>${order.productName}</strong>
                      <div style="font-size: 0.72rem; color: var(--text-2);">
                        ${order.supplierName || 'Wholesale partner'} · pool ${String(order.poolId).slice(0, 8)}…
                      </div>
                    </td>
                    <td><strong>${qty(order.requestedQty)}</strong> ${order.unitOfMeasure}</td>
                    <td>₹${money(order.pricePerUnit)} / ${order.unitOfMeasure}</td>
                    <td style="color: var(--accent); font-weight: 700;">₹${money(order.pledgedAmount)}</td>
                    <td>
                      <span class="badge ${poolClass}">${order.poolStatus || 'ACTIVE'}</span>
                      ${order.poolCurrentQty != null && order.poolTargetMoq
                        ? `<div style="font-size: 0.7rem; color: var(--text-2); margin-top: 0.25rem;">
                             ${qty(order.poolCurrentQty)} / ${qty(order.poolTargetMoq)} ${order.unitOfMeasure}
                           </div>`
                        : ''}
                    </td>
                    <td>
                      <span class="badge ${isPaid ? 'badge-status-paid' : 'badge-status-pending'}">${order.paymentStatus}</span>
                    </td>
                    <td style="font-size: 0.78rem; color: var(--text-2);">
                      ${new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      ${isPaid
                        ? '<span style="color: var(--accent); font-size: 0.82rem; font-weight: 600;">Settled</span>'
                        : `<button class="btn btn-outline btn-sm btn-pay" data-order-id="${order.orderId}" data-amount="${order.pledgedAmount}">
                             Pay ₹${money(order.pledgedAmount)}
                           </button>`}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="card" style="margin-top: 2rem; background: var(--bg);">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">Payment status is a recorded transition</h4>
        <p style="font-size: 0.825rem; color: var(--text-2); line-height: 1.6;">
          <code>PATCH /api/orders/:id/payment</code> accepts <code>PENDING</code> or <code>PAID</code> and authorizes only the
          kitchen owner or the pool's supplier. No gateway is connected — the endpoint records the settlement so both
          sides see the same state.
        </p>
      </div>
    </div>
  `;
}

export function bindOrdersEvents(router) {
  document.querySelectorAll('.btn-pay').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.getAttribute('data-order-id');
      const amount = money(button.getAttribute('data-amount'));
      if (!window.confirm(`Record payment of ₹${amount} for this micro-order?`)) return;

      button.disabled = true;
      button.textContent = 'Recording...';
      try {
        await api.updatePaymentStatus(orderId, 'PAID');
        showToast('Payment recorded as PAID.', 'success');
        await router.handleRoute();
      } catch (error) {
        showError(error);
        button.disabled = false;
        button.textContent = `Pay ₹${amount}`;
      }
    });
  });
}
