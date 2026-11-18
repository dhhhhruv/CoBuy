// ============================================================================
// File: src/client/js/components/MOQProgressBar.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Reusable, responsive MOQ Progress Bar component with dynamic status
// ============================================================================

export function renderMOQProgressBar({ currentQty, targetMoq, unitOfMeasure, status }) {
  const current = Number(currentQty) || 0;
  const target = Number(targetMoq) || 1;
  const rawPct = (current / target) * 100;
  const pct = Math.min(Math.round(rawPct), 100);
  const remaining = Math.max(0, target - current).toFixed(2);
  const isFulfilled = status === 'FULFILLED' || current >= target;

  return `
    <div class="moq-progress-container">
      <div class="moq-progress-header">
        <span>
          <strong>${current.toFixed(1)}</strong> of <strong>${target.toFixed(1)} ${unitOfMeasure}</strong> pooled
        </span>
        <span style="color: ${isFulfilled ? 'var(--primary)' : 'var(--text-secondary)'};">
          ${pct}% ${isFulfilled ? 'UNLOCKED' : ''}
        </span>
      </div>

      <div class="moq-progress-track">
        <div class="moq-progress-fill ${isFulfilled ? 'status-fulfilled' : 'status-active'}" 
             style="width: ${pct}%;"></div>
      </div>

      <div class="moq-progress-footer">
        <span>
          ${isFulfilled 
            ? '<strong>Wholesale MOQ unlocked!</strong> Ready for procurement.'
            : `Need <strong>${remaining} ${unitOfMeasure}</strong> more to unlock wholesale pricing`}
        </span>
        <span class="badge ${isFulfilled ? 'badge-status-fulfilled' : 'badge-status-active'}">
          ${isFulfilled ? 'FULFILLED' : 'ACTIVE'}
        </span>
      </div>
    </div>
  `;
}

