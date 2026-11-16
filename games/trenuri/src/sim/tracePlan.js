// Din plăcile urmei la un plan de construcție: apă → pod, pantă → nivelare, deal scurt → tunel, pădure → defrișare,
// oraș / industrie / șina altcuiva → ocolire locală (A* într-o fereastră mică). Numai întregi, fără DOM.
import { MAX_STEP, MAX_BRIDGE, WATER_H, COST, TUNNEL, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';
import { planTrack, pathCost } from './plan.js';
import { fitLevels, levelVolume, levelCostOf } from './terraform.js';
import { line } from './trace.js';

/** Felul fiecărei plăci din plan (culoarea și iconița din previzualizare). */
export const K = { OK: 0, BRIDGE: 1, LEVEL: 2, TUNNEL: 3, CLEAR: 4, DETOUR: 5, BAD: 6 };
export const K_ICON = { 1: '🌉', 2: '⛏️', 3: '🕳️', 4: '🌲', 5: '↪️', 6: '⛔' };
export const K_NAME = { 1: 'Pod', 2: 'Nivelare', 3: 'Tunel', 4: 'Defrișare', 5: 'Ocolire', 6: 'Nu se poate' };
const RANK = [0, 4, 3, 5, 1, 2, 9]; // prioritate la suprapunere: mai mare câștigă

const fail = (err, tiles = [], kind = []) => ({ ok: false, err, tiles, kind, segs: [], cmds: [], cost: 0, parts: { rail: 0, bridge: 0, clear: 0, level: 0, tunnel: 0 }, runs: [], bad: [] });

/** `cache` ține ocolirile deja calculate (cheie după capete), ca să nu repeți A* la fiecare cadru; se golește după orice construcție. */
export function planTrace(s, tiles, by = 0, cache = {}) {
  const w = s.w, I = (q) => q[1] * w + q[0], det = cache.det || (cache.det = new Map());
  const own = (i) => { const t = s.track[i]; return !(t & T_PRESENT) || ((t & T_OWNER_MASK) >> T_OWNER_SHIFT) === by; };
  const blockedAt = (i) => s.occ[i] || !own(i), bad = (q) => s.water[I(q)] || blockedAt(I(q));
  let a0 = 0, b0 = tiles.length;
  while (a0 < b0 && bad(tiles[a0])) a0++; // capetele nu pot fi pe apă sau pe clădire
  while (b0 > a0 && bad(tiles[b0 - 1])) b0--;
  const t = tiles.slice(a0, b0);
  if (t.length < 2) return fail('drum', t);

  // plăci „blocate” (clădiri, șina altcuiva) și apă mai lungă decât un pod
  const blk = t.map((q) => !!blockedAt(I(q)));
  for (let k = 0, r0 = -1; k <= t.length; k++) {
    const wet = k < t.length && s.water[I(t[k])] === 1;
    if (wet && r0 < 0) r0 = k;
    if (!wet && r0 >= 0) { if (k - r0 > MAX_BRIDGE) for (let q = r0; q < k; q++) blk[q] = true; r0 = -1; }
  }

  // 1. ocolirile
  const out = [], kd = [];
  let err = '';
  for (let k = 0; k < t.length; k++) {
    if (!blk[k]) { out.push(t[k]); kd.push(K.OK); continue; }
    let b = k;
    while (b + 1 < t.length && (blk[b + 1] || s.water[I(t[b + 1])])) b++;
    while (out.length > 1 && s.water[I(out[out.length - 1])]) { out.pop(); kd.pop(); }
    b = Math.min(b, t.length - 2);
    const p = out[out.length - 1], q = t[b + 1], key = p + '>' + q + '>' + (b - k);
    let d = det.get(key);
    if (d === undefined) {
      const m = 4 + Math.min(10, b - k), win = [Math.max(0, Math.min(p[0], q[0]) - m), Math.max(0, Math.min(p[1], q[1]) - m), Math.min(w - 1, Math.max(p[0], q[0]) + m), Math.min(s.h - 1, Math.max(p[1], q[1]) + m)];
      const r = planTrack(s, p, q, by, { win });
      det.set(key, d = r ? r.path.slice(1, -1) : null);
      if (det.size > 200) det.delete(det.keys().next().value);
    }
    if (d) for (const c of d) { out.push(c); kd.push(K.DETOUR); }
    else { err = 'ocolire'; for (let z = k; z <= b; z++) { out.push(t[z]); kd.push(K.BAD); } }
    k = b;
  }
  const n = out.length;
  if (n < 2) return fail('drum', out, kd);

  // 2. pantă: întâi tunel (linie dreaptă prin deal scurt), apoi nivelare
  const H = (q) => s.height[I(q)], wet = (q) => s.water[I(q)] === 1;
  const steep = (k) => k > 0 && !wet(out[k]) && !wet(out[k - 1]) && Math.abs(H(out[k]) - H(out[k - 1])) > MAX_STEP;
  const tun = [];
  let lastB = 0;
  for (let k = 1; k < n; k++) {
    if (!steep(k) || k <= lastB) continue;
    let best = null;
    for (let a = k - 1; a >= Math.max(lastB, k - 8); a--) for (let b = k; b <= Math.min(n - 1, a + 14); b++) {
      const A = out[a], B = out[b], dx = B[0] - A[0], dy = B[1] - A[1], len = Math.max(Math.abs(dx), Math.abs(dy));
      if (len < 2 || len > TUNNEL.max + 1 || (dx && dy && Math.abs(dx) !== Math.abs(dy)) || H(A) !== H(B) || H(A) <= WATER_H || wet(A) || wet(B)) continue;
      if (best && best.len <= len) continue;
      const mid = line(A, B).slice(0, -1);
      let hill = false, free = true;
      for (const m of mid) { const i = I(m); if (s.water[i] || s.occ[i] || (s.track[i] & T_PRESENT)) { free = false; break; } if (s.height[i] > H(A)) hill = true; }
      if (free && hill) best = { a, b, len };
    }
    if (best) { tun.push(best); lastB = best.b; }
  }
  const fin = [], fk = [], segs = [];
  let pos = 0, start = 0;
  for (const { a, b, len } of tun) {
    for (; pos <= a; pos++) { fin.push(out[pos]); fk.push(kd[pos]); }
    segs.push({ type: 'track', from: start, to: fin.length - 1 });
    const from = fin.length - 1;
    for (const m of line(out[a], out[b]).slice(0, -1)) { fin.push(m); fk.push(K.TUNNEL); }
    fin.push(out[b]); fk.push(kd[b]); pos = b + 1;
    segs.push({ type: 'tunnel', from, to: fin.length - 1, len });
    start = fin.length - 1;
  }
  for (; pos < n; pos++) { fin.push(out[pos]); fk.push(kd[pos]); }
  segs.push({ type: 'track', from: start, to: fin.length - 1 });

  // 3. nivelare + cost pe fiecare bucată de șină
  const parts = { rail: 0, bridge: 0, clear: 0, level: 0, tunnel: 0 }, badIdx = [];
  let trackTotal = 0, corr = 0;
  segs.forEach((sg, si) => {
    if (sg.type === 'tunnel') {
      const prev = segs[si - 1], next = segs[si + 1], A = fin[sg.from], B = fin[sg.to];
      let c = (sg.len - 1) * TUNNEL.cost + (sg.len + 1) * COST.link;
      if (prev.to - prev.from < 1 && !(s.track[I(A)] & T_PRESENT)) c += COST.tile;
      if (next.to - next.from < 1) { if (!(s.track[I(B)] & T_PRESENT)) c += COST.tile; } else if (s.forest[I(B)] && !(s.track[I(B)] & T_PRESENT)) corr += COST.forest;
      parts.tunnel += c;
      return;
    }
    if (sg.to - sg.from < 1) return;
    const path = fin.slice(sg.from, sg.to + 1), idx = path.map(I), list = fitLevels(s, idx);
    if (list.length > 400) { err = err || 'panta'; badIdx.push(sg.from); return; }
    sg.level = list; sg.path = path;
    const saved = list.map(([x, y]) => s.height[y * w + x]), vol = levelVolume(s, list);
    for (const [x, y, h] of list) s.height[y * w + x] = h;
    const r = pathCost(s, path, by);
    if (!r.ok) {
      err = err || r.err;
      for (let k = 1; k < path.length; k++) if (!pathCost(s, [path[k - 1], path[k]], by).ok) { badIdx.push(sg.from + k); break; }
    } else trackTotal += r.cost;
    list.forEach(([x, y], q) => { s.height[y * w + x] = saved[q]; });
    parts.level += levelCostOf(vol);
    for (const [x, y] of list) { const q = sg.from + path.findIndex((c) => c[0] === x && c[1] === y); if (RANK[K.LEVEL] > RANK[fk[q]]) fk[q] = K.LEVEL; }
  });
  for (let k = 0; k < fin.length; k++) {
    const i = I(fin[k]), present = s.track[i] & T_PRESENT;
    if (present || fk[k] === K.TUNNEL) continue;
    if (s.water[i]) { parts.bridge += COST.water; if (RANK[K.BRIDGE] > RANK[fk[k]]) fk[k] = K.BRIDGE; } else if (s.forest[i]) { parts.clear += COST.forest; if (fk[k] === K.OK) fk[k] = K.CLEAR; }
  }
  parts.clear = Math.max(0, parts.clear - corr);
  parts.rail = trackTotal - parts.bridge - parts.clear - corr;
  for (const q of badIdx) fk[q] = K.BAD;
  for (let k = 0; k < fin.length; k++) if (fk[k] === K.BAD && !err) err = 'drum';
  const cost = parts.rail + parts.bridge + parts.clear + parts.level + parts.tunnel;

  // 4. comenzi, în ordinea construcției
  const cmds = [];
  for (const sg of segs) {
    if (sg.type === 'tunnel') cmds.push({ type: 'buildTunnel', x0: fin[sg.from][0], y0: fin[sg.from][1], x1: fin[sg.to][0], y1: fin[sg.to][1] });
    else if (sg.path) cmds.push(sg.level.length ? { type: 'buildTrack', path: sg.path, level: sg.level } : { type: 'buildTrack', path: sg.path });
  }
  const runs = [];
  for (let k = 0; k < fin.length; k++) if (fk[k] && (!runs.length || runs[runs.length - 1].kind !== fk[k] || runs[runs.length - 1].b !== k - 1)) runs.push({ kind: fk[k], a: k, b: k }); else if (fk[k]) runs[runs.length - 1].b = k;
  return { ok: !err, err, tiles: fin, kind: fk, segs, cmds, cost, parts, runs, bad: badIdx, trimmed: a0 };
}
