// ============================================================================
// File: src/client/js/components/HealthBanner.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Live health check polling against Dhruv's GET /health endpoint
// ============================================================================

import { api } from '../api/client.js';

export function renderHealthBanner() {
  return `
    <div id="health-banner" class="health-banner">
      <div>
        <span id="health-dot" class="health-dot down"></span>
        <span id="health-text">Checking CoBuy System Status...</span>
      </div>
      <div>
        <span style="opacity: 0.7;">Target API: <code>http://localhost:5000</code></span>
      </div>
    </div>
  `;
}

export async function initHealthCheck() {
  const dot = document.getElementById('health-dot');
  const text = document.getElementById('health-text');
  if (!dot || !text) return;

  async function update() {
    const { ok, data } = await api.checkHealth();
    if (ok && data.status === 'healthy') {
      dot.className = 'health-dot up';
      text.innerHTML = `<strong>System Operational:</strong> Node API (UP) | MySQL (CONNECTED) | Uptime: ${data.uptimeSeconds}s`;
    } else if (data.status === 'degraded') {
      dot.className = 'health-dot down';
      text.innerHTML = `<strong>System Degraded:</strong> Node API (UP) | MySQL (DISCONNECTED - check DB credentials)`;
    } else {
      dot.className = 'health-dot down';
      text.innerHTML = `<strong>Backend Offline:</strong> Using local mock aggregation fixtures (Start backend via <code>npm start</code> on port 5000)`;
    }
  }

  update();
  setInterval(update, 15000);
}

