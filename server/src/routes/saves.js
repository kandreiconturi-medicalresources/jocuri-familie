// Salvări pe sloturi: GET /api/saves/:game, GET|PUT|DELETE /api/saves/:game/:slot.
// Fiecare utilizator vede și modifică doar salvările lui; inexistent sau al altcuiva → același 404.
import { onlyKeys, BadRequest } from '../auth.js';
import { HttpError } from '../security.js';

const NAME_BAD = /[\p{Cc}\u2028\u2029]/u; // C0, DEL, C1 și separatorii de linie/paragraf
const B64_CHARS = /^[A-Za-z0-9+/]*={0,2}$/;

/** Nume: string, după trim nevid, ≤ 40 caractere, fără caractere de control. */
export function checkSaveName(v) {
  if (typeof v !== 'string') throw new BadRequest('name');
  const s = v.trim();
  if (!s || s.length > 40 || NAME_BAD.test(s)) throw new BadRequest('name');
  return s;
}

/** Base64 standard, canonic (padding corect), nevid, ≤ `max` caractere. */
export function checkSaveData(v, max) {
  if (typeof v !== 'string' || !v.length || v.length % 4 !== 0) throw new BadRequest('data');
  if (v.length > max) throw new HttpError(413, 'too_large');
  if (!B64_CHARS.test(v)) throw new BadRequest('data');
  // Buffer.from ignoră tăcut caracterele invalide; ocolul invers prinde și biții de padding nenuli.
  if (Buffer.from(v, 'base64').toString('base64') !== v) throw new BadRequest('data');
  return v;
}

const notFound = () => new HttpError(404, 'not_found');

export default function savesRoutes(ctx) {
  const { db, cfg } = ctx;

  function list({ params, auth }) {
    const rows = db.s.saves.all(auth.user.id, params[0]);
    return [200, rows.map((r) => ({ slot: r.slot, name: r.name, size: r.size, updatedAt: r.updated_at }))];
  }

  function get({ params, auth }) {
    const row = db.s.save.get(auth.user.id, params[0], Number(params[1]));
    if (!row) throw notFound();
    return [200, { slot: row.slot, name: row.name, data: row.data, updatedAt: row.updated_at }];
  }

  function put({ params, body, auth }) {
    onlyKeys(body, ['name', 'data']);
    const name = checkSaveName(body.name);
    const data = checkSaveData(body.data, cfg.maxSaveBytes);
    const uid = auth.user.id, game = params[0], slot = Number(params[1]);
    const size = data.length; // ASCII: caractere = octeți stocați
    const now = cfg.now();
    db.tx(() => {
      const old = db.s.saveSize.get(uid, game, slot);
      if (!old && db.s.countUserSaves.get(uid).n >= cfg.maxSavesPerUser) throw new HttpError(507, 'too_many_saves');
      const total = db.s.totalSavesSize.get().n - (old ? old.size : 0) + size;
      if (total > cfg.maxSavesTotalBytes) throw new HttpError(507, 'storage_full');
      db.s.putSave.run(uid, game, slot, name, data, size, now);
    });
    return [200, { slot, name, size, updatedAt: now }];
  }

  function remove({ params, auth }) {
    const r = db.s.deleteSave.run(auth.user.id, params[0], Number(params[1]));
    if (!r.changes) throw notFound();
    return [200, { ok: true }];
  }

  const all = /^\/api\/saves\/([a-z]{2,16})$/;
  const one = /^\/api\/saves\/([a-z]{2,16})\/([1-3])$/;
  return [
    { method: 'GET', path: all, auth: 'user', handler: list },
    { method: 'GET', path: one, auth: 'user', handler: get },
    // Singura rută cu corp mare: {"name":…,"data":<≤ 1 MB base64>}; restul rămân la cfg.maxBodyBytes.
    { method: 'PUT', path: one, auth: 'user', handler: put, maxBody: cfg.maxSaveBody },
    { method: 'DELETE', path: one, auth: 'user', handler: remove },
  ];
}
