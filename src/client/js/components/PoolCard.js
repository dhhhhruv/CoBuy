// ============================================================================
// File: src/client/js/components/PoolCard.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Pool summary card for discovery and dashboards.
// ============================================================================

import { renderMOQProgressBar } from './MOQProgressBar.js';

const fmtMoney = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDistance = (meters) => {
  const m = Number(meters || 0);
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

function expiryLabel(iso) {
  if (!iso) return 'No expiry set';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'No expiry set';
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `Closes in ${Math.max(1, Math.floor(ms / 60000))} min`;
  if (hours < 48) return `Closes in ${hours} h`;
  return `Closes ${new Date(iso).toLocaleDateString()}`;
}

export function renderPoolCard(pool) {
  const statusClass = `badge-status-${String(pool.status || 'ACTIVE').toLowerCase()}`;
  const isActive = pool.status === 'ACTIVE';

  return `
    <div class="card" data-pool-id="${pool.poolId}" style="display: flex; flex-direction: column; gap: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em;">${pool.productName}</h3>
          <div style="font-size: 0.78rem; color: var(--text-2); margin-top: 0.15rem;">
            ${pool.supplierName}${pool.geographicZone?.address ? ` · ${pool.geographicZone.address}` : ''}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
          <span class="badge ${statusClass}">${pool.status}</span>
          ${pool.distanceMeters != null ? `<span style="font-size: 0.72rem; color: var(--text-2);">${fmtDistance(pool.distanceMeters)} away</span>` : ''}
        </div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 0.4rem;">
        <span style="font-size: 1.45rem; font-weight: 800; color: var(--accent);">₹${fmtMoney(pool.pricePerUnit)}</span>
        <span style="font-size: 0.78rem; color: var(--text-2);">per ${pool.unitOfMeasure}</span>
      </div>

      ${renderMOQProgressBar(pool)}

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-2);">
        <span>${pool.supplierName ? `${pool.supplierName} wholesale offer` : 'Wholesale offer'}</span>
        <span>${expiryLabel(pool.expirationTime)}</span>
      </div>

      <a href="#${pool.detailPath || `/pools/${pool.poolId}`}" class="btn ${isActive ? 'btn-primary' : 'btn-outline'}" style="text-align: center;">
        ${isActive ? 'Join Pool & Pledge Qty' : 'View Pool Details'}
      </a>
    </div>
  `;
}
