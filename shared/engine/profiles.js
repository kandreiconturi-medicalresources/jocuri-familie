// Profiluri locale + avatare desenate în Canvas 2D. Salvările jocurilor sunt legate de profilul curent.
import { store } from './save.js';

export const AVATARS = ['bear', 'bunny', 'fox', 'cat', 'panda', 'frog', 'owl', 'pig'];
export const AVATAR_NAMES = {
  bear: 'Urs', bunny: 'Iepuraș', fox: 'Vulpe', cat: 'Pisică',
  panda: 'Panda', frog: 'Broscuță', owl: 'Bufniță', pig: 'Porcușor',
};
export const PROFILE_COLORS = ['#ff6b6b', '#ff9f43', '#ffd23f', '#6bd66b', '#4cc9f0', '#7b8cff', '#c77dff', '#ff7eb6'];

const meta = store('hub');
const GUEST = 'guest';

function readAll() {
  const l = meta.get('profiles', []);
  return Array.isArray(l) ? l : [];
}

export function listProfiles() { return readAll(); }

export function createProfile({ name, avatar, color }) {
  const p = {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    name: String(name || 'Jucător').trim().slice(0, 14) || 'Jucător',
    avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
    color: color || PROFILE_COLORS[0],
    createdAt: Date.now(),
  };
  meta.set('profiles', readAll().concat(p));
  return p;
}

export function updateProfile(id, patch) {
  let out = null;
  const list = readAll().map((p) => (p.id === id ? (out = { ...p, ...patch, id: p.id }) : p));
  meta.set('profiles', list);
  return out;
}

export function deleteProfile(id) {
  meta.set('profiles', readAll().filter((p) => p.id !== id));
  if (meta.get('current', null) === id) meta.remove('current');
}

export function currentProfile() {
  const id = meta.get('current', null);
  return readAll().find((p) => p.id === id) || null;
}

export function setCurrentProfile(id) {
  if (id == null) meta.remove('current');
  else meta.set('current', id);
}

/** Salvare per joc, pe profilul curent: jf:<profileId>:<gameId>:<cheie>. */
export function gameSave(gameId) {
  const p = currentProfile();
  return store((p ? p.id : GUEST) + ':' + gameId);
}

// ---------- desen ----------
const OUT = '#3b2314';

function parse(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x7b8cff;
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mix(hex, to, t) {
  const a = parse(hex), b = parse(to);
  return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
}
function ell(c, x, y, rx, ry, fill, stroke, lw) {
  c.beginPath();
  c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2);
  paint(c, fill, stroke, lw);
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  paint(c, fill, stroke, lw);
}
function paint(c, fill, stroke, lw) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
function ball(c, x, y, rx, ry, base, lw) { // elipsă cu gradient radial (lumină sus-stânga) și contur
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry));
  g.addColorStop(0, mix(base, '#ffffff', 0.35));
  g.addColorStop(1, base);
  ell(c, x, y, rx, ry, g, OUT, lw);
}
function eye(c, x, y, s, lw) {
  ell(c, x, y, s, s * 1.1, '#2a1a12');
  ell(c, x - s * 0.3, y - s * 0.38, s * 0.38, s * 0.38, '#fff');
}
function smile(c, x, y, w, lw) {
  c.beginPath();
  c.moveTo(x - w, y);
  c.quadraticCurveTo(x, y + w * 0.9, x + w, y);
  c.lineWidth = lw; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
}
function cheeks(c, x, y, dx, s) {
  c.globalAlpha = 0.45;
  ell(c, x - dx, y, s, s * 0.7, '#ff6f91');
  ell(c, x + dx, y, s, s * 0.7, '#ff6f91');
  c.globalAlpha = 1;
}
function nose(c, x, y, s) { ell(c, x, y, s, s * 0.75, '#3b2314'); ell(c, x - s * 0.3, y - s * 0.3, s * 0.3, s * 0.25, 'rgba(255,255,255,.7)'); }

