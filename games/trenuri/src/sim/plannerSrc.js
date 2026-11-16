// Planificatorul de rută, partea 1 (pură, numai întregi): ce cere un oraș, cât produce o industrie, există șină între două locuri,
// unde se pune o gară și cum se trage șina între două capete (A* + pod/nivelare/tunel din tracePlan). Fără DOM.
import { DX, DY, STATION_RADIUS, STATION_COST, PROD, WATER_H, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';
import { CITY_GOODS, INDUSTRIES, wantOf } from './goods.js';
import { tileDist } from './cargo.js';
import { near } from './industry.js';
import { planTrack } from './plan.js';
import { planTrace } from './tracePlan.js';
import { line } from './trace.js';

export const isCity = (o) => o.type === undefined;
const ownerOf = (t) => (t & T_OWNER_MASK) >> T_OWNER_SHIFT;

/** Ce cere un oraș: [{ g, want, got, pct }] (doar mărfuri, fără pasageri și poștă). `got` = cât a primit luna asta sau cea trecută. */
export function cityRequests(s, c) {
  return CITY_GOODS[c.level].filter((g) => g >= 2).map((g) => {
    const want = wantOf(c, g), got = Math.max(c.got[g], c.prev ? c.prev[g] : 0);
    return { g, want, got, pct: Math.min(100, ((got * 100) / Math.max(1, want)) | 0) };
  });
}

/** Cât lipsește în total unui oraș (tone pe lună). */
export const cityLack = (s, c) => cityRequests(s, c).reduce((n, r) => n + Math.max(0, r.want - r.got), 0);

/** Tone pe lună pe care o poate da o industrie (primară: producția; prelucrătoare: cât are de prelucrat sau gata de dus, cel mult PROD). */
export function monthlyOutput(o) {
  const t = INDUSTRIES[o.type];
  if (t.out < 0) return 0;
  if (!t.in.length) return o.boost ? (PROD * 3) >> 1 : PROD;
  return Math.min(PROD, Math.min(...t.in.map((g) => o.in[g])) + o.out[t.out]); // ce are de prelucrat + ce a rămas gata de dus
}

/** Gara ta care deservește locul o (industrie sau oraș), cea mai apropiată de `toward`; altfel null. */
export function stationAtPlace(s, o, owner, toward) {
  const r = (st) => STATION_RADIUS[st.size] + 2;
  const ok = (st) => st.owner === owner && (isCity(o) ? Math.abs(o.x - st.x) <= r(st) && Math.abs(o.y - st.y) <= r(st) : near(st, o));
  let best = null;
  for (const st of s.stations) if (ok(st) && (!best || tileDist(st, toward) < tileDist(best, toward))) best = st;
  return best;
}

/** Mărimea potrivită a gării noi: haltă la industrii și sate, gară în orașe. */
export const sizeFor = (o) => (isCity(o) && o.level >= 1 ? 1 : 0);

/** Plăcile legate prin șina ta între a și b (liste [x,y]), sau null dacă nu există drum pe șină. BFS pe biții de conexiune. */
export function railLink(s, a, b, owner) {
  const w = s.w, A = a.y * w + a.x, B = b.y * w + b.x, own = (i) => (s.track[i] & T_PRESENT) && ownerOf(s.track[i]) === owner;
  if (!own(A) || !own(B)) return null;
  const prev = new Int32Array(w * s.h).fill(-2);
  const q = [A];
  prev[A] = -1;
  for (let h = 0; h < q.length && prev[B] === -2; h++) {
    const i = q[h], x = i % w, y = (i / w) | 0;
    for (let d = 0; d < 8; d++) {
      if (!((s.track[i] >> d) & 1)) continue;
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= s.h) continue;
      const n = ny * w + nx;
      if (prev[n] !== -2 || !own(n)) continue;
      prev[n] = i; q.push(n);
    }
  }
  if (prev[B] === -2) return null;
  const out = [];
  for (let i = B; i !== -1; i = prev[i]) out.push([i % w, (i / w) | 0]);
  return out.reverse();
}

/** Locul unei gări noi lângă o: o placă liberă în rază, cât mai aproape de `toward` și de o; cu bonus dacă e deja șina ta acolo. */
export function spotFor(s, o, toward, size, owner) {
  const R = STATION_RADIUS[size] + (isCity(o) ? 1 : 0), w = s.w;
  let best = null, bs = 1e9;
  for (let y = Math.max(0, o.y - R); y <= Math.min(s.h - 1, o.y + R); y++) for (let x = Math.max(0, o.x - R); x <= Math.min(w - 1, o.x + R); x++) {
    const i = y * w + x, t = s.track[i];
    if (s.occ[i] || s.water[i] || s.height[i] <= WATER_H || s.stm[i]) continue;
    if ((t & T_PRESENT) && ownerOf(t) !== owner) continue;
    const sc = tileDist({ x, y }, toward) * 4 + tileDist({ x, y }, o) * 3 + (s.forest[i] ? 2 : 0) - ((t & T_PRESENT) ? 30 : 0);
    if (sc < bs) { bs = sc; best = { x, y }; }
  }
  return best;
}

/** Șina nouă între două plăci: întâi A* simplu, apoi A* cu nivelare, apoi linie dreaptă (tunel). Întoarce planTrace + lungimea sau null. */
export function planLeg(s, a, b, owner, cache = {}) {
  const key = a.x + ',' + a.y + '>' + b.x + ',' + b.y;
  if (cache[key] !== undefined) return cache[key];
  const from = [a.x, a.y], to = [b.x, b.y], tries = [];
  const r1 = planTrack(s, from, to, owner);
  if (r1) tries.push(r1.path);
  else { const r2 = planTrack(s, from, to, owner, { level: true }); if (r2) tries.push(r2.path); }
  tries.push([from, ...line(from, to)]);
  let out = null;
  for (const tiles of tries) {
    const p = planTrace(s, tiles, owner, {});
    if (p.ok && (p.trimmed || 0) === 0) { out = { plan: p, len: p.tiles.length - 1, cost: p.cost }; break; }
  }
  if (!out) { const p = planTrace(s, tries[tries.length - 1], owner, {}); out = { plan: p, len: Math.max(1, tileDist(a, b)), cost: p.cost, err: p.err || 'drum' }; }
  cache[key] = out;
  return out;
}

export const stationCost = (size) => STATION_COST[size];
