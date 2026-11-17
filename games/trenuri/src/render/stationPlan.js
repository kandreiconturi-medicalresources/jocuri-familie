// Planul în lume al unei gări normale: axa, partea clădirii, întinderea peronului pe plăcile drepte vecine (ca un tren întreg să stea la peron),
// câte linii suplimentare încap fără să calce pe alte șine, drumuri, case sau apă, și plăcile rezervate (copacii se scot de pe ele).
import { DX, DY, T_PRESENT, T_BRIDGE, T_BIGBR } from '../sim/consts.js';

export const STEP = 0.5; // distanța dintre liniile gării
export const RUN_MAX = 4; // câte plăci drepte se alipesc peronului de fiecare parte
const SAMPLE = 0.3;
const cache = new Map();

const first = (t) => { for (let d = 0; d < 8; d++) if ((t >> d) & 1) return d; return 0; };
export const platformsOf = (st) => Math.max(1, Math.min(4, st.platforms | 0 || 1));

function key(s, st) {
  let h = 7;
  for (let y = st.y - 7; y <= st.y + 7; y++) for (let x = st.x - 7; x <= st.x + 7; x++) {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) { h = (h * 31 + 1) >>> 0; continue; }
    const i = y * s.w + x;
    h = (Math.imul(h, 31) + s.track[i] + (s.roads[i] ? 70001 : 0) + (s.occ[i] ? 130003 : 0) + (s.water[i] ? 190007 : 0) + s.height[i] * 257) >>> 0;
  }
  return st.id + ':' + st.x + ',' + st.y + ',' + st.size + ',' + platformsOf(st) + ',' + h;
}

/** { ax, az, bx, bz (b spre clădire), ox, oz, uN, uP (peronul clădirii, u de-a lungul axei), eN, eP (liniile suplimentare), lanes, tiles, compact, pieces: [{ i, x, y }] (plăcile peronului, i = indexul față de gară), l }. */
export function planOf(s, st) {
  const k = key(s, st);
  let P = cache.get(k);
  if (P) return P;
  P = compute(s, st);
  cache.set(k, P);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return P;
}

