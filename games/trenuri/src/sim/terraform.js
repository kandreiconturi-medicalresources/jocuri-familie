// Teren: nivelare, tăiat pădure, tunel scurt prin deal. Numai întregi; totul trece prin applyCommand.
import { DX, DY, opp, COST, MAX_STEP, WATER_H, LEVEL, TUNNEL, T_PRESENT, T_TUNNEL, T_BRIDGE, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';

const fail = (err) => ({ ok: false, err });
const ownerOf = (t) => (t & T_OWNER_MASK) >> T_OWNER_SHIFT;
const isInt = Number.isInteger;

/** Prețul nivelării: crește cu volumul mutat (suma diferențelor de înălțime) și puțin mai repede la volume mari. */
export const levelCostOf = (vol) => LEVEL.unit * vol + ((vol * vol) >> 3);

/** Dreptunghi normalizat din cmd, sau null dacă iese din hartă / e prea mare. */
export function rectOf(s, c) {
  if (![c.x0, c.y0, c.x1, c.y1].every(isInt)) return null;
  const x0 = Math.min(c.x0, c.x1), x1 = Math.max(c.x0, c.x1), y0 = Math.min(c.y0, c.y1), y1 = Math.max(c.y0, c.y1);
  if (x0 < 0 || y0 < 0 || x1 >= s.w || y1 >= s.h) return null;
  if (x1 - x0 >= LEVEL.maxSide || y1 - y0 >= LEVEL.maxSide || (x1 - x0 + 1) * (y1 - y0 + 1) > LEVEL.maxArea) return null;
  return { x0, y0, x1, y1 };
}

/** Ce s-ar muta la nivelarea dreptunghiului la înălțimea h: { ok, err?, vol, cost, tiles:[[i,h]] }. */
export function levelPlan(s, c, h, by) {
  const r = rectOf(s, c);
  if (!r) return fail('harta');
  if (!isInt(h) || h <= WATER_H || h > 15) return fail('teren');
  let vol = 0;
  const tiles = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const i = y * s.w + x;
    if (s.water[i]) continue;
    if (s.height[i] === h) continue;
    if (s.occ[i]) return fail('cladire');
    const t = s.track[i];
    if ((t & T_PRESENT) && ownerOf(t) !== by) return fail('proprietar');
    if (s.stm[i]) return fail('gara');
    vol += Math.abs(s.height[i] - h); tiles.push([i, h]);
  }
  if (!tiles.length) return fail('teren');
  return { ok: true, vol, cost: levelCostOf(vol), tiles };
}

function levelTerrain(s, cmd, c) {
  const p = levelPlan(s, cmd, cmd.h, c.id);
  if (!p.ok) return p;
  if (!s.sandbox && c.cash < p.cost) return fail('bani');
  if (!s.sandbox) c.cash -= p.cost;
  for (const [i, h] of p.tiles) s.height[i] = h;
  s.dirty.terrain = s.dirty.track = true;
  return { ok: true, cost: p.cost };
}

function clearArea(s, cmd, c) {
  const r = rectOf(s, cmd);
  if (!r) return fail('harta');
  const hit = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const i = y * s.w + x; if (s.forest[i] && !s.occ[i]) hit.push(i); }
  if (!hit.length) return fail('teren');
  const cost = hit.length * LEVEL.clear;
  if (!s.sandbox && c.cash < cost) return fail('bani');
  if (!s.sandbox) c.cash -= cost;
  for (const i of hit) s.forest[i] = 0;
  s.dirty.forest = true;
  return { ok: true, cost };
}

/** Înălțimile care trebuie schimbate ca drumul să urce cel mult MAX_STEP pe placă: [[x,y,h],...] (doar plăci noi, pe uscat). */
export function fitLevels(s, path) {
  const out = [];
  let prev = s.height[path[0]];
  for (let k = 1; k < path.length; k++) {
    const i = path[k], base = s.height[i];
    if (s.water[i] || s.water[path[k - 1]] || (s.track[i] & T_PRESENT)) { prev = base; continue; }
    let h = Math.max(prev - MAX_STEP, Math.min(prev + MAX_STEP, base));
    if (h <= WATER_H) h = WATER_H + 1;
    if (h !== base) out.push([i % s.w, (i / s.w) | 0, h]);
    prev = h;
  }
  return out;
}
export const levelVolume = (s, list) => list.reduce((n, [x, y, h]) => n + Math.abs(s.height[y * s.w + x] - h), 0);

