// ============================================================================
// File: src/client/js/components/PoolCard.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Pool summary card for discovery grids
// ============================================================================

import { renderMOQProgressBar } from './MOQProgressBar.js';

export function renderPoolCard(pool) {
  const distanceKm = pool.distanceMeters ? (pool.distanceMeters / 1000).toFixed(1) : '1.8';
  const isFulfilled = pool.status === 'FULFILLED' || Number(pool.currentQty) >= Number(pool.targetMoq);

  return `
    <div class="card pool-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${pool.productName}</h3>
          <p class="card-subtitle">Supplier: <strong>${pool.supplierName}</strong></p>
        </div>
        <span class="badge ${isFulfilled ? 'badge-status-fulfilled' : 'badge-status-active'}">
          ${isFulfilled ? 'FULFILLED' : 'ACTIVE'}
        </span>
      </div>

      <div style="display: flex; gap: 1rem; margin-bottom: 0.75rem; font-size: 0.9rem;">
        <div>
          <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Wholesale Price</span>
          <div style="font-weight: 700; color: var(--primary);">₹${pool.pricePerUnit} / ${pool.unitOfMeasure}</div>
        </div>
        <div>
          <span style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Cluster Proximity</span>
          <div style="font-weight: 700; color: var(--secondary);">${distanceKm} km away (≤ 5 km)</div>
        </div>
      </div>

      ${renderMOQProgressBar({
        currentQty: pool.currentQty,
        targetMoq: pool.targetMoq,
        unitOfMeasure: pool.unitOfMeasure,
        status: pool.status
      })}

      <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
        <a href="#/pools/${pool.poolId}" class="btn ${isFulfilled ? 'btn-outline' : 'btn-primary'} btn-sm">
          ${isFulfilled ? 'View Pool Details' : 'Join Pool & Pledge Qty →'}
        </a>
      </div>
    </div>
  `;
}