const FACES = {
  bear(c, r, lw) {
    for (const s of [-1, 1]) { ball(c, s * r * 0.46, -r * 0.42, r * 0.22, r * 0.22, '#b9773f', lw); ell(c, s * r * 0.46, -r * 0.4, r * 0.11, r * 0.11, '#ec9f78'); }
    ball(c, 0, 0, r * 0.64, r * 0.58, '#b9773f', lw);
    ball(c, 0, r * 0.2, r * 0.3, r * 0.23, '#f2d3ac', lw * 0.7);
    eye(c, -r * 0.25, -r * 0.08, r * 0.075); eye(c, r * 0.25, -r * 0.08, r * 0.075);
    nose(c, 0, r * 0.12, r * 0.09); smile(c, 0, r * 0.22, r * 0.1, lw * 0.8); cheeks(c, 0, r * 0.18, r * 0.42, r * 0.09);
  },
  bunny(c, r, lw) {
    for (const s of [-1, 1]) { ball(c, s * r * 0.26, -r * 0.56, r * 0.15, r * 0.36, '#f6f1f7', lw); ell(c, s * r * 0.26, -r * 0.54, r * 0.07, r * 0.23, '#ffb3c6'); }
    ball(c, 0, r * 0.05, r * 0.62, r * 0.56, '#f6f1f7', lw);
    eye(c, -r * 0.24, -r * 0.02, r * 0.07); eye(c, r * 0.24, -r * 0.02, r * 0.07);
    nose(c, 0, r * 0.16, r * 0.07); ell(c, 0, r * 0.16, r * 0.07, r * 0.05, '#ff7aa2');
    smile(c, -r * 0.07, r * 0.24, r * 0.07, lw * 0.7); smile(c, r * 0.07, r * 0.24, r * 0.07, lw * 0.7);
    cheeks(c, 0, r * 0.2, r * 0.4, r * 0.09);
  },
  fox(c, r, lw) {
    for (const s of [-1, 1]) {
      poly(c, [[s * r * 0.2, -r * 0.3], [s * r * 0.62, -r * 0.78], [s * r * 0.64, -r * 0.1]], '#e8742a', OUT, lw);
      poly(c, [[s * r * 0.3, -r * 0.3], [s * r * 0.55, -r * 0.6], [s * r * 0.56, -r * 0.2]], '#3b2314');
    }
    ball(c, 0, 0, r * 0.66, r * 0.55, '#ee8433', lw);
    poly(c, [[-r * 0.62, r * 0.02], [0, r * 0.5], [r * 0.62, r * 0.02], [r * 0.3, r * 0.2], [0, r * 0.3], [-r * 0.3, r * 0.2]], '#fff4e6', null);
    ell(c, 0, 0, r * 0.66, r * 0.55, null, OUT, lw); // contur peste
    eye(c, -r * 0.25, -r * 0.1, r * 0.07); eye(c, r * 0.25, -r * 0.1, r * 0.07);
    nose(c, 0, r * 0.28, r * 0.08);
  },
  cat(c, r, lw) {
    for (const s of [-1, 1]) {
      poly(c, [[s * r * 0.15, -r * 0.35], [s * r * 0.55, -r * 0.8], [s * r * 0.62, -r * 0.12]], '#98a3bd', OUT, lw);
      poly(c, [[s * r * 0.27, -r * 0.35], [s * r * 0.5, -r * 0.62], [s * r * 0.54, -r * 0.2]], '#ffb3c6');
    }
    ball(c, 0, 0, r * 0.66, r * 0.55, '#98a3bd', lw);
    for (const s of [-1, 1]) { eye(c, s * r * 0.26, -r * 0.06, r * 0.08); }
    nose(c, 0, r * 0.12, r * 0.06); ell(c, 0, r * 0.12, r * 0.06, r * 0.045, '#ff7aa2');
    smile(c, -r * 0.08, r * 0.2, r * 0.08, lw * 0.7); smile(c, r * 0.08, r * 0.2, r * 0.08, lw * 0.7);
    c.lineWidth = lw * 0.5; c.strokeStyle = OUT; c.lineCap = 'round';
    for (const s of [-1, 1]) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.3, r * 0.17); c.lineTo(s * r * 0.62, r * (0.17 + k * 0.07)); c.stroke(); }
    cheeks(c, 0, r * 0.2, r * 0.4, r * 0.08);
  },
  panda(c, r, lw) {
    for (const s of [-1, 1]) ball(c, s * r * 0.46, -r * 0.42, r * 0.2, r * 0.2, '#2b2b34', lw);
    ball(c, 0, 0, r * 0.64, r * 0.58, '#fafafa', lw);
    for (const s of [-1, 1]) { ell(c, s * r * 0.26, -r * 0.06, r * 0.14, r * 0.18, '#2b2b34'); ell(c, s * r * 0.26, -r * 0.08, r * 0.06, r * 0.07, '#fff'); ell(c, s * r * 0.265, -r * 0.08, r * 0.032, r * 0.04, '#111'); }
    nose(c, 0, r * 0.16, r * 0.085); smile(c, 0, r * 0.25, r * 0.1, lw * 0.8); cheeks(c, 0, r * 0.22, r * 0.42, r * 0.08);
  },
  frog(c, r, lw) {
    ball(c, 0, r * 0.08, r * 0.66, r * 0.52, '#6cc04a', lw);
    for (const s of [-1, 1]) {
      ball(c, s * r * 0.33, -r * 0.4, r * 0.22, r * 0.22, '#6cc04a', lw);
      ell(c, s * r * 0.33, -r * 0.4, r * 0.14, r * 0.14, '#fff'); eye(c, s * r * 0.33, -r * 0.39, r * 0.075);
      ell(c, s * r * 0.08, r * 0.1, r * 0.025, r * 0.02, OUT);
    }
    ball(c, 0, r * 0.3, r * 0.34, r * 0.1, '#ffb3b3', lw * 0.6);
    smile(c, 0, r * 0.24, r * 0.34, lw * 0.9); cheeks(c, 0, r * 0.22, r * 0.5, r * 0.08);
  },
  owl(c, r, lw) {
    for (const s of [-1, 1]) poly(c, [[s * r * 0.2, -r * 0.4], [s * r * 0.5, -r * 0.76], [s * r * 0.58, -r * 0.2]], '#8a5a35', OUT, lw);
    ball(c, 0, 0, r * 0.66, r * 0.6, '#a67a50', lw);
    ball(c, 0, r * 0.28, r * 0.34, r * 0.26, '#f2d3ac', lw * 0.6);
    for (const s of [-1, 1]) { ball(c, s * r * 0.27, -r * 0.1, r * 0.2, r * 0.2, '#fff6d8', lw * 0.8); ell(c, s * r * 0.27, -r * 0.1, r * 0.1, r * 0.1, '#2a1a12'); ell(c, s * r * 0.24, -r * 0.14, r * 0.04, r * 0.04, '#fff'); }
    poly(c, [[-r * 0.09, r * 0.04], [r * 0.09, r * 0.04], [0, r * 0.2]], '#ffb703', OUT, lw * 0.7);
  },
  pig(c, r, lw) {
    for (const s of [-1, 1]) poly(c, [[s * r * 0.25, -r * 0.4], [s * r * 0.62, -r * 0.62], [s * r * 0.6, -r * 0.1]], '#f08aa4', OUT, lw);
    ball(c, 0, 0, r * 0.66, r * 0.58, '#f6a9bd', lw);
    for (const s of [-1, 1]) eye(c, s * r * 0.27, -r * 0.1, r * 0.07);
    ball(c, 0, r * 0.18, r * 0.25, r * 0.19, '#ff8fb0', lw * 0.8);
    for (const s of [-1, 1]) ell(c, s * r * 0.08, r * 0.18, r * 0.03, r * 0.05, '#8a2d4a');
    cheeks(c, 0, r * 0.12, r * 0.47, r * 0.08);
  },
};

/** Desenează avatarul `avatar` centrat în (x,y), în cerc de rază `r`, pe fundal din `color`. */
export function drawAvatar(ctx, avatar, x, y, r, color) {
  const face = FACES[avatar] || FACES.bear;
  const lw = Math.max(1, r * 0.05);
  ctx.save();
  ctx.translate(x, y);
  const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  bg.addColorStop(0, mix(color, '#ffffff', 0.45));
  bg.addColorStop(1, mix(color, '#000000', 0.12));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.translate(0, r * 0.08);
  ctx.scale(0.98, 0.98);
  face(ctx, r, lw);
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r - lw * 0.6, 0, Math.PI * 2);
  ctx.lineWidth = lw * 1.2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  ctx.restore();
}
