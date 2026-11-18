// ============================================================================
// File: src/client/js/router.js
// Owner: Debangshu (Frontend Lead)
// Purpose: Hash-based client router with path parameter extraction and role guards
// ============================================================================

import { store } from './state.js';

export class Router {
  constructor(routes = {}) {
    this.routes = routes; // path -> { render: (params) => HTMLElement/string, role?: string, auth?: boolean }
    this.currentRoute = null;
    this.container = null;

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  setContainer(element) {
    this.container = element;
  }

  register(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.location.hash = path;
  }

  parseHash() {
    const raw = window.location.hash.slice(1) || '/dashboard';
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    const query = new URLSearchParams(queryPart || '');
    return { path, query };
  }

  matchRoute(currentPath) {
    // 1. Exact match
    if (this.routes[currentPath]) {
      return { handler: this.routes[currentPath], params: {} };
    }

    // 2. Pattern match (e.g. /pools/:id)
    for (const routePattern in this.routes) {
      const patternParts = routePattern.split('/');
      const pathParts = currentPath.split('/');

      if (patternParts.length === pathParts.length) {
        const params = {};
        let matched = true;

        for (let i = 0; i < patternParts.length; i++) {
          if (patternParts[i].startsWith(':')) {
            const paramName = patternParts[i].slice(1);
            params[paramName] = pathParts[i];
          } else if (patternParts[i] !== pathParts[i]) {
            matched = false;
            break;
          }
        }

        if (matched) {
          return { handler: this.routes[routePattern], params };
        }
      }
    }

    return null;
  }

  async handleRoute() {
    const { path, query } = this.parseHash();
    const match = this.matchRoute(path);

    if (!match) {
      if (this.container) {
        this.container.innerHTML = `
          <div class="card" style="text-align: center; padding: 3rem;">
            <h2>404 — Page Not Found</h2>
            <p style="color: var(--text-muted); margin: 1rem 0;">The requested screen "${path}" does not exist.</p>
            <a href="#/dashboard" class="btn btn-primary">Return to Dashboard</a>
          </div>
        `;
      }
      return;
    }

    const { handler, params } = match;

    // Route Guards
    if (handler.auth && !store.user) {
      this.navigate('/auth');
      return;
    }

    if (handler.role && store.role && handler.role !== store.role) {
      console.warn(`Role mismatch: route requires ${handler.role}, active role is ${store.role}`);
      if (store.role === 'supplier' && !path.startsWith('/supplier')) {
        this.navigate('/supplier/dashboard');
        return;
      } else if (store.role === 'restaurant_owner' && path.startsWith('/supplier')) {
        this.navigate('/dashboard');
        return;
      }
    }

    this.currentRoute = path;
    if (this.container && handler.render) {
      this.container.innerHTML = '';
      const content = await handler.render(params, query);
      if (typeof content === 'string') {
        this.container.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        this.container.appendChild(content);
      }
      if (handler.afterRender) {
        handler.afterRender(params, query);
      }
    }
  }
}

