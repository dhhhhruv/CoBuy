// ============================================================================
// File: src/client/js/state.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Reactive application state store with local persistence & listeners
// ============================================================================

class AppState {
  constructor() {
    this.listeners = [];
    this.user = this.loadUser();
    this.role = this.user?.roles?.[0] || 'restaurant_owner';
    this.location = {
      latitude: 12.9716,
      longitude: 77.5946,
      address: 'Indiranagar 100ft Road, Bangalore'
    };
  }

  loadUser() {
    try {
      const stored = localStorage.getItem('cobuy_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  setUser(user, token) {
    this.user = user;
    this.role = user?.roles?.[0] || 'restaurant_owner';
    if (user) {
      localStorage.setItem('cobuy_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('cobuy_user');
      localStorage.removeItem('cobuy_token');
    }
    this.notify();
  }

  switchRole(role) {
    if (this.role !== role) {
      this.role = role;
      this.notify();
    }
  }

  setLocation(lat, lng, address = '') {
    this.location = { latitude: lat, longitude: lng, address };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }
}

export const store = new AppState();

