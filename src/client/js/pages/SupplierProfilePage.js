// ============================================================================
// File: src/client/js/pages/SupplierProfilePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Load, create, update or delete the signed-in supplier company profile.
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { showToast, showError } from '../components/Toast.js';

export async function renderSupplierProfilePage() {
  const existing = await api.getMySupplier();

  return `
    <div class="container" style="max-width: 680px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Wholesale Supplier Profile</h2>
            <p class="card-subtitle">
              ${existing
                ? 'Manage company details and the warehouse coordinate used for clusters.'
                : 'Create your company profile before publishing catalogue offers.'}
            </p>
          </div>
          ${existing ? '<span class="badge badge-status-active">COMPANY ACTIVE</span>' : '<span class="badge badge-status-pending">SETUP NEEDED</span>'}
        </div>

        <form id="form-supplier-profile">
          <div class="form-group">
            <label class="form-label" for="sup-name">Company Name</label>
            <input type="text" id="sup-name" class="form-control" required
                   value="${existing?.companyName || 'Supplier ' + (store.user?.username || '')}">
          </div>

          <div class="form-group">
            <label class="form-label" for="sup-email">Contact / Billing Email</label>
            <input type="email" id="sup-email" class="form-control" required
                   value="${existing?.contactEmail || store.user?.email || ''}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="wh-lat">Warehouse Latitude (WGS 84)</label>
              <input type="number" step="0.000001" id="wh-lat" class="form-control" required
                     value="${existing?.warehouseLocation?.latitude ?? 12.9600}">
              <span class="form-help">SRID 4326</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="wh-lng">Warehouse Longitude (WGS 84)</label>
              <input type="number" step="0.000001" id="wh-lng" class="form-control" required
                     value="${existing?.warehouseLocation?.longitude ?? 77.6300}">
              <span class="form-help">SRID 4326</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 1rem;">
            ${existing ? '<button type="button" id="btn-delete-supplier" class="btn btn-outline">Delete Company</button>' : '<span></span>'}
            <button type="submit" class="btn btn-primary" id="btn-save-supplier">
              ${existing ? 'Save Company Changes' : 'Create Company Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function bindSupplierProfileEvents(router) {
  const form = document.getElementById('form-supplier-profile');
  const submit = document.getElementById('btn-save-supplier');
  const deleteButton = document.getElementById('btn-delete-supplier');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      companyName: document.getElementById('sup-name').value.trim(),
      contactEmail: document.getElementById('sup-email').value.trim(),
      latitude: Number(document.getElementById('wh-lat').value),
      longitude: Number(document.getElementById('wh-lng').value)
    };

    submit.disabled = true;
    submit.textContent = 'Saving...';

    try {
      const existing = await api.getMySupplier();
      if (existing) {
        await api.updateSupplier(existing.supplierId, payload);
      } else {
        await api.createSupplier(payload);
      }
      showToast('Supplier company profile saved.', 'success');
      router.navigate('/supplier/dashboard');
    } catch (error) {
      showError(error);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Save Company Changes';
    }
  });

  deleteButton?.addEventListener('click', async () => {
    if (!window.confirm('Delete this company profile? Companies with catalogue offers cannot be deleted.')) return;
    try {
      const existing = await api.getMySupplier();
      if (!existing) return;
      await api.deleteSupplier(existing.supplierId);
      showToast('Supplier company deleted.', 'success');
      router.navigate('/supplier/dashboard');
    } catch (error) {
      showError(error);
      deleteButton.disabled = false;
    }
  });
}
