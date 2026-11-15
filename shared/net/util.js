// Funcții pure pentru rețea: îmbinare de progres, debounce, adrese, evaluarea bătăilor de inimă.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Îmbină două progrese: numere → maximul, obiecte → recursiv, restul → valoarea din `a` (locală) dacă există. */
export function mergeData(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of Object.keys(b)) out[k] = b[k];
    for (const k of Object.keys(a)) out[k] = k in b ? mergeData(a[k], b[k]) : a[k];
    return out;
  }
  return a;
}

export const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Debounce cu ceas injectabil (pentru teste). `d.flush()` execută imediat dacă e ceva în așteptare. */
export function debounce(fn, ms, timers = { set: (f, t) => setTimeout(f, t), clear: (i) => clearTimeout(i) }) { // fără apel „detașat” al lui setTimeout (Illegal invocation în browser)
  let id = null;
  const run = () => { id = null; fn(); };
  const d = () => { if (id !== null) timers.clear(id); id = timers.set(run, ms); };
  d.flush = () => { if (id === null) return false; timers.clear(id); run(); return true; };
  d.pending = () => id !== null;
  return d;
}

/** Rădăcina site-ului, dedusă din adresa unui modul (în build: .../assets/x.js; în dev: .../shared/net/x.js). */
export function baseFrom(moduleUrl) {
  const u = new URL(moduleUrl);
  const m = /^(.*?\/)(assets|shared)\//.exec(u.pathname);
  u.pathname = m ? m[1] : u.pathname.replace(/[^/]*$/, '');
  u.search = ''; u.hash = '';
  return u.href;
}

/** Adresa WebSocket (ws/wss) din adresa http(s) a rădăcinii site-ului. */
export function wsUrl(base, path = 'ws') {
  const u = new URL(path, base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.href;
}

/** Rezultatul unei bătăi de inimă: { missed, blocked }. `res` = { time } sau null când a eșuat. */
export function beatOutcome(missed, res) {
  if (!res || !res.time) {
    const m = missed + 1;
    return { missed: m, blocked: m >= 2 ? 'offline' : null };
  }
  const t = res.time;
  return { missed: 0, blocked: t.allowedNow === false ? (t.reason || 'limit') : null };
}

export function fmtMinutes(sec) {
  const m = Math.max(0, Math.round((sec || 0) / 60));
  return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
}
