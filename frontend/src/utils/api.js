/**
 * api.js
 * ─────────────────────────────────────────────────────────────
 * Centralized fetch wrapper for all API calls.
 *
 * Features:
 *  - Auto-injects `Authorization: Bearer <token>` from localStorage
 *  - On 401 Unauthorized: clears auth credentials + dispatches
 *    `auth:expired` event so the app shell can redirect to /login
 *  - Merges any extra headers the caller provides
 *  - Passes all other fetch options through unchanged
 *
 * Usage:
 *   import { apiFetch } from '../utils/api';
 *
 *   const data = await apiFetch('/dashboard');
 *   const res  = await apiFetch('/analyze', { method: 'POST', body: JSON.stringify(payload) });
 * ─────────────────────────────────────────────────────────────
 */

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

/**
 * Dispatch a custom event that App.js listens to in order to
 * redirect the user to /login when their session expires.
 */
function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

/**
 * Drop-in replacement for `fetch()` that:
 * 1. Prepends API_BASE_URL when the path starts with '/'
 * 2. Injects the Bearer token header automatically
 * 3. Handles 401 by clearing credentials and firing `auth:expired`
 *
 * @param {string} endpoint - Absolute URL or path starting with '/'
 * @param {RequestInit} [options={}]   - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Session expired or token invalid — clear credentials and notify
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('avatar');
    localStorage.removeItem('userProfile');
    notifySessionExpired();
    // Return the response so callers can still read error bodies if needed
    return response;
  }

  return response;
}

/**
 * Convenience: apiFetch + parse JSON in one call.
 * Throws on network errors; returns { ok, status, data } on HTTP errors.
 *
 * @param {string} endpoint
 * @param {RequestInit} [options={}]
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function apiJSON(endpoint, options = {}) {
  const response = await apiFetch(endpoint, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}
