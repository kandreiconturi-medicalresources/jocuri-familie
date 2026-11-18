// Planul liniilor independente ale gării mari de trecere (vezi laneGeo.js): pentru fiecare linie k ≥ 1 și fiecare latură,
// șina dreaptă de la peronul P_k prin corpul gării până la macazul ei din evantai. Corpul gării se verifică în thru.js;
// aici se verifică plăcile dintre corp și macaz (case de mutat, nivelare treptată, apă, șina altuia). Numai întregi.
import { WATER_H, T_PRESENT, T_OWNER_SHIFT } from './consts.js';
import { FAN_AT, halfLen, innerPath } from './laneGeo.js';

/** { inner: [căi de pus], houses: [indici], flv: [[i, h]], vol, sides, lanesOk }.
 * `fr` = rezultatul lui fanPaths; `opt` = { house(i), center: Set, levelMax, skip: Set (plăci deja nivelate) }. */
export function innerPlan(s, x, y, dir, n, by, h0, fr, opt) {
  const w = s.w, A = halfLen(n), lv = new Map(fr.levels), top = { '-1': -1, 1: -1 }; // cel mai înalt rând atins de scara de macaze, pe fiecare latură
  for (const [e, r] of fr.keys) top[e] = Math.max(top[e], r);
  const dep = new Set(s.depots.map((d) => d.y * w + d.x)), inner = [], houses = [], flv = [];
  let vol = 0, sides = 0, lanesOk = true;
  for (let k = 1; k < n; k++) {
    let any = false;
    for (const e of [-1, 1]) {
      const full = innerPath(x, y, dir, k, e, FAN_AT + k), body = full.slice(0, A + 1);
      const side = top[e] >= k ? sideOf(full) : null; // macazul liniei k există (cu capătul ei sau doar ca trecere spre liniile de mai sus)
      if (side) { any = true; sides++; houses.push(...side.houses); flv.push(...side.flv); vol += side.vol; inner.push(full); } else inner.push(body);
    }
    if (!any) lanesOk = false;
  }
  return { inner, houses, flv, vol, sides, lanesOk };

  /** Plăcile a = A+1 .. FAN_AT+k-1 ale unei laturi; null dacă nu merge. Înălțimea urcă/coboară treptat de la gară (h0) la macaz. */
  function sideOf(full) {
    const sw = full[full.length - 1], si = sw[1] * w + sw[0], hs = lv.has(si) ? lv.get(si) : s.height[si];
    const out = { houses: [], flv: [], vol: 0 };
    for (let a = A + 1; a < full.length - 1; a++) {
      const [tx, ty] = full[a];
      if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) return null;
      const i = ty * w + tx, t = s.track[i], hh = s.height[i], d = a - A, want = h0 + Math.max(-d, Math.min(d, hs - h0));
      if (s.water[i] || hh <= WATER_H || s.stm[i] || dep.has(i) || opt.center.has(i)) return null;
      if (t & T_PRESENT) { if (((t >> T_OWNER_SHIFT) & 7) !== by) return null; continue; } // șina ta (de la o gară mai mică) rămâne
      if (s.occ[i]) { if (!opt.house(i)) return null; out.houses.push(i); }
      if (Math.abs(hh - want) > opt.levelMax) return null;
      if (hh !== want && !opt.skip.has(i) && !lv.has(i)) { out.flv.push([i, want]); out.vol += Math.abs(hh - want); }
    }
    return out;
  }
}
