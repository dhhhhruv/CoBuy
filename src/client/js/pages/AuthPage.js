// ============================================================================
// File: src/client/js/pages/AuthPage.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Login and registration against the real API, with the seeded demo
//          accounts available as one-click sign-ins for the viva.
// ============================================================================

import { api } from '../api/client.js';
import { store } from '../state.js';
import { showToast } from '../components/Toast.js';

const DEMO_PASSWORD = 'Password123!';
const DEMO_KITCHEN = 'demo.kitchen.a@cobuy.demo';
const DEMO_SUPPLIER = 'demo.freshfoods@cobuy.demo';

export function renderAuthPage() {
  if (store.user) {
    const home = store.role === 'supplier' ? '/supplier/dashboard' : '/dashboard';
    return `
      <div class="container" style="max-width: 480px; padding-top: 3rem;">
        <div class="card" style="padding: 2.25rem; text-align: center;">
          <h1 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">Already signed in</h1>
          <p style="color: var(--text-2);">
            You are signed in as <strong>${store.user.username || store.user.email}</strong>.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem;">
            <a href="#${home}" class="btn btn-primary">Continue</a>
            <button type="button" id="btn-switch-account" class="btn btn-outline">Sign out</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="container" style="max-width: 500px; padding-top: 2rem;">
      <div class="card" style="padding: 2.25rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text);">
            Welcome to CoBuy
          </h1>
          <p style="color: var(--text-2); font-size: 0.9rem; margin-top: 0.5rem;">
            B2B localized group buying for cloud kitchens & wholesale suppliers
          </p>
        </div>

        <div style="display: flex; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem;">
          <button id="tab-login" class="btn" style="flex: 1; border-radius: 0; border-bottom: 3px solid var(--accent); font-weight: 700; color: var(--accent); background: transparent;">
            Sign In
          </button>
          <button id="tab-register" class="btn" style="flex: 1; border-radius: 0; border-bottom: 3px solid transparent; font-weight: 600; color: var(--text-2); background: transparent;">
            Create Account
          </button>
        </div>

        <div id="auth-alert" class="form-alert" style="display: none;"></div>

        <form id="form-login">
          <div class="form-group">
            <label class="form-label" for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@kitchen.com" required value="${DEMO_KITCHEN}">
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required value="${DEMO_PASSWORD}">
          </div>

          <button type="submit" id="btn-submit-login" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
            Sign In to CoBuy
          </button>
        </form>

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
              <label style="border: 1px solid var(--border); padding: 0.75rem; border-radius: var(--radius-card); cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                <input type="radio" name="role_name" value="restaurant_owner" checked>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem;">Cloud Kitchen</div>
                  <div style="font-size: 0.7rem; color: var(--text-2);">Pool orders</div>
                </div>
              </label>

              <label style="border: 1px solid var(--border); padding: 0.75rem; border-radius: var(--radius-card); cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                <input type="radio" name="role_name" value="supplier">
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem;">Supplier</div>
                  <div style="font-size: 0.7rem; color: var(--text-2);">List bulk offers</div>
                </div>
              </label>
            </div>
          </div>

          <button type="submit" id="btn-submit-reg" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
            Create Account
          </button>
        </form>

        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed var(--border); text-align: center;">
          <p style="font-size: 0.75rem; color: var(--text-2); margin-bottom: 0.75rem; text-transform: uppercase; font-weight: 700;">
            Seeded Demo Accounts
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="quick-demo-kitchen" class="btn btn-outline btn-sm">Kitchen A Demo</button>
            <button id="quick-demo-supplier" class="btn btn-outline btn-sm">Fresh Foods Supplier Demo</button>
          </div>
          <p style="font-size: 0.7rem; color: var(--text-2); margin-top: 0.6rem;">
            Requires <code>npm run db:seed</code>. Password: <code>${DEMO_PASSWORD}</code>
          </p>
        </div>
      </div>
    </div>
  `;
}

export function bindAuthEvents(router) {
  document.getElementById('btn-switch-account')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch (error) {
      // Clear locally even if revoke fails.
    }
    store.setUser(null);
    if (window.location.hash === '#/auth') router.handleRoute();
    else router.navigate('/auth');
  });

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const alertBox = document.getElementById('auth-alert');

  function showAlert(message, isError = true) {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.className = `form-alert ${isError ? 'form-alert--error' : 'form-alert--success'}`;
    alertBox.textContent = message;
  }

  function hideAlert() {
    if (alertBox) alertBox.style.display = 'none';
  }

  function activateTab(tab) {
    const loginActive = tab === 'login';
    tabLogin.style.borderBottomColor = loginActive ? 'var(--accent)' : 'transparent';
    tabLogin.style.color = loginActive ? 'var(--accent)' : 'var(--text-2)';
    tabRegister.style.borderBottomColor = loginActive ? 'transparent' : 'var(--accent)';
    tabRegister.style.color = loginActive ? 'var(--text-2)' : 'var(--accent)';
    formLogin.style.display = loginActive ? 'block' : 'none';
    formRegister.style.display = loginActive ? 'none' : 'block';
    hideAlert();
  }

  tabLogin?.addEventListener('click', () => activateTab('login'));
  tabRegister?.addEventListener('click', () => activateTab('register'));

  async function signIn(email, password) {
    const data = await api.login(email, password);
    store.setUser(data.user, data.token);
    const dest = data.user.roles.includes('supplier') ? '/supplier/dashboard' : '/dashboard';
    router.navigate(dest);
  }

  formLogin?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const button = document.getElementById('btn-submit-login');
    button.disabled = true;
    button.textContent = 'Authenticating...';

    try {
      await signIn(email, password);
      showToast('Signed in successfully.', 'success');
    } catch (error) {
      showAlert(error.message || 'Login failed. Check your credentials.');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign In to CoBuy';
    }
  });

  formRegister?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.querySelector('input[name="role_name"]:checked')?.value || 'restaurant_owner';

    const button = document.getElementById('btn-submit-reg');
    button.disabled = true;
    button.textContent = 'Creating account...';

    try {
      await api.register(username, email, password, [role]);
      await signIn(email, password);
      showToast('Account created. Welcome to CoBuy.', 'success');
    } catch (error) {
      showAlert(error.message || 'Registration failed.');
    } finally {
      button.disabled = false;
      button.textContent = 'Create Account';
    }
  });

  document.getElementById('quick-demo-kitchen')?.addEventListener('click', async () => {
    try {
      await signIn(DEMO_KITCHEN, DEMO_PASSWORD);
      showToast('Signed in as Kitchen A.', 'success');
    } catch (error) {
      showAlert(`${error.message} Run "npm run db:seed" first.`);
    }
  });

  document.getElementById('quick-demo-supplier')?.addEventListener('click', async () => {
    try {
      await signIn(DEMO_SUPPLIER, DEMO_PASSWORD);
      showToast('Signed in as Fresh Foods.', 'success');
    } catch (error) {
      showAlert(`${error.message} Run "npm run db:seed" first.`);
    }
  });
}
