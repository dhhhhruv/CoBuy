// ============================================================================
// File: src/client/js/pages/KitchenProfilePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Load, create, update or delete the signed-in owner's kitchen profile.
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { showToast, showError } from '../components/Toast.js';

export async function renderKitchenProfilePage() {
  const restaurants = await api.getMyRestaurants();
  const existing = restaurants[0] || null;

  if (existing) {
    store.setLocation(
      existing.location?.latitude ?? store.location.latitude,
      existing.location?.longitude ?? store.location.longitude,
      existing.addressText || store.location.address
    );
  }

  const lat = existing?.location?.latitude ?? store.location.latitude;
  const lng = existing?.location?.longitude ?? store.location.longitude;

  return `
    <div class="container" style="max-width: 680px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Cloud Kitchen Profile</h2>
            <p class="card-subtitle">
              ${existing
                ? 'Update your kitchen details and 5 km discovery anchor.'
                : 'Create your kitchen profile before pledging into pools.'}
            </p>
          </div>
          ${existing ? '<span class="badge badge-status-active">PROFILE ACTIVE</span>' : '<span class="badge badge-status-pending">SETUP NEEDED</span>'}
        </div>

        <form id="form-kitchen-profile">
          <div class="form-group">
            <label class="form-label" for="kitchen-name">Kitchen Business Name</label>
            <input type="text" id="kitchen-name" class="form-control" required
                   value="${existing?.businessName || 'Kitchen ' + (store.user?.username || '')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="kitchen-address">Physical Kitchen Address</label>
            <input type="text" id="kitchen-address" class="form-control" required
                   value="${existing?.addressText || store.location.address}">
          </div>

          <div class="form-group">
            <label class="form-label" for="kitchen-wallet">Wallet Balance (₹)</label>
            <input type="number" step="0.01" min="0" id="kitchen-wallet" class="form-control"
                   value="${existing?.walletBalance ?? '0.00'}">
            <span class="form-help">Stored for reporting only; no payment gateway is connected.</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="kitchen-lat">Latitude (WGS 84)</label>
              <input type="number" step="0.000001" id="kitchen-lat" class="form-control" value="${lat}" required>
              <span class="form-help">MySQL POINT SRID 4326</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="kitchen-lng">Longitude (WGS 84)</label>
              <input type="number" step="0.000001" id="kitchen-lng" class="form-control" value="${lng}" required>
              <span class="form-help">MySQL POINT SRID 4326</span>
            </div>
          </div>

          <div style="background-color: var(--bg); padding: 1rem; border-radius: var(--radius-card); margin-bottom: 1.5rem; font-size: 0.85rem;">
            <strong>Viva Engineering Note:</strong> Coordinates are saved using MySQL's spatial <code>POINT SRID 4326</code>.
            Proximity checks run on the database server using:
            <code style="display: block; margin-top: 0.25rem;">ST_Distance_Sphere(restaurant.location_coord, pool.geographic_zone) &lt;= 5000</code>
          </div>

          <div class="form-actions">
            ${existing ? '<button type="button" id="btn-delete-kitchen" class="btn btn-outline">Delete Profile</button>' : '<span></span>'}
            <button type="submit" class="btn btn-primary" id="btn-save-kitchen">
              ${existing ? 'Save Kitchen Changes' : 'Create Kitchen Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function bindKitchenProfileEvents(router) {
  const form = document.getElementById('form-kitchen-profile');
  const submit = document.getElementById('btn-save-kitchen');
  const deleteButton = document.getElementById('btn-delete-kitchen');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      businessName: document.getElementById('kitchen-name').value.trim(),
      addressText: document.getElementById('kitchen-address').value.trim(),
      walletBalance: Number(document.getElementById('kitchen-wallet').value || 0),
      latitude: Number(document.getElementById('kitchen-lat').value),
      longitude: Number(document.getElementById('kitchen-lng').value)
    };

    submit.disabled = true;
    submit.textContent = 'Saving...';

    try {
      const current = await api.getMyRestaurants();
      if (current.length > 0) {
        await api.updateRestaurant(current[0].restaurantId, payload);
      } else {
        await api.createRestaurant(payload);
      }
      store.setLocation(payload.latitude, payload.longitude, payload.addressText);
      showToast('Kitchen profile saved.', 'success');
      router.navigate('/pools');
    } catch (error) {
      showError(error);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Save Kitchen Changes';
    }
  });

  deleteButton?.addEventListener('click', async () => {
    if (!window.confirm('Delete this kitchen profile? Profiles with micro-orders cannot be deleted.')) return;
    try {
      const current = await api.getMyRestaurants();
      if (current.length === 0) return;
      await api.deleteRestaurant(current[0].restaurantId);
      showToast('Kitchen profile deleted.', 'success');
      router.navigate('/dashboard');
    } catch (error) {
      showError(error);
      deleteButton.disabled = false;
    }
  });
}
