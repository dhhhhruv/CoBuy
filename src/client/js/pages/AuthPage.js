// ============================================================================
// File: src/client/js/pages/AuthPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Interactive Login and Registration page supporting dual roles
//          (restaurant_owner & supplier) adhering to docs/API_CONTRACT.md
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';

export function renderAuthPage() {
  return `
    <div class="container" style="max-width: 500px; padding-top: 2rem;">
      <div class="card" style="padding: 2.25rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">
            Welcome to CoBuy
          </h1>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
            B2B localized group buying for cloud kitchens & wholesale suppliers
          </p>
        </div>

        <!-- Auth Tabs: Login vs Register -->
        <div style="display: flex; border-bottom: 2px solid var(--border-light); margin-bottom: 1.5rem;">
          <button id="tab-login" class="btn" style="flex: 1; border-radius: 0; border-bottom: 3px solid var(--primary); font-weight: 700; color: var(--primary); background: transparent;">
            Sign In
          </button>
          <button id="tab-register" class="btn" style="flex: 1; border-radius: 0; border-bottom: 3px solid transparent; font-weight: 600; color: var(--text-muted); background: transparent;">
            Create Account
          </button>
        </div>

        <div id="auth-alert" style="display: none; padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem; font-size: 0.85rem;"></div>

        <!-- LOGIN FORM -->
        <form id="form-login">
          <div class="form-group">
            <label class="form-label" for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@kitchen.com" required value="kitchen.a@example.com">
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required value="password123">
          </div>

          <button type="submit" id="btn-submit-login" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
            Sign In to CoBuy
          </button>
        </form>

        <!-- REGISTER FORM (Hidden by default) -->
        <form id="form-register" style="display: none;">
          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input type="text" id="reg-username" class="form-control" placeholder="spicy_bowl_admin" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-email">Email Address</label>
            <input type="email" id="reg-email" class="form-control" placeholder="owner@cloudkitchen.com" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-password">Password</label>
            <input type="password" id="reg-password" class="form-control" placeholder="At least 6 characters" minlength="6" required>
          </div>

          <div class="form-group">
            <label class="form-label">Primary Role</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <label style="border: 1px solid var(--border-dark); padding: 0.75rem; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                <input type="radio" name="role_name" value="restaurant_owner" checked>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem;">Cloud Kitchen</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">Pool orders</div>
                </div>
              </label>

              <label style="border: 1px solid var(--border-dark); padding: 0.75rem; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                <input type="radio" name="role_name" value="supplier">
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem;">Supplier</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">List bulk offers</div>
                </div>
              </label>
            </div>
          </div>

          <button type="submit" id="btn-submit-reg" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
            Create Account
          </button>
        </form>

        <!-- Quick Demo Profiles for Viva & Testing -->
        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-light); text-align: center;">
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase; font-weight: 700;">
            1-Click Demo Logins (Viva Testing)
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="quick-demo-kitchen" class="btn btn-outline btn-sm">
              Kitchen A Demo
            </button>
            <button id="quick-demo-supplier" class="btn btn-outline btn-sm">
              Fresh Foods Supplier Demo
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

export function bindAuthEvents(router) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const alertBox = document.getElementById('auth-alert');

  function showAlert(msg, isError = true) {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.style.backgroundColor = isError ? 'var(--accent-red-light)' : 'var(--primary-light)';
    alertBox.style.color = isError ? 'var(--accent-red)' : 'var(--primary-hover)';
    alertBox.innerHTML = msg;
  }

  function hideAlert() {
    if (alertBox) alertBox.style.display = 'none';
  }

  // Tab switching
  tabLogin?.addEventListener('click', () => {
    tabLogin.style.borderBottomColor = 'var(--primary)';
    tabLogin.style.color = 'var(--primary)';
    tabRegister.style.borderBottomColor = 'transparent';
    tabRegister.style.color = 'var(--text-muted)';
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
    hideAlert();
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.style.borderBottomColor = 'var(--primary)';
    tabRegister.style.color = 'var(--primary)';
    tabLogin.style.borderBottomColor = 'transparent';
    tabLogin.style.color = 'var(--text-muted)';
    formLogin.style.display = 'none';
    formRegister.style.display = 'block';
    hideAlert();
  });

  // Login Submit
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-submit-login');
    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    try {
      const data = await api.login(email, password);
      store.setUser(data.user, data.token);
      showAlert('Signed in successfully. Redirecting...', false);

      setTimeout(() => {
        const dest = data.user.roles.includes('supplier') ? '/supplier/dashboard' : '/dashboard';
        router.navigate(dest);
      }, 500);
    } catch (err) {
      showAlert(err.message || 'Login failed. Please check your credentials.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In to CoBuy';
    }
  });

  // Register Submit
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const roleRadio = document.querySelector('input[name="role_name"]:checked');
    const role = roleRadio ? roleRadio.value : 'restaurant_owner';

    const btn = document.getElementById('btn-submit-reg');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const res = await api.register(username, email, password, [role]);
      showAlert('Account created! Signing in...', false);
      const loginData = await api.login(email, password);
      store.setUser(loginData.user, loginData.token);

      setTimeout(() => {
        const dest = role === 'supplier' ? '/supplier/dashboard' : '/dashboard';
        router.navigate(dest);
      }, 600);
    } catch (err) {
      showAlert(err.message || 'Registration failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  // Quick Demo Buttons
  document.getElementById('quick-demo-kitchen')?.addEventListener('click', async () => {
    const data = await api.login('kitchen.a@example.com', 'password123');
    store.setUser(data.user, data.token);
    router.navigate('/dashboard');
  });

  document.getElementById('quick-demo-supplier')?.addEventListener('click', async () => {
    const data = await api.login('sales@freshfoods.com', 'password123');
    store.setUser(data.user, data.token);
    router.navigate('/supplier/dashboard');
  });
}

