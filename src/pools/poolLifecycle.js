// ============================================================================
// File: src/pools/poolLifecycle.js
// Owner: Shaaz (Aggregation Engine)
// Purpose: Single source of truth for buying-pool status values, allowed
//          transitions, expiry handling and MOQ/overfill rules.
//
// Viva Note: Pool lifecycle rules live in exactly one module so that the
// order endpoint, discovery endpoint and pool CRUD cannot disagree about what
// "ACTIVE", "FULFILLED", "EXPIRED" or "CANCELLED" mean.
// ============================================================================

const { AppError } = require('../middleware/errorHandler');

/** Final status list (Decision 7 in docs/DECISIONS.md). */
const POOL_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  FULFILLED: 'FULFILLED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
});

const POOL_STATUS_VALUES = Object.freeze(Object.values(POOL_STATUSES));

/**
 * Finite state machine for pools.
 * - ACTIVE is the only state that accepts new micro-orders.
 * - FULFILLED, EXPIRED and CANCELLED are terminal: no further transitions.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  ACTIVE: Object.freeze([POOL_STATUSES.FULFILLED, POOL_STATUSES.EXPIRED, POOL_STATUSES.CANCELLED]),
  FULFILLED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  CANCELLED: Object.freeze([])
});

/** Returns true when the pool is in a closed (non-orderable) state. */
function isTerminal(status) {
  return status !== POOL_STATUSES.ACTIVE;
}

/** Pure predicate used by controllers and tests. */
function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * Throws a 409 when the requested status change is not part of the state machine.
 * Viva Note: 409 Conflict (not 400) because the request is well formed but
 * conflicts with the current state of the resource.
 */
function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new AppError(
      `Invalid pool status transition: ${fromStatus} -> ${toStatus}`,
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }
}

/** True when the pool's expiration timestamp is at or before `now`. */
function isExpired(pool, now = new Date()) {
  if (!pool || !pool.expiration_time) return false;
  return new Date(pool.expiration_time).getTime() <= now.getTime();
}

/**
 * Expiry policy (Decision 7): lazy sweep checked whenever pools are read or
 * ordered on. A scheduled job is intentionally out of scope - the plan allowed
 * either approach and lazy checking needs no extra infrastructure.
 *
 * Viva Note: the UPDATE is guarded by status = 'ACTIVE', so a FULFILLED pool
 * can never be flipped to EXPIRED by a late sweep.
 *
 * @returns {number} number of pools moved to EXPIRED
 */
async function expireStalePools(prisma, now = new Date()) {
  const result = await prisma.buying_pools.updateMany({
    where: {
      status: POOL_STATUSES.ACTIVE,
      expiration_time: { lte: now }
    },
    data: { status: POOL_STATUSES.EXPIRED }
  });
  return result.count || 0;
}

/** Status implied by the aggregate quantity against the target MOQ. */
function statusForQuantity(currentQty, targetMoq) {
  return Number(currentQty) >= Number(targetMoq)
    ? POOL_STATUSES.FULFILLED
    : POOL_STATUSES.ACTIVE;
}

/**
 * Overfill policy (Decision 6): overfill is ALLOWED.
 *
 * Rationale: the MOQ is a supplier *minimum*, not a maximum. Rejecting a
 * kitchen because another kitchen's order landed first makes the outcome
 * dependent on request timing, and it would make the plan's own concurrency
 * example (350 kg + 100 kg + 100 kg) impossible. The pool simply becomes
 * FULFILLED and the surplus is reported as `overfillBy` so the UI can warn.
 */
function overfillBy(requestedQty, currentQty, targetMoq) {
  const projected = Number(currentQty) + Number(requestedQty);
  const surplus = projected - Number(targetMoq);
  return surplus > 0 ? Number(surplus.toFixed(2)) : 0;
}

/** Percentage of the target MOQ collected, capped at 100 for display. */
function progressPercentage(currentQty, targetMoq) {
  const target = Number(targetMoq);
  if (!target || target <= 0) return 0;
  const pct = (Number(currentQty) / target) * 100;
  return Number(Math.min(pct, 100).toFixed(1));
}

module.exports = {
  POOL_STATUSES,
  POOL_STATUS_VALUES,
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  isTerminal,
  isExpired,
  expireStalePools,
  statusForQuantity,
  overfillBy,
  progressPercentage
};
