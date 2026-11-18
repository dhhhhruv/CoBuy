// ============================================================================
// File: src/client/js/pages/SupplierProfilePage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Wholesale supplier company & warehouse coordinate setup
// ============================================================================

export function renderSupplierProfilePage() {
  return `
    <div class="container" style="max-width: 680px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Wholesale Supplier Profile</h2>
            <p class="card-subtitle">Manage company info and central warehouse coordinates</p>
          </div>
        </div>

        <form id="form-supplier-profile">
          <div class="form-group">
            <label class="form-label" for="sup-name">Company Name</label>
            <input type="text" id="sup-name" class="form-control" value="Fresh Foods Wholesale Ltd." required>
          </div>

          <div class="form-group">
            <label class="form-label" for="sup-email">Contact / Billing Email</label>
            <input type="email" id="sup-email" class="form-control" value="sales@freshfoods.com" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="wh-lat">Warehouse Latitude (WGS 84)</label>
              <input type="number" step="0.000001" id="wh-lat" class="form-control" value="12.9720" required>
              <span class="form-help">SRID 4326</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="wh-lng">Warehouse Longitude (WGS 84)</label>
              <input type="number" step="0.000001" id="wh-lng" class="form-control" value="77.5950" required>
              <span class="form-help">SRID 4326</span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary">Save Supplier Profile</button>
        </form>
      </div>
    </div>
  `;
}

export function bindSupplierProfileEvents(router) {
  const form = document.getElementById('form-supplier-profile');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Supplier warehouse profile updated successfully.');
    router.navigate('/supplier/dashboard');
  });
}