/** Aplică o listă [[x,y,h]] la buildTrack (doar pe plăcile drumului, libere). Întoarce { ok, cost, undo }. */
export function applyLevels(s, list, path) {
  if (!Array.isArray(list) || list.length > 400) return fail('drum');
  const on = new Set(path.map((p) => p[1] * s.w + p[0]));
  let vol = 0;
  const saved = [];
  for (const q of list) {
    if (!Array.isArray(q) || !q.every(isInt)) return fail('drum');
    const [x, y, h] = q;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h || h <= WATER_H || h > 15) return fail('teren');
    const i = y * s.w + x;
    if (!on.has(i) || s.water[i] || s.occ[i] || (s.track[i] & T_PRESENT)) return fail('teren');
  }
  for (const [x, y, h] of list) { const i = y * s.w + x; vol += Math.abs(s.height[i] - h); saved.push([i, s.height[i]]); s.height[i] = h; }
  return { ok: true, cost: levelCostOf(vol), undo: () => { for (let k = saved.length - 1; k >= 0; k--) s.height[saved[k][0]] = saved[k][1]; } };
}

/** Pune șina pe drum (plăci [x,y]) și leagă plăcile; `tun(k)` spune ce plăci sunt de tunel. */
export function layPath(s, path, c, tun = null) {
  const w = s.w;
  for (let k = 0; k < path.length; k++) {
    const i = path[k][1] * w + path[k][0];
    let t = s.track[i] | T_PRESENT | (c.id << T_OWNER_SHIFT);
    if (s.water[i]) t |= T_BRIDGE;
    if (tun && tun(k)) t |= T_TUNNEL;
    if (k > 0) {
      const dx = path[k][0] - path[k - 1][0], dy = path[k][1] - path[k - 1][1];
      const d = DX.findIndex((v, q) => v === dx && DY[q] === dy), pi = path[k - 1][1] * w + path[k - 1][0];
      t |= 1 << opp(d);
      s.track[pi] |= 1 << d;
    }
    s.track[i] = t;
    s.forest[i] = 0;
  }
  s.dirty.track = s.dirty.forest = true;
}

function buildTunnel(s, cmd, c) {
  const { x0, y0, x1, y1 } = cmd;
  if (![x0, y0, x1, y1].every(isInt) || x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 >= s.w || x1 >= s.w || y0 >= s.h || y1 >= s.h) return fail('harta');
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (n < 2 || n - 1 > TUNNEL.max || (dx && dy && Math.abs(x1 - x0) !== Math.abs(y1 - y0))) return fail('drum');
  const path = [];
  for (let k = 0; k <= n; k++) path.push([x0 + dx * k, y0 + dy * k]);
  const idx = path.map((p) => p[1] * s.w + p[0]);
  if (s.height[idx[0]] !== s.height[idx[n]] || s.height[idx[0]] <= WATER_H) return fail('panta');
  let hill = false, cost = 0;
  for (let k = 0; k <= n; k++) {
    const i = idx[k], t = s.track[i];
    if (s.water[i]) return fail('apa');
    if (s.occ[i]) return fail('cladire');
    if ((t & T_PRESENT) && ownerOf(t) !== c.id) return fail('proprietar');
    if (k > 0 && k < n) {
      if (t & T_PRESENT) return fail('drum');
      if (s.height[i] > s.height[idx[0]]) hill = true;
      cost += TUNNEL.cost;
    } else if (!(t & T_PRESENT)) cost += COST.tile;
    cost += COST.link;
  }
  if (!hill) return fail('teren'); // fără deal între capete nu e nevoie de tunel
  if (!s.sandbox && c.cash < cost) return fail('bani');
  if (!s.sandbox) c.cash -= cost;
  layPath(s, path, c, (k) => k > 0 && k < n);
  return { ok: true, cost };
}

export const TERRAIN_COMMANDS = { levelTerrain, clearArea, buildTunnel };
