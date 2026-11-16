// Porturi (etapa 7.2): o gară specială pe coastă (în `s.stations`, deci trenurile o pun în rută ca pe orice gară),
// cu depozit = `st.cargo` (capacitate mai mare) și o placă de apă pentru vapoare (`st.dock`).
import { PORT, WATER_H, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, UPGRADES } from './consts.js';
import { NG } from './goods.js';
import { islandAt, islandGoods } from './islands.js';
import { priceOf } from './market.js';
import { syncAuto } from './signals.js';
import { addNews } from './news.js';

const fail = (err) => ({ ok: false, err });
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Câte tone încap în depozitul portului din fiecare marfă (crește cu peroanele: upgradeStation). */
export const portCap = (st) => PORT.cap + PORT.capPer * ((st.platforms || 1) - 1);

/** Placa de apă de lângă (x, y) unde acostează vapoarele, -1 dacă nu e coastă. */
export function dockOf(s, x, y) {
  for (const [dx, dy] of D4) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && s.water[ny * s.w + nx]) return ny * s.w + nx;
  }
  return -1;
}

function nameOf(s, x, y) {
  const k = islandAt(s, x, y);
  let best = null, bd = 1e9;
  for (const c of s.cities) { const d = Math.abs(c.x - x) + Math.abs(c.y - y); if (islandAt(s, c.x, c.y) === k && d < bd) { bd = d; best = c; } }
  const base = best && bd <= 12 ? 'Portul ' + best.name : 'Portul ' + (k >= 0 ? s.islands[k].name.replace('Insula ', '') : s.stations.length + 1);
  return s.stations.some((q) => q.name === base) ? base + ' ' + (s.stations.filter((q) => q.port).length + 1) : base;
}

/** Creează portul (fără verificări de bani). `live` = în joc (semnale, ziar); false la crearea lumii. */
export function makePort(s, owner, x, y, dock, live) {
  const i = y * s.w + x;
  let near = -1, bd = 1e9;
  for (const c of s.cities) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < bd && d <= 4) { bd = d; near = c.id; } }
  const st = { id: s.nextId++, owner, x, y, size: 1, name: nameOf(s, x, y), cityId: near, dir: 0, platforms: 1, waiting: { pass: 0, mail: 0 }, rem: { pass: 0, mail: 0 }, cargo: new Array(NG).fill(0), up: UPGRADES.map(() => 0), port: 1, dock };
  s.track[i] = (s.track[i] & ~T_OWNER_MASK) | T_PRESENT | (owner << T_OWNER_SHIFT);
  s.forest[i] = 0;
  s.stations.push(st);
  if (s.stm) s.stm[i] = 1;
  if (live) {
    syncAuto(s);
    s.dirty.track = s.dirty.stations = s.dirty.forest = true;
    addNews(s, '⚓', `S-a deschis ${st.name}! Trenurile aduc marfa aici, iar vapoarele o duc peste mare.`);
  }
  return st;
}

/** buildPort { x, y }: pe o placă de uscat de pe insula ta, lângă apă. */
function buildPort(s, cmd, c) {
  if (!s.islands) return fail('insula');
  const { x, y } = cmd;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return fail('harta');
  const i = y * s.w + x, t = s.track[i];
  if (s.occ[i]) return fail('cladire');
  if (s.water[i] || s.height[i] <= WATER_H) return fail('teren');
  if ((t & T_PRESENT) && ((t & T_OWNER_MASK) >> T_OWNER_SHIFT) !== c.id) return fail('proprietar');
  if (s.stations.some((q) => q.x === x && q.y === y) || s.depots.some((d) => d.x === x && d.y === y)) return fail('teren');
  const dock = dockOf(s, x, y);
  if (dock < 0) return fail('port');
  if (!s.sandbox && c.cash < PORT.cost) return fail('bani');
  if (!s.sandbox) c.cash -= PORT.cost;
  const st = makePort(s, c.id, x, y, dock, true);
  return { ok: true, cost: PORT.cost, id: st.id };
}

/** Bonusul de export: marfa adusă cu trenul de pe insula ta în portul tău (k tone din blocul b). */
export function exportBonus(s, st, b, k) {
  const src = s.stations.find((q) => q.id === b.from), isl = islandAt(s, st.x, st.y);
  if (!src || src.port || isl < 0 || islandAt(s, src.x, src.y) !== isl || s.islands[isl].owner !== st.owner) return 0;
  return (k * priceOf(s, isl, b.c)) >> 2;
}

/** Loc de port pe insula k: placă de coastă liberă, cât mai aproape de primul oraș al insulei. */
export function coastSpot(s, k) {
  const q = s.islands[k], city = s.cities.find((c) => islandAt(s, c.x, c.y) === k);
  let best = null, bd = 1e9;
  for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) {
    const i = y * s.w + x;
    if (s.water[i] || s.occ[i] || s.roads[i] || (s.track[i] & T_PRESENT) || dockOf(s, x, y) < 0) continue;
    const d = city ? Math.abs(city.x - x) + Math.abs(city.y - y) : 0;
    if (d < bd && d >= 5) { bd = d; best = { x, y }; }
  }
  return best;
}

/** La crearea lumii: fiecare AI primește un port comercial (vapoarele jucătorilor pot cumpăra de acolo). */
export function foundAiPorts(s) {
  s.islands.forEach((q, k) => {
    const co = q.owner >= 0 ? s.companies[q.owner] : null;
    if (!co || !co.ai) return;
    const p = coastSpot(s, k);
    if (p) makePort(s, co.id, p.x, p.y, dockOf(s, p.x, p.y), false);
  });
}

/** Lunar: porturile AI primesc din producția insulei lor (ce se poate face acolo), până la capacitate. */
export function restockAi(s, amount) {
  for (const st of s.stations) {
    const co = st.port ? s.companies[st.owner] : null;
    if (!co || !co.ai || co.dead) continue;
    const can = islandGoods(s, islandAt(s, st.x, st.y));
    for (let g = 2; g < NG; g++) if (can[g]) st.cargo[g] = Math.min(portCap(st), st.cargo[g] + amount);
  }
}

export const PORT_COMMANDS = { buildPort };
