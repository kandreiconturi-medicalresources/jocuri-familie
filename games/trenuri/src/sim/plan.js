// Costul unui traseu de șină și planificarea lui (A* pe grilă cu 8 direcții).
import { createHeap, KEY } from './heap.js';
import { DX, DY, LEN, COST, MAX_BRIDGE, MAX_STEP, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';

const ownerOf = (v) => (v & T_OWNER_MASK) >> T_OWNER_SHIFT;

/** Cost de a trece pe placa `i` venind din `p` (fără a verifica apa lungă). Întoarce -1 dacă e interzis. */
function tileCost(s, p, i, by) {
  if (s.occ[i]) return -1;
  const t = s.track[i];
  if ((t & T_PRESENT) && ownerOf(t) !== by) return -1;
  const wet = s.water[i] === 1;
  if (!wet && !s.water[p] && Math.abs(s.height[i] - s.height[p]) > MAX_STEP) return -1;
  if (t & T_PRESENT) return 0;
  if (wet) return COST.water;
  const dh = Math.abs(s.height[i] - s.height[p]);
  return COST.tile + dh * dh * COST.slope + (s.forest[i] ? COST.forest : 0);
}

/** Validează un traseu și îi calculează costul: { ok, err, cost }. */
export function pathCost(s, path, by) {
  if (!Array.isArray(path) || path.length < 2) return { ok: false, err: 'drum' };
  let cost = 0, run = 0;
  const w = s.w;
  for (let k = 0; k < path.length; k++) {
    const x = path[k][0], y = path[k][1];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w || y >= s.h) return { ok: false, err: 'harta' };
    const i = y * w + x;
    if (s.water[i]) { run++; if (run > MAX_BRIDGE || k === 0 || k === path.length - 1) return { ok: false, err: 'apa' }; } else run = 0;
    if (k === 0) { const c0 = tileCost(s, i, i, by); if (c0 < 0) return { ok: false, err: s.occ[i] ? 'cladire' : 'proprietar' }; cost += c0; continue; }
    const px = path[k - 1][0], py = path[k - 1][1];
    const dx = x - px, dy = y - py;
    if ((dx === 0 && dy === 0) || Math.abs(dx) > 1 || Math.abs(dy) > 1) return { ok: false, err: 'drum' };
    const c = tileCost(s, py * w + px, i, by);
    if (c < 0) return { ok: false, err: s.occ[i] ? 'cladire' : (s.track[i] & T_PRESENT) ? 'proprietar' : 'panta' };
    const d = DX.findIndex((v, q) => v === dx && DY[q] === dy);
    cost += c + (((s.track[py * w + px] >> d) & 1) ? 0 : COST.link);
  }
  return { ok: true, cost };
}

/** Cel mai ieftin traseu între două plăci: { path:[[x,y],...], cost } sau null. */
/** opts.reuse=false: nu trece peste șină existentă (linie dublă); opts.prefer: Set de plăci preferate (restul costă mai mult). */
export function planTrack(s, from, to, by = 0, opts = null) {
  const reuse = !opts || opts.reuse !== false, prefer = opts && opts.prefer;
  const w = s.w, h = s.h, n = w * h;
  if (!from || !to) return null;
  const a = from[1] * w + from[0], b = to[1] * w + to[0];
  if (a === b || a < 0 || b < 0 || a >= n || b >= n || s.water[a] || s.water[b] || s.occ[b] || s.occ[a]) return null;
  const g = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1);
  const heap = createHeap();
  const heur = (i) => { const dx = Math.abs((i % w) - to[0]), dy = Math.abs(((i / w) | 0) - to[1]); return (Math.max(dx, dy) + (Math.min(dx, dy) * 3 >> 3)) * 60; };
  g[a] = 0; heap.push(heur(a) * KEY + a);
  while (heap.size) {
    const cur = heap.pop() % KEY;
    if (cur === b) break;
    const cx = cur % w, cy = (cur / w) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!reuse && ni !== b && (s.track[ni] & T_PRESENT)) continue;
      let tc = tileCost(s, cur, ni, by);
      if (tc < 0) continue;
      if (prefer && ni !== b && !prefer.has(ni)) tc += COST.tile * 4;
      const ng = g[cur] + (((tc + COST.link) * LEN[d]) >> 8) + 1;
      if (g[ni] >= 0 && g[ni] <= ng) continue;
      g[ni] = ng; prev[ni] = cur;
      heap.push((ng + heur(ni)) * KEY + ni);
    }
  }
  if (g[b] < 0) return null;
  const path = [];
  for (let c = b; c !== -1; c = prev[c]) path.push([c % w, (c / w) | 0]);
  path.reverse();
  const r = pathCost(s, path, by);
  return r.ok ? { path, cost: r.cost } : null;
}
