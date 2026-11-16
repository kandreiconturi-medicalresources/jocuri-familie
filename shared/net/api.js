// Client HTTP către serverul NAS. Fără server (GitHub Pages) isOnline() e false și nimic nu se apelează.
import { baseFrom } from './util.js';

export const BASE = baseFrom(import.meta.url);
export const siteUrl = (path = '') => new URL(path, BASE).href;

let probe = null;
let online = false;

/** Promise<boolean>, calculat o singură dată: serverul nostru răspunde la api/health. */
export function isOnline() {
  if (!probe) {
    probe = (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      try {
        const r = await fetch(siteUrl('api/health'), { cache: 'no-store', signal: ctrl.signal });
        const j = r.ok ? await r.json().catch(() => null) : null;
        online = !!(j && j.ok && j.app === 'jocuri-familie');
      } catch (e) { online = false; }
      clearTimeout(t);
      return online;
    })();
  }
  return probe;
}
/** Sincron: valabil după ce isOnline() s-a rezolvat. */
export const onlineNow = () => online;

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** api('GET', 'me') → JSON. La 401 trimite la pagina de login. `opts.keepalive` pentru trimiteri la închiderea paginii. */
export async function api(method, path, body, opts = {}) {
  const init = { method, credentials: 'same-origin', headers: {}, cache: 'no-store' };
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  else if (method !== 'GET') init.headers['Content-Type'] = 'application/json';
  if (opts.keepalive) init.keepalive = true;
  const r = await fetch(siteUrl('api/' + path), init);
  if (r.status === 401) { location.href = siteUrl('login'); throw new ApiError(401, 'unauthorized'); }
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (j && j.error) || 'http ' + r.status);
  return j;
}

export const me = () => api('GET', 'me'); // { user, time }
export async function logout() {
  try { await api('POST', 'auth/logout'); } catch (e) { /* ignorat */ }
  location.href = siteUrl('login');
}
export const heartbeat = (game) => api('POST', 'time/heartbeat', { game });

// ---- admin ----
const uid = (id) => 'admin/users/' + encodeURIComponent(id);
export async function adminListUsers() {
  const r = await api('GET', 'admin/users');
  return Array.isArray(r) ? r : (r.users || []);
}
export const adminCreateUser = (u) => api('POST', 'admin/users', u);
export const adminUpdateUser = (id, patch) => api('PATCH', uid(id), patch);
export const adminDeleteUser = (id) => api('DELETE', uid(id));
export const adminBonus = (id, minutes) => api('POST', uid(id) + '/bonus', { minutes });

// ---- salvări (sloturi 1–3 per joc; `data` = string base64 ≤ 1 MB) ----
const sid = (game, slot) => 'saves/' + encodeURIComponent(game) + (slot === undefined ? '' : '/' + encodeURIComponent(slot));
/** [{ slot, name, size, updatedAt }] */
export const listSaves = (game) => api('GET', sid(game));
/** { slot, name, data, updatedAt }; ApiError 404 dacă slotul e gol. */
export const loadSave = (game, slot) => api('GET', sid(game, slot));
/** { slot, name, size, updatedAt }; 413 prea mare, 507 fără spațiu. */
export const putSave = (game, slot, name, data) => api('PUT', sid(game, slot), { name, data });
export const deleteSave = (game, slot) => api('DELETE', sid(game, slot));
