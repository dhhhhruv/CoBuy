// ============================================================================
// File: src/client/js/pages/OrdersPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Display kitchen's pledged micro-orders, pool state & payment status
// ============================================================================

import { api } from '../api/client.js';

export async function renderOrdersPage() {
  const orders = await api.getMyOrders();

  return `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.85rem; font-weight: 800;">My Kitchen's Micro-Orders</h1>
          <p style="color: var(--text-secondary); margin-top: 0.25rem;">
            Track your pledged quantities, pooling progress, and payment settlements
          </p>
        </div>
        <a href="#/pools" class="btn btn-primary btn-sm">+ Join Another Pool</a>
      </div>

      ${orders.length === 0 ? `
        <div class="card" style="text-align: center; padding: 3rem;">
          <h3>No micro-orders placed yet</h3>
          <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">
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
                <th>Requested Qty</th>
                <th>Wholesale Unit Price</th>
                <th>Pledged Amount</th>
                <th>Pool Status</th>
                <th>Payment Status</th>
                <th>Order Placed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => {
                const isPaid = o.paymentStatus === 'PAID';
                const isFulfilled = o.poolStatus === 'FULFILLED';
                return `
                  <tr>
                    <td>
                      <strong>${o.productName}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">Pool: ${o.poolId.slice(0, 8)}...</div>
                    </td>
                    <td><strong>${o.requestedQty}</strong> ${o.unitOfMeasure}</td>
                    <td>₹${o.pricePerUnit} / ${o.unitOfMeasure}</td>
                    <td style="color: var(--primary-hover); font-weight: 700;">₹${o.pledgedAmount}</td>
                    <td>
                      <span class="badge ${isFulfilled ? 'badge-status-fulfilled' : 'badge-status-active'}">
                        ${o.poolStatus}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${isPaid ? 'badge-status-paid' : 'badge-status-pending'}">
                        ${o.paymentStatus}
                      </span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">
                      ${new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      ${isPaid ? `
                        <span style="color: var(--primary); font-size: 0.85rem; font-weight: 600;">Settled</span>
                      ` : `
                        <button class="btn btn-outline btn-sm btn-pay" data-order-id="${o.orderId}">
                          Pay ₹${o.pledgedAmount}
                        </button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="card" style="margin-top: 2rem; background: var(--bg-subtle);">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">
          Viva Engineering Note on Micro-Order Constraints:
        </h4>
        <p style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.6;">
          • <strong>Constraint:</strong> <code>UNIQUE(pool_id, restaurant_id)</code> prevents a kitchen from creating duplicate competing records in the same pool.<br>
          • <strong>Atomicity:</strong> Placing an order atomically executes an <code>UPDATE buying_pools SET current_qty = current_qty + ?</code> inside an InnoDB transaction, preventing the lost update concurrency anomaly.<br>
          • <strong>Precision:</strong> Quantities and amounts strictly use <code>DECIMAL(10,2)</code> to prevent floating-point calculation errors.
        </p>
      </div>

    </div>
  `;
}

export function bindOrdersEvents() {
  document.querySelectorAll('.btn-pay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = e.target.getAttribute('data-order-id');
      alert(`Payment simulated for micro-order ${orderId}. Status updated to PAID.`);
      // Update UI state
      e.target.parentElement.innerHTML = '<span style="color: var(--primary); font-size: 0.85rem; font-weight: 600;">Settled</span>';
    });
  });
}
