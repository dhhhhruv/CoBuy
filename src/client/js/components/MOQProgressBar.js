// ============================================================================
// File: src/client/js/components/MOQProgressBar.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Visualise how close a pool is to its Minimum Order Quantity.
// ============================================================================

const fmtQty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtPct = (value) => `${Math.min(100, Math.max(0, value)).toFixed(1)}%`;

const STATUS_CLASS = {
  ACTIVE: 'badge-status-active',
  FULFILLED: 'badge-status-fulfilled',
  EXPIRED: 'badge-status-expired',
  CANCELLED: 'badge-status-cancelled'
};

/**
 * @param {{currentQty:number|string, targetMoq:number|string, unitOfMeasure?:string,
 *          status?:string, showLabels?:boolean, showFooter?:boolean}} pool
 */
export function renderMOQProgressBar({
  currentQty,
  targetMoq,
  unitOfMeasure = '',
  status,
  showLabels = true,
  showFooter = true
}) {
  const current = Number(currentQty || 0);
  const target = Number(targetMoq || 0);
  const rawPct = target > 0 ? (current / target) * 100 : 0;
  const pct = Math.min(100, rawPct);
  const met = target > 0 && current >= target;
  const remaining = Math.max(0, target - current);
  const statusLabel = status || (met ? 'FULFILLED' : 'ACTIVE');

  return `
    <div class="moq-progress-container">
      ${showLabels ? `
        <div class="moq-progress-header">
          <span><strong>${fmtQty(current)}</strong> of ${fmtQty(target)} ${unitOfMeasure} pooled</span>
          <span>${met ? 'MOQ met' : fmtPct(rawPct)}</span>
        </div>
      ` : ''}

      <div class="moq-progress-track"
           role="progressbar"
           aria-valuemin="0"
           aria-valuemax="100"
           aria-valuenow="${Math.round(pct)}">
        <div class="moq-progress-fill status-${String(statusLabel).toLowerCase()}" style="width: ${pct}%;"></div>
      </div>

      ${showFooter ? `
        <div class="moq-progress-footer">
          <span>
            ${met
              ? 'Wholesale MOQ unlocked'
              : `Need ${fmtQty(remaining)} ${unitOfMeasure} more to unlock wholesale`}
          </span>
          <span class="badge ${STATUS_CLASS[statusLabel] || 'badge'}">${statusLabel}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/** Remaining quantity before the supplier's truck can be dispatched. */
export function moqRemaining(pool) {
  const remaining = Number(pool?.targetMoq || 0) - Number(pool?.currentQty || 0);
  return remaining > 0 ? remaining : 0;
}
