// Parole (scrypt), validarea câmpurilor de cont și forma publică a utilizatorului.
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64, SALT = 16;

function scryptAsync(password, salt) {
  return new Promise((res, rej) => {
    scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? rej(err) : res(key)));
  });
}

/** Rezultat: `scrypt$N$r$p$<sare b64>$<hash b64>`. */
export async function hashPassword(password) {
  const salt = randomBytes(SALT);
  const key = await scryptAsync(password, salt);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

// Hash fals folosit când utilizatorul nu există, ca timpul de răspuns să nu-l trădeze.
const DUMMY = `scrypt$${N}$${R}$${P}$${randomBytes(SALT).toString('base64')}$${randomBytes(KEYLEN).toString('base64')}`;

export async function verifyPassword(password, stored) {
  const parts = String(stored || DUMMY).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || +parts[1] !== N || +parts[2] !== R || +parts[3] !== P) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const want = Buffer.from(parts[5], 'base64');
  const got = await scryptAsync(String(password), salt);
  return want.length === got.length && timingSafeEqual(want, got) && stored != null;
}

// ---------- validare ----------
export const AVATARS = ['bear', 'bunny', 'fox', 'cat', 'panda', 'frog', 'owl', 'pig'];
export const COLORS_RE = /^#[0-9a-fA-F]{6}$/;
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hasCtrl = (s) => [...s].some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127 || c === 0x2028 || c === 0x2029; });

export class BadRequest extends Error {
  constructor(code) { super(code); this.code = code; }
}

export const normUsername = (u) => (typeof u === 'string' ? u.trim().toLowerCase() : '');
export const minPassword = (role) => (role === 'admin' ? 10 : 4);

export function checkPassword(pw, role) {
  if (typeof pw !== 'string' || pw.length < minPassword(role) || pw.length > 128) throw new BadRequest('password');
  return pw;
}
export function checkUsername(u) {
  const n = normUsername(u);
  if (!USERNAME_RE.test(n)) throw new BadRequest('username');
  return n;
}
export function checkDisplayName(v) {
  if (typeof v !== 'string') throw new BadRequest('displayName');
  const s = v.trim();
  if (!s || s.length > 40 || hasCtrl(s)) throw new BadRequest('displayName');
  return s;
}
export function checkAvatar(v) {
  if (!AVATARS.includes(v)) throw new BadRequest('avatar');
  return v;
}
export function checkColor(v) {
  if (typeof v !== 'string' || !COLORS_RE.test(v)) throw new BadRequest('color');
  return v.toLowerCase();
}
/** `{ minutesPerDay: 0–600 | null, from: 'HH:MM' | null, to: 'HH:MM' | null }` → coloanele din DB. */
export function checkLimits(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequest('limits');
  for (const k of Object.keys(v)) if (!['minutesPerDay', 'from', 'to'].includes(k)) throw new BadRequest('limits');
  const m = v.minutesPerDay ?? null;
  if (m !== null && !(Number.isInteger(m) && m >= 0 && m <= 600)) throw new BadRequest('limits');
  const hm = (x) => {
    const t = x ?? null;
    if (t !== null && !(typeof t === 'string' && HM_RE.test(t))) throw new BadRequest('limits');
    return t;
  };
  return { minutes_per_day: m, from_hm: hm(v.from), to_hm: hm(v.to) };
}

/** Respinge câmpurile necunoscute din corpul JSON. */
export function onlyKeys(body, allowed) {
  for (const k of Object.keys(body)) if (!allowed.includes(k)) throw new BadRequest('field:' + k.slice(0, 32));
}

/** Forma publică (fără parolă). */
export function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, avatar: u.avatar, color: u.color, role: u.role };
}
export function limitsOf(u) {
  return { minutesPerDay: u.minutes_per_day, from: u.from_hm, to: u.to_hm };
}

/** Creează primul admin din ADMIN_USER / ADMIN_PASSWORD, doar dacă nu există niciun admin. */
export async function bootstrapAdmin(db, cfg) {
  const any = db.raw.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  if (any) return false;
  if (!cfg.adminUser || !cfg.adminPassword) {
    cfg.log('ATENȚIE: nu există niciun admin; setează ADMIN_USER și ADMIN_PASSWORD.');
    return false;
  }
  const username = checkUsername(cfg.adminUser);
  checkPassword(cfg.adminPassword, 'admin');
  db.s.insertUser.run(username, await hashPassword(cfg.adminPassword), username, 'owl', '#7b8cff', 'admin', null, null, null, cfg.now());
  cfg.log(`Admin creat: ${username}`);
  return true;
}
