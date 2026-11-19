// ============================================================================
// File: src/client/js/components/HealthBanner.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Always-visible thin bar above the navbar that reports Express and
//          MySQL availability from GET /health every 15 seconds.
// ============================================================================

import { api } from '../api/client.js';

const POLL_INTERVAL_MS = 15000;

let bannerEl = null;
let pollTimer = null;
let lastHealth = null;

function ensureBanner() {
  if (bannerEl && document.body.contains(bannerEl)) return bannerEl;

  bannerEl = document.createElement('div');
  bannerEl.id = 'health-banner';
  bannerEl.className = 'health-banner';
  bannerEl.innerHTML = `
    <span><span class="health-dot down"></span><span class="health-text">Checking API status…</span></span>
    <span class="health-meta"></span>
  `;
  bannerEl.addEventListener('click', () => refreshHealth());

  const app = document.getElementById('app');
  if (app) app.prepend(bannerEl);
  else document.body.prepend(bannerEl);
  return bannerEl;
}

function render({ up, text, meta }) {
  const el = ensureBanner();
  el.querySelector('.health-dot').className = `health-dot ${up ? 'up' : 'down'}`;
  el.querySelector('.health-text').textContent = text;
  el.querySelector('.health-meta').textContent = meta || '';
}

function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const total = Math.floor(Number(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `up ${hours}h ${minutes}m`;
  if (minutes > 0) return `up ${minutes}m`;
  return `up ${total}s`;
}

export async function refreshHealth() {
  ensureBanner();

  try {
    const health = await api.getHealth();
    lastHealth = health;

    if (health.status === 'healthy') {
      render({
        up: true,
        text: `API up · database ${health.database.toLowerCase()}`,
        meta: formatUptime(health.uptimeSeconds),
      });
      return health;
    }

    render({
      up: false,
      text: `API degraded · database ${health.database || 'unavailable'}`,
      meta: 'click to retry'
    });
    return health;
  } catch (error) {
    lastHealth = { status: 'down', error: error.message };
    render({
      up: false,
      text: `Backend offline · ${error.message}`,
      meta: 'click to retry'
    });
    return lastHealth;
  }
}

export function getLastHealth() {
  return lastHealth;
}

export function initHealthCheck() {
  refreshHealth();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshHealth, POLL_INTERVAL_MS);
}