function compute(s, st) {
  const i0 = st.y * s.w + st.x, d0 = first(s.track[i0]), l = Math.hypot(DX[d0], DY[d0]), ax = DX[d0] / l, az = DY[d0] / l, h0 = s.height[i0];
  const stationAt = new Set(s.stations.map((q) => q.y * s.w + q.x)), runSet = new Set([i0]);
  const inb = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  const run = (d) => { // plăci drepte alăturate, cu cel mult o treaptă de înălțime între vecine
    const out = []; let hp = h0;
    for (let q = 1; q <= RUN_MAX; q++) {
      const x = st.x + DX[d] * q, y = st.y + DY[d] * q;
      if (!inb(x, y)) break;
      const j = y * s.w + x, t = s.track[j];
      if (!(t & T_PRESENT) || (t & (T_BRIDGE | T_BIGBR)) || (t & 0xff) !== ((1 << d) | (1 << ((d + 4) & 7))) || stationAt.has(j) || Math.abs(s.height[j] - hp) > 1 || Math.abs(s.height[j] - h0) > 2 || s.water[j] || s.roads[j]) break;
      runSet.add(j); out.push({ i: q, x, y }); hp = s.height[j];
    }
    return out;
  };
  const fw = run(d0), bk = run((d0 + 4) & 7), uP = (fw.length + 0.5) * l, uN = -(bk.length + 0.5) * l;
  const pieces = [{ i: 0, x: st.x, y: st.y }, ...fw, ...bk.map((p) => ({ ...p, i: -p.i }))];
  const ox = st.x + 0.5, oz = st.y + 0.5, b0x = -az, b0z = ax, n = platformsOf(st), tiles = [];
  const free = (x, y, lo = -2, hi = 0) => { // plăcuță liberă: fără șină, drum, clădire, apă, aceeași înălțime (plăcile peronului nu contează)
    if (!inb(x, y)) return false;
    const j = y * s.w + x;
    return runSet.has(j) || (!s.water[j] && !s.roads[j] && !s.occ[j] && !(s.track[j] & T_PRESENT) && s.height[j] - h0 >= lo && s.height[j] - h0 <= hi);
  };
  const ok = (sd, u, v, lo, hi) => free(Math.floor(ox + ax * u + sd * b0x * v), Math.floor(oz + az * u + sd * b0z * v), lo, hi);
  /** Linii suplimentare pe partea sd (opusă clădirii): { lanes, eN, eP } cu întinderea comună liberă în jurul lui u = 0. */
  const lanesOn = (sd) => {
    let eN = uN, eP = uP, lanes = 1;
    for (let q = 1; q < n; q++) {
      const vs = []; for (let v = 0.55; v < q * STEP + 0.2; v += SAMPLE) vs.push(v); vs.push(q * STEP + 0.2);
      const clear = (u) => vs.every((v) => ok(sd, u, v));
      if (!clear(0)) break;
      let a = 0, b = 0;
      while (a - SAMPLE >= uN && clear(a - SAMPLE)) a -= SAMPLE;
      while (b + SAMPLE <= uP && clear(b + SAMPLE)) b += SAMPLE;
      const nN = Math.max(eN, a), nP = Math.min(eP, b);
      if (nP - nN < 1.6) break;
      eN = nN; eP = nP; lanes = q + 1;
    }
    return { lanes, eN, eP };
  };
  let best = null;
  for (const sd of [1, -1]) { // partea clădirii: liberă în rândul vecin; liniile suplimentare pe partea opusă
    const blk = [-0.4, 0, 0.4].filter((u) => !ok(sd, u, 0.62, -3, 1)).length, L = lanesOn(-sd);
    const cost = blk * 4 + (n - L.lanes);
    if (!best || cost < best.cost) best = { cost, sd, blk, L };
  }
  const sd = best.sd, bx = sd * b0x, bz = sd * b0z, L = best.L;
  for (const j of runSet) tiles.push(j);
  const mark = (u, v) => { const x = Math.floor(ox + ax * u - sd * b0x * v), y = Math.floor(oz + az * u - sd * b0z * v); if (inb(x, y)) tiles.push(y * s.w + x); };
  for (let q = 1; q < L.lanes; q++) for (let u = L.eN; u <= L.eP; u += SAMPLE) for (let v = 0.55; v < q * STEP + 0.2; v += SAMPLE) mark(u, v);
  if (!best.blk) for (const u of [-0.4, 0, 0.4]) { const x = Math.floor(ox + ax * u + bx * 0.62), y = Math.floor(oz + az * u + bz * 0.62); if (inb(x, y)) tiles.push(y * s.w + x); }
  const bridge = L.lanes > 1 ? bridgeU(L.eN, L.eP, uN, uP) : null;
  return { d: d0, ax, az, bx, bz, ox, oz, uN, uP, eN: L.eN, eP: L.eP, lanes: L.lanes, tiles, compact: best.blk > 0, bridge, pieces, l, yaw: Math.atan2(-bz, bx) };
}

/** Unde trece pasarela peste linii: lângă clădire dar nu peste ea, în întinderea comună; null dacă nu încape. */
function bridgeU(eN, eP, uN, uP) {
  for (const u of [0.95, -0.95, 0.75, -0.75]) if (u > eN + 0.3 && u < eP - 0.3 && u > uN + 0.3 && u < uP - 0.3) return u;
  return null;
}

/** Plăcile rezervate de gări (copacii și decorul de iarbă nu se pun pe ele). */
export function reservedTiles(s) {
  const out = new Set();
  out.sig = 0; // semnătură: se schimbă când se schimbă plăcile rezervate
  for (const st of s.stations) if (!st.big && !st.port && s.track[st.y * s.w + st.x] & T_PRESENT) for (const j of planOf(s, st).tiles) if (!out.has(j)) { out.add(j); out.sig = (out.sig * 31 + j) >>> 0; }
  return out;
}
