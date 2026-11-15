// Sesiuni: token aleator de 32 B în cookie-ul jf_sid; în baza de date stă doar SHA-256 al token-ului.
import { randomBytes, createHash } from 'node:crypto';

export const COOKIE = 'jf_sid';
const MAX_PER_USER = 20;
const DAY = 24 * 3600 * 1000;

const hashToken = (t) => createHash('sha256').update(t).digest('hex');

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k && !(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

export function createSessions(db, cfg) {
  const ttl = cfg.sessionDays * DAY;
  const cookie = (token, maxAge) =>
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

  /** Creează sesiunea; întoarce valoarea antetului Set-Cookie. */
  function create(userId) {
    const token = randomBytes(32).toString('base64url');
    const now = cfg.now();
    db.s.insertSession.run(hashToken(token), userId, now, now + ttl);
    db.s.trimSessions.run(userId, userId, MAX_PER_USER);
    return cookie(token, Math.floor(ttl / 1000));
  }

  /** Din antetul Cookie → { user, hash, setCookie? } sau null. Sesiunea se prelungește cel mult o dată pe zi. */
  function fromRequest(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = hashToken(token);
    const row = db.s.session.get(hash);
    const now = cfg.now();
    if (!row) return null;
    if (row.expires_at <= now) { db.s.deleteSession.run(hash); return null; }
    const user = db.s.userById.get(row.user_id);
    if (!user) return null;
    let setCookie;
    if (row.expires_at - now < ttl - DAY) {
      db.s.extendSession.run(now + ttl, hash);
      setCookie = cookie(token, Math.floor(ttl / 1000));
    }
    return { user, hash, setCookie };
  }

  /** Sesiunea mai e validă? (pentru WebSocket-uri deschise) */
  function stillValid(hash) {
    const row = db.s.session.get(hash);
    return !!row && row.expires_at > cfg.now();
  }

  return {
    create,
    fromRequest,
    stillValid,
    destroy: (hash) => db.s.deleteSession.run(hash),
    /** Invalidează toate sesiunile utilizatorului, eventual cu excepția celei curente. */
    destroyUser: (userId, exceptHash = '') => db.s.deleteUserSessions.run(userId, exceptHash),
    purge: () => db.s.purgeSessions.run(cfg.now()),
    clearCookie: () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  };
}
