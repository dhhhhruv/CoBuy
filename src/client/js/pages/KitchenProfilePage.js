// ============================================================================
// File: src/client/js/pages/KitchenProfilePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Manage cloud kitchen profile & GPS coordinates (POINT SRID 4326)
// ============================================================================

import { store } from '../state.js';

export function renderKitchenProfilePage() {
  return `
    <div class="container" style="max-width: 680px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Cloud Kitchen Profile</h2>
            <p class="card-subtitle">Set your GPS coordinates to discover buying pools within your 5 km cluster</p>
          </div>
        </div>

        <form id="form-kitchen-profile">
          <div class="form-group">
            <label class="form-label" for="kitchen-name">Kitchen Business Name</label>
            <input type="text" id="kitchen-name" class="form-control" value="Spicy Bowl Cloud Kitchen A" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="kitchen-address">Physical Kitchen Address</label>
            <input type="text" id="kitchen-address" class="form-control" value="${store.location.address}" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="kitchen-lat">Latitude (WGS 84)</label>
              <input type="number" step="0.000001" id="kitchen-lat" class="form-control" value="${store.location.latitude}" required>
              <span class="form-help">MySQL POINT SRID 4326</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="kitchen-lng">Longitude (WGS 84)</label>
              <input type="number" step="0.000001" id="kitchen-lng" class="form-control" value="${store.location.longitude}" required>
              <span class="form-help">MySQL POINT SRID 4326</span>
            </div>
          </div>

          <div style="background-color: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.85rem;">
            <strong>Viva Engineering Note:</strong> Coordinates are saved using MySQL's spatial <code>POINT SRID 4326</code>. 
            Proximity checks run on the database server using:
            <code style="display: block; margin-top: 0.25rem;">ST_Distance_Sphere(restaurant.location_coord, pool.geographic_zone) &lt;= 5000</code>
          </div>

          <button type="submit" class="btn btn-primary">Save Kitchen Coordinates</button>
        </form>
      </div>
    </div>
  `;
}

export function bindKitchenProfileEvents(router) {
  const form = document.getElementById('form-kitchen-profile');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = parseFloat(document.getElementById('kitchen-lat').value);
    const lng = parseFloat(document.getElementById('kitchen-lng').value);
    const address = document.getElementById('kitchen-address').value;

    store.setLocation(lat, lng, address);
    alert('Kitchen coordinates updated! Nearby pool queries will now use these coordinates.');
    router.navigate('/pools');
  });
}

