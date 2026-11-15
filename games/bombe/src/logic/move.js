// Mișcarea jucătorilor pe grilă: coliziuni, alunecare la colțuri, împingerea bombelor.
import { HIT_R, WALL, CRATE, idx, bombAt, lavaAt } from './rules.js';

const CORN = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

export function cellSolid(s, cx, cy, p) {
  const g = s.grid[idx(cx, cy)];
  if (g === WALL || g === CRATE) return true;
  const b = bombAt(s, cx, cy);
  return !!(b && !b.pass.includes(p.id));
}

export function blockedAt(s, p, x, y) {
  for (const c of CORN) if (cellSolid(s, Math.floor(x + c[0] * HIT_R), Math.floor(y + c[1] * HIT_R), p)) return true;
  return false;
}

/** Scoate din `pass` jucătorii care au părăsit complet bomba. */
export function resolvePass(s) {
  for (const b of s.bombs) {
    if (!b.pass.length) continue;
    b.pass = b.pass.filter((id) => {
      const q = s.players.find((z) => z.id === id);
      return q && q.alive && Math.abs(q.x - b.x - 0.5) < 0.5 + HIT_R && Math.abs(q.y - b.y - 0.5) < 0.5 + HIT_R;
    });
  }
}

function tryKick(s, p, dx, dy) {
  if (!p.kick) return;
  const ax = Math.floor(p.x + dx * (HIT_R + 0.08)), ay = Math.floor(p.y + dy * (HIT_R + 0.08));
  const b = bombAt(s, ax, ay);
  if (!b || b.dx || b.dy || b.fl > 0 || b.pass.includes(p.id)) return;
  const nx = ax + dx, ny = ay + dy, g = s.grid[idx(nx, ny)];
  if (g === WALL || g === CRATE || bombAt(s, nx, ny) || lavaAt(s, nx, ny)) return;
  b.dx = dx; b.dy = dy; b.mt = 0;
}

export function moveAxis(s, p, dx, dy, sp) {
  for (let k = 0; k < 3; k++, sp /= 2) {
    const nx = p.x + dx * sp, ny = p.y + dy * sp;
    if (!blockedAt(s, p, nx, ny)) { p.x = nx; p.y = ny; return true; }
  }
  tryKick(s, p, dx, dy);
  // alunecare la colț: dacă pe axa culoarului din față e liber, împinge ușor spre centrul culoarului
  if (dx) {
    const cy = Math.floor(p.y) + 0.5, d = cy - p.y;
    if (Math.abs(d) > 1e-3 && !blockedAt(s, p, p.x + dx * 0.2, cy)) {
      const m = Math.max(-sp * 2.8, Math.min(sp * 2.8, d));
      if (!blockedAt(s, p, p.x, p.y + m)) p.y += m;
    }
  } else {
    const cx = Math.floor(p.x) + 0.5, d = cx - p.x;
    if (Math.abs(d) > 1e-3 && !blockedAt(s, p, cx, p.y + dy * 0.2)) {
      const m = Math.max(-sp * 2.8, Math.min(sp * 2.8, d));
      if (!blockedAt(s, p, p.x + m, p.y)) p.x += m;
    }
  }
  return false;
}

/** Alunecarea pe gheață după ce ai dat drumul la direcție: fără împingere de bombe. */
export function slideStep(s, p, dx, dy, sp) {
  const nx = p.x + dx * sp, ny = p.y + dy * sp;
  if (!blockedAt(s, p, nx, ny)) { p.x = nx; p.y = ny; } else p.slide = 0;
}
