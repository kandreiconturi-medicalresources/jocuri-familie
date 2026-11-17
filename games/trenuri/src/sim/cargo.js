// Marfă: ce acceptă o gară, livrare către orașe și industrii, încărcare, descărcare, venit.
import { STATION_RADIUS, LOW_PAY, STOCK_CAP } from './consts.js';
import { GOODS, CAR_TYPES, CAR_OF, INDUSTRIES, wantOf } from './goods.js';
import { near } from './industry.js';
import { addNews } from './news.js';
import { recordIncome } from './expert/report.js';
import { dropAmount } from './drops.js';
import { portCap, exportBonus } from './ports.js';

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
  if (g < 2 || st.port) return true; // portul ia orice marfă în depozit
  return s.cities.some((c) => cityNear(st, c) && wantOf(c, g) > 0) || s.industries.some((o) => INDUSTRIES[o.type].in.includes(g) && near(st, o));
}

/** Cine ia marfa g la gara st: cel mai apropiat oraș care o vrea, altfel industria cu stocul cel mai mic. */
function targetOf(s, st, g) {
  let c = null;
  for (const q of s.cities) if (cityNear(st, q) && wantOf(q, g) > 0 && (!c || tileDist(st, q) < tileDist(st, c))) c = q;
  if (c) return { c };
  let best = null;
  for (const o of s.industries) if (INDUSTRIES[o.type].in.includes(g) && near(st, o) && (!best || o.in[g] < best.in[g])) best = o;
  return best ? { o: best } : null;
}

/** Cât mai cere gara st din marfa g luna asta (orașul: cererea minus ce a primit; industria: loc în stoc; pasageri și poștă: oricât). */
export function roomAt(s, st, g) {
  if (g < 2) return 1e9;
  if (st.port) return Math.max(0, portCap(st) - st.cargo[g]);
  const t = targetOf(s, st, g);
  return !t ? 0 : t.c ? Math.max(0, wantOf(t.c, g) - t.c.got[g]) : Math.max(0, STOCK_CAP - t.o.in[g]);
}

/** Predă marfa unui oraș sau unei industrii din raza gării. Întoarce true dacă a fost cerută. */
export function deliver(s, st, g, n) {
  if (g < 2) {
    const c = s.cities[st.cityId];
    if (c) c.got[g] += n;
    return true;
  }
  if (st.port) { st.cargo[g] = Math.min(portCap(st), st.cargo[g] + n); return true; } // depozitul portului
  const t = targetOf(s, st, g);
  if (!t) return false;
  if (t.c) t.c.got[g] += n; else t.o.in[g] = Math.min(STOCK_CAP, t.o.in[g] + n);
  return true;
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

/** Cât se descarcă din blocul b la gara st: regula veche (tot sau nimic) sau, cu ordine „drop”, descărcarea parțială. */
function amountOf(s, t, st, ord, b, left) {
  if (b.from === st.id) return 0;
  if (!ord || !ord.drop) {
    const keep = ord && ord.unload && ord.unload.length ? !ord.unload.includes(b.c) : !accepts(s, st, b.c) && laterAccepts(s, t, st, b.c);
    return keep ? 0 : b.n;
  }
  if (ord.unload && ord.unload.length && !ord.unload.includes(b.c)) return 0;
  const cap = CAR_TYPES[CAR_OF[b.c]].cap;
  const k = dropAmount(ord.drop, b.n, { room: roomAt(s, st, b.c), later: laterAccepts(s, t, st, b.c), cap });
  if (ord.drop.m !== 'cars') return k;
  if (left[b.c] === undefined) left[b.c] = ord.drop.v * cap; // vagoanele cerute se împart între blocurile aceleiași mărfi
  const q = Math.min(k, left[b.c]); left[b.c] -= q;
  return q;
}

export function unload(s, t, st) {
  const co = s.companies[t.owner], ord = t.orders && t.orders[t.at], left = {};
  let earned = 0, dumped = 0;
  const keep = [];
  for (const b of t.load) {
    const k = amountOf(s, t, st, ord, b, left);
    if (k <= 0) { keep.push(b); continue; }
    if (k < b.n) keep.push({ ...b, n: b.n - k });
    const src = s.stations.find((q) => q.id === b.from);
    const dist = src ? Math.max(1, tileDist(src, st)) : 1;
    const elapsed = s.tick - b.t, ref = ((dist * 256) / 40) | 0;
    const ratio = ((elapsed * 100) / Math.max(1, ref)) | 0;
    const bonus = ratio <= 100 ? 150 : ratio <= 200 ? 125 : ratio <= 400 ? 100 : 70;
    const ok = deliver(s, st, b.c, k);
    if (ok) s.stats.del[b.c] += k;
    const pay = ((k * dist * GOODS[b.c].rate * bonus) / 100) | 0;
    const v = (ok ? pay : ((pay * LOW_PAY) / 100) | 0) + (st.port ? exportBonus(s, st, b, k) : 0);
    earned += v;
    if (co.rep) recordIncome(co, t, b.c, v);
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
