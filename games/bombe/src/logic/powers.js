// Puterile jucătorilor: bombe (una, în linie), aruncare, telecomandă, bonusuri, „Ciudățel” și bonusurile lăsate la eliminare.
import {
  W, H, DIRS, FUSE, HIT_R, FLIGHT, THROW, CURSE_T, MAX_SPEED, MAX_BOMBS, MAX_RANGE, MAX_SHIELD, EMPTY, WALL, CRATE, idx, bombAt, lavaAt,
} from './rules.js';

export const bombFree = (s, x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const g = s.grid[idx(x, y)];
  return g !== WALL && g !== CRATE && !bombAt(s, x, y) && !lavaAt(s, x, y);
};
const playersIn = (s, x, y) => s.players.filter((q) => q.alive && Math.abs(q.x - x - 0.5) < 0.5 + HIT_R && Math.abs(q.y - y - 0.5) < 0.5 + HIT_R).map((q) => q.id);

export function placeBomb(s, p, ev, x = Math.floor(p.x), y = Math.floor(p.y)) {
  if (p.bombs >= p.maxBombs || !bombFree(s, x, y)) return false;
  s.bombs.push({ x, y, o: p.id, t: FUSE, r: p.range, dx: 0, dy: 0, mt: 0, pass: playersIn(s, x, y), uid: ++s.bn, fl: 0, fx: x, fy: y });
  p.bombs++;
  ev.push({ e: 'place', x, y });
  return true;
}

/** Dublu-apăsare: toate bombele disponibile, în linie, în direcția în care privești. */
export function lineBombs(s, p, ev) {
  const [dx, dy] = DIRS[p.face];
  let x = Math.floor(p.x), y = Math.floor(p.y), n = 0;
  if (bombAt(s, x, y)) { x += dx; y += dy; }
  while (placeBomb(s, p, ev, x, y)) { n++; x += dx; y += dy; }
  return n;
}

const bounce = (v, max) => { while (v < 0 || v > max) v = v < 0 ? -v : 2 * max - v; return v; };

/** Mănușa: bomba de sub tine sau din față zboară 3 plăci peste obstacole și ricoșează la margine. */
export function throwBomb(s, p, ev) {
  const [dx, dy] = DIRS[p.face], cx = Math.floor(p.x), cy = Math.floor(p.y);
  const b = [bombAt(s, cx, cy), bombAt(s, cx + dx, cy + dy)].find((q) => q && !(q.fl > 0));
  if (!b) return false;
  const ox = b.x, oy = b.y;
  s.bombs.splice(s.bombs.indexOf(b), 1);
  let tx = ox, ty = oy;
  for (let k = THROW; k <= THROW + 6; k++) {
    const x = bounce(ox + dx * k, W - 1), y = bounce(oy + dy * k, H - 1);
    if (bombFree(s, x, y)) { tx = x; ty = y; break; }
  }
  Object.assign(b, { x: tx, y: ty, fx: ox, fy: oy, fl: FLIGHT, dx: 0, dy: 0, mt: 0, pass: playersIn(s, tx, ty) });
  s.bombs.push(b);
  ev.push({ e: 'throw', x: tx, y: ty });
  return true;
}

/** Telecomanda: bombele tale explodează acum. */
export function remoteBlow(s, p) {
  let n = 0;
  for (const b of s.bombs) if (b.o === p.id && !(b.fl > 0) && b.t > 0) { b.t = 0; n++; }
  return n > 0;
}

export function pickup(s, p, ev) {
  const i = idx(Math.floor(p.x), Math.floor(p.y)), k = s.pick[i];
  if (!k) return;
  s.pick[i] = 0; s.gv++;
  if (k === 1) p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1);
  else if (k === 2) p.range = Math.min(MAX_RANGE, p.range + 1);
  else if (k === 3) p.spd = Math.min(MAX_SPEED, p.spd + 1);
  else if (k === 4) p.kick = true;
  else if (k === 5) p.shield = Math.min(MAX_SHIELD, p.shield + 1);
  else if (k === 6) p.glove = true;
  else if (k === 7) p.remote = true;
  else if (k === 8 && !s.rules.gentle) { p.cu = s.rng.int(1, 3); p.ce = s.tick + CURSE_T; }
  p.bestB = Math.max(p.bestB, p.maxBombs); p.bestR = Math.max(p.bestR, p.range);
  ev.push({ e: 'pickup', id: p.id, kind: k, x: p.x, y: p.y });
}

/** „Ciudățel” expiră după 10 s și se transmite prin atingere (fără să se prelungească). */
export function curses(s, ev) {
  for (const p of s.players) if (p.cu && s.tick >= p.ce) { p.cu = 0; p.ci = s.tick + 45; }
  for (const p of s.players) {
    if (!p.alive || !p.cu) continue;
    for (const q of s.players) {
      if (q === p || !q.alive || q.cu || s.tick < q.ci || Math.hypot(q.x - p.x, q.y - p.y) > 0.8) continue;
      q.cu = p.cu; q.ce = p.ce;
      ev.push({ e: 'curse', id: q.id, x: q.x, y: q.y });
    }
  }
}

/** Un jucător eliminat își împrăștie bonusurile pe arenă (pe celule goale, departe de flăcări). */
export function dropBonuses(s, p) {
  const items = [];
  for (let i = 1; i < p.maxBombs; i++) items.push(1);
  for (let i = 2; i < p.range; i++) items.push(2);
  for (let i = 0; i < p.spd; i++) items.push(3);
  if (p.kick && !s.rules.kickAll) items.push(4);
  if (p.glove) items.push(6);
  if (p.remote) items.push(7);
  for (const k of items.slice(0, 10)) {
    for (let t = 0; t < 40; t++) {
      const x = s.rng.int(1, W - 2), y = s.rng.int(1, H - 2), i = idx(x, y);
      if (s.grid[i] !== EMPTY || s.pick[i] || bombAt(s, x, y) || lavaAt(s, x, y) || s.flames.some((f) => f.i === i)) continue;
      if (s.players.some((q) => q.alive && Math.floor(q.x) === x && Math.floor(q.y) === y)) continue;
      s.pick[i] = k; s.gv++;
      break;
    }
  }
}
