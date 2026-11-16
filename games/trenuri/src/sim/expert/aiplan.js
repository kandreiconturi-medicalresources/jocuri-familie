// Concurenții AI: ce legături merită construite (orașe și industrii) și unde se pun gările. Funcții pure, fără efecte.
import { WATER_H, STATION_RADIUS, T_PRESENT, PROD } from '../consts.js';
import { GOODS, INDUSTRIES, cityGoods } from '../goods.js';
import { tileDist } from '../cargo.js';
import { near } from '../industry.js';

/** Insule: AI-ul construiește doar pe insula lui. */
const onOwn = (s, co, o) => { const k = s.isl[o.y * s.w + o.x] - 1; return k >= 0 && s.islands[k].owner === co.id; };
export const nodeKey = (a, b) => (a.k < b.k ? a.k + '|' + b.k : b.k + '|' + a.k);
const cityNode = (c) => ({ k: 'c' + c.id, o: c, city: true });
const indNode = (o) => ({ k: 'i' + o.id, o });

/** Legături posibile, de la cea mai bună: { a, b, good, score }. score ≈ venit lunar estimat × 100 / cost estimat. */
export function candidates(s, co, L) {
  const done = new Set([...co.ai.done, ...co.ai.bad]), out = [];
  const add = (a, b, good, income) => {
    const d = tileDist(a.o, b.o);
    if (d < 7 || d > L.maxD || done.has(nodeKey(a, b)) || (s.islands && (!onOwn(s, co, a.o) || !onOwn(s, co, b.o)))) return;
    out.push({ a, b, good, d, score: ((income(d) * 100) / (d * 130 + 7000)) | 0 });
  };
  const cs = s.cities.map(cityNode);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const pop = cs[i].o.pop + cs[j].o.pop;
    add(cs[i], cs[j], -1, (d) => pop * d);
  }
  for (const o of s.industries) {
    const g = INDUSTRIES[o.type].out;
    if (g < 0) continue;
    const inc = (d) => PROD * GOODS[g].rate * d * 5;
    for (const q of s.industries) if (INDUSTRIES[q.type].in.includes(g)) add(indNode(o), indNode(q), g, inc);
    for (const c of s.cities) if (cityGoods(c).includes(g)) add(indNode(o), cityNode(c), g, inc);
  }
  return out.sort((x, y) => y.score - x.score || (x.a.k < y.a.k ? -1 : x.a.k > y.a.k ? 1 : 0) || (x.b.k < y.b.k ? -1 : 1));
}

/** O gară deja a companiei care acoperă nodul (ca să nu mai punem alta). */
export function ownStation(s, co, n) {
  if (n.port) return n.o.owner === co.id ? n.o : null; // 7.5: portul e chiar gara de capăt
  return s.stations.find((st) => st.owner === co.id && (n.city
    ? Math.max(Math.abs(n.o.x - st.x), Math.abs(n.o.y - st.y)) <= STATION_RADIUS[st.size] + 2
    : near(st, n.o))) || null;
}

/** Placa liberă din jurul nodului, cea mai apropiată de celălalt capăt (fără clădiri, apă, drum, șină sau gară). */
export function spotFor(s, n, other) {
  const r = n.city ? 2 : 1;
  let best = null, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = n.o.x + dx, y = n.o.y + dy;
    if (x < 1 || y < 1 || x >= s.w - 1 || y >= s.h - 1) continue;
    const i = y * s.w + x;
    if (s.occ[i] || s.water[i] || s.height[i] <= WATER_H || s.roads[i] || s.stm[i] || (s.track[i] & T_PRESENT)) continue;
    const d = Math.abs(x - other.o.x) + Math.abs(y - other.o.y);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
