// GET /api/progress/:game, PUT /api/progress/:game {data}. Pentru `bobo` serverul îmbină progresul.
import { onlyKeys, BadRequest } from '../auth.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const LEVEL_KEY = /^\d{1,4}$/;

/** Hartă { nivel: număr } păstrând doar chei de nivel și valori întregi în [0, max]. */
function cleanMap(m, max) {
  const out = {};
  if (!isObj(m)) return out;
  for (const [k, v] of Object.entries(m)) if (LEVEL_KEY.test(k) && Number.isInteger(v) && v >= 0) out[k] = Math.min(v, max);
  return out;
}
function maxMap(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/**
 * Îmbinare `bobo` ({ unlocked, stars: {i: 0–3}, fruits: {i: n}, twoPlayers }): nivelul deblocat, steluțele
 * și fructele iau maximul (progresul nu se pierde de pe alt dispozitiv); restul câmpurilor vin din cererea nouă.
 */
export function mergeBobo(oldData, incoming) {
  const a = isObj(oldData) ? oldData : {};
  const out = { ...a, ...incoming };
  const ua = Number.isInteger(a.unlocked) ? a.unlocked : 0;
  const ub = Number.isInteger(incoming.unlocked) ? incoming.unlocked : 0;
  out.unlocked = Math.max(ua, ub);
  out.stars = maxMap(cleanMap(a.stars, 3), cleanMap(incoming.stars, 3));
  out.fruits = maxMap(cleanMap(a.fruits, 1e6), cleanMap(incoming.fruits, 1e6));
  return out;
}

const MERGERS = { bobo: mergeBobo };

export default function progressRoutes(ctx) {
  const { db, cfg } = ctx;

  function get({ params, auth }) {
    const row = db.s.progress.get(auth.user.id, params[0]);
    return [200, { data: row ? JSON.parse(row.data) : null, updatedAt: row ? row.updated_at : null }];
  }

  function put({ params, body, auth }) {
    onlyKeys(body, ['data']);
    if (!isObj(body.data)) throw new BadRequest('data');
    const game = params[0];
    const merged = db.tx(() => {
      const row = db.s.progress.get(auth.user.id, game);
      const merge = MERGERS[game];
      const data = merge ? merge(row ? JSON.parse(row.data) : null, body.data) : body.data;
      const text = JSON.stringify(data);
      if (Buffer.byteLength(text) > cfg.maxProgressBytes) throw new BadRequest('too_large');
      db.s.putProgress.run(auth.user.id, game, text, cfg.now());
      return data;
    });
    return [200, { data: merged }];
  }

  const path = /^\/api\/progress\/([a-z0-9][a-z0-9-]{0,31})$/;
  return [
    { method: 'GET', path, auth: 'user', handler: get },
    // Corpul poate avea până la 64 KB de date + învelișul {"data":...}.
    { method: 'PUT', path, auth: 'user', handler: put, maxBody: 64 * 1024 + 256 },
  ];
}
