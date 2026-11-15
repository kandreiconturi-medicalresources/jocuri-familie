// Marfă: ce acceptă o gară, livrare către orașe și industrii, încărcare, descărcare, venit.
import { STATION_RADIUS, LOW_PAY, STOCK_CAP } from './consts.js';
import { GOODS, CAR_TYPES, CAR_OF, INDUSTRIES, wantOf } from './goods.js';
import { near } from './industry.js';
import { addNews } from './news.js';

/** Distanță în linie dreaptă în plăci (aproximare întreagă a diagonalei). */
export function tileDist(a, b) {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + ((Math.min(dx, dy) * 3) >> 3);
}

const cityNear = (st, c) => Math.abs(c.x - st.x) <= STATION_RADIUS[st.size] + 2 && Math.abs(c.y - st.y) <= STATION_RADIUS[st.size] + 2;
export const stockOf = (st, g) => (g === 0 ? st.waiting.pass : g === 1 ? st.waiting.mail : st.cargo[g]);
const takeFrom = (st, g, n) => { if (g === 0) st.waiting.pass -= n; else if (g === 1) st.waiting.mail -= n; else st.cargo[g] -= n; };

/** Cine cere marfa g la gara st: orașe în rază (după nivel) sau industrii care o folosesc. Pasagerii și poșta se primesc oriunde. */
export function accepts(s, st, g) {
  if (g < 2) return true;
  return s.cities.some((c) => cityNear(st, c) && wantOf(c, g) > 0) || s.industries.some((o) => INDUSTRIES[o.type].in.includes(g) && near(st, o));
}

/** Predă marfa unui oraș sau unei industrii din raza gării. Întoarce true dacă a fost cerută. */
export function deliver(s, st, g, n) {
  if (g < 2) {
    const c = s.cities[st.cityId];
    if (c) c.got[g] += n;
    return true;
  }
  let c = null;
  for (const q of s.cities) if (cityNear(st, q) && wantOf(q, g) > 0 && (!c || tileDist(st, q) < tileDist(st, c))) c = q; // cel mai apropiat oraș care o vrea
  if (c) { c.got[g] += n; return true; }
  let best = null;
  for (const o of s.industries) if (INDUSTRIES[o.type].in.includes(g) && near(st, o) && (!best || o.in[g] < best.in[g])) best = o;
  if (best) { best.in[g] = Math.min(STOCK_CAP, best.in[g] + n); return true; }
  return false;
}

export function freeSpace(t, k) {
  let cap = 0;
  for (const c of t.kinds) if (c === k) cap += CAR_TYPES[k].cap;
  for (const b of t.load) if (CAR_OF[b.c] === k) cap -= b.n;
  return cap;
}
export const capacity = (t) => CAR_TYPES.map((c, k) => t.kinds.filter((x) => x === k).length * c.cap);
export const carried = (t, g) => t.load.reduce((n, b) => n + (b.c === g ? b.n : 0), 0);

function laterAccepts(s, t, st, g) {
  return t.route.some((id) => { const q = s.stations.find((r) => r.id === id); return q && q !== st && accepts(s, q, g); });
}

export function unload(s, t, st) {
  const co = s.companies[t.owner], ord = t.orders && t.orders[t.at];
  let earned = 0, dumped = 0;
  const keep = [];
  for (const b of t.load) {
    if (b.from === st.id) { keep.push(b); continue; }
    const want = accepts(s, st, b.c);
    if (ord && ord.unload && ord.unload.length ? !ord.unload.includes(b.c) : !want && laterAccepts(s, t, st, b.c)) { keep.push(b); continue; }
    const src = s.stations.find((q) => q.id === b.from);
    const dist = src ? Math.max(1, tileDist(src, st)) : 1;
    const elapsed = s.tick - b.t, ref = ((dist * 256) / 40) | 0;
    const ratio = ((elapsed * 100) / Math.max(1, ref)) | 0;
    const bonus = ratio <= 100 ? 150 : ratio <= 200 ? 125 : ratio <= 400 ? 100 : 70;
    const ok = deliver(s, st, b.c, b.n);
    if (ok) s.stats.del[b.c] += b.n;
    const pay = ((b.n * dist * GOODS[b.c].rate * bonus) / 100) | 0;
    earned += ok ? pay : ((pay * LOW_PAY) / 100) | 0;
    if (!ok) dumped = b.c;
  }
  t.load = keep;
  if (earned > 0) { if (t.owner === 0) s.stats.earn += earned; co.cash += earned; t.money += earned; co.month += earned; }
  if (dumped && s.tick - t.noteT > 400) {
    t.noteT = s.tick;
    addNews(s, '🤷', `Nimeni de la ${st.name} nu cere ${GOODS[dumped].name.toLowerCase()}, așa că am primit doar ${earned} lei. Caută o fabrică sau un oraș care o vrea!`);
  }
  return earned;
}

/** Încarcă ce se poate duce: automat = ce cer gările următoare; manual = lista de la gara asta. */
export function load(s, t, st) {
  const ord = t.orders && t.orders[t.at], list = ord && ord.load ? ord.load : null;
  for (let g = 0; g < GOODS.length; g++) {
    const have = stockOf(st, g);
    if (have <= 0 || (list && !list.includes(g))) continue;
    if (!list && g > 1 && !laterAccepts(s, t, st, g)) continue;
    const n = Math.min(have, freeSpace(t, CAR_OF[g]));
    if (n > 0) { takeFrom(st, g, n); t.load.push({ c: g, n, from: st.id, t: s.tick }); }
  }
}
