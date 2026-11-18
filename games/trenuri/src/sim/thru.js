// Gara mare de trecere (în oraș): 2–10 linii paralele lângă linia principală, cu peroane, hală, pasarelă și pasaj.
// Logic rămâne o gară pe o placă (rutele și rezervările nu se schimbă): peroane = linii, deci tot atâtea trenuri stau deodată.
// Ocupă un dreptunghi de-a lungul liniei (pe partea `dir`); casele din el se dărâmă cu despăgubire, drumurile se mută,
// iar pe rândul liniei principale casele dispar ca să încapă șina. Gara acoperă tot orașul ei (vezi catch.js).
import { WATER_H, T_PRESENT, T_OWNER_SHIFT, UPGRADES, STATION_COST, COST } from './consts.js';
import { levelCostOf, markTerrain, layPath } from './terraform.js';
import { fanPaths, sepReach } from './thruFan.js';
import { frameOf } from './terminal.js';
import { NG } from './goods.js';
import { addNews } from './news.js';
import { syncAuto } from './signals.js';
import { corTiles, markCor } from './corGeo.js';

export const THRU_MIN = 2, THRU_MAX = 10, THRU_BASE = 9000, THRU_TRACK = 2500, HOUSE_PAY = 350, TOWER_PAY = 700;
/** Jumătatea lungimii (în plăci) de-a lungul liniei: 7 plăci, 9 la peste 6 linii. */
export const halfLen = (n) => (n > 6 ? 4 : 3);
/** Linia k e la LANE10(k)/10 plăci de linia principală: peron insulă între perechi (0,6), spațiu îngust între perechi (0,4). */
export const lane10 = (k) => 6 * ((k + 1) >> 1) + 4 * (k >> 1);
/** Câte rânduri de plăci ocupă: liniile + peronul clădirii + clădirea (≈1,1 plăci după ultima linie). */
export const rowsOf = (n) => Math.ceil((lane10(n - 1) + 11 - 5) / 10);
const LEVEL_MAX = 4; // cât de denivelat poate fi terenul (se nivelează la construire)
const clampN = (n) => Math.max(THRU_MIN, Math.min(THRU_MAX, n | 0));
const fail = (err) => ({ ok: false, err });

/** Plăcile ocupate (rândurile 1..rows, de-a lungul -A..A), în ordine fixă. */
export function thruTiles(x, y, dir, n) {
  const f = frameOf(dir), A = halfLen(n), out = [];
  for (let c = 1; c <= rowsOf(n); c++) for (let a = -A; a <= A; a++) out.push([x + f.ax * a + f.cx * c, y + f.ay * a + f.cy * c]);
  return out;
}
/** Rândul liniei principale (fără placa gării): aici casele se dărâmă, ca să treacă șina. */
export function mainTiles(x, y, dir, n) {
  const f = frameOf(dir), A = halfLen(n), out = [];
  for (let a = -A; a <= A; a++) if (a) out.push([x + f.ax * a, y + f.ay * a]);
  return out;
}
const alongMask = (dir) => { const d = (dir + 2) & 7; return (1 << d) | (1 << ((d + 4) & 7)); };

export function houseAt(s, i) {
  for (const c of s.cities) for (let k = 0; k < c.buildings.length; k++) { const b = c.buildings[k]; if (b[1] * s.w + b[0] === i) return { c, b }; }
  return null;
}
export const payOf = (b) => (b[2] >= 8 ? TOWER_PAY : HOUSE_PAY);

/** Planul gării: { ok, err?, houses: [indici], pay, dir, n }. `st` = gara existentă (transformare sau linii în plus). */
export function thruPlan(s, x, y, dir, n, st = null, by = st ? st.owner : -1, cor = 0) {
  n = clampN(n);
  if (dir !== 0 && dir !== 2 && dir !== 4 && dir !== 6) return fail('teren');
  const w = s.w, i0 = y * w + x, h0 = s.height[i0], mask = alongMask(dir), houses = [];
  const own = new Set(st && st.thru ? thruTiles(st.x, st.y, st.dir, st.platforms).map(([a, b]) => b * w + a) : []);
  const center = new Set(s.cities.map((c) => c.y * w + c.x));
  const t0 = s.track[i0] & 0xff;
  if (t0 & ~mask) return fail('loc'); // linia prin gară trebuie să fie dreaptă, de-a lungul ei
  let pay = 0;
  const demolish = (i) => { const hb = houseAt(s, i); if (!hb) return false; houses.push(i); pay += payOf(hb.b); return true; };
  if (!st && s.occ[i0] && !demolish(i0)) return fail('cladire');
  const stAt = new Set(s.stations.map((q) => q.y * w + q.x)), dep = new Set(s.depots.map((d) => d.y * w + d.x));
  const lvl = []; // plăci de nivelat la înălțimea gării (teren denivelat: se plătește, nu se refuză)
  let vol = 0;
  const level = (i) => { const d = Math.abs(s.height[i] - h0); if (d > LEVEL_MAX) return false; if (d > 1) { lvl.push(i); vol += d; } return true; };
  for (const [tx, ty] of thruTiles(x, y, dir, n)) {
    if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) return fail('harta');
    const i = ty * w + tx;
    if (own.has(i)) continue;
    if (s.water[i] || s.height[i] <= WATER_H) return fail('teren');
    if ((s.track[i] & T_PRESENT) || stAt.has(i) || dep.has(i) || center.has(i)) return fail('loc');
    if (!level(i)) return fail('panta');
    if (s.occ[i] && !demolish(i)) return fail('loc'); // industrie sau curtea altei gări
  }
  const lay = [], A = halfLen(n), f = frameOf(dir); // linia principală dreaptă prin gară: o pune gara unde lipsește
  for (let a = -A; a <= A; a++) {
    const tx = x + f.ax * a, ty = y + f.ay * a;
    if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) return fail('harta');
    const i = ty * w + tx, t = s.track[i];
    lay.push([tx, ty]);
    if (!a) continue;
    if (s.water[i] && !(t & T_PRESENT)) return fail('teren');
    if ((t & 0xff & ~mask) || stAt.has(i) || dep.has(i) || center.has(i)) return fail('loc');
    if ((t & T_PRESENT) && by >= 0 && ((t >> T_OWNER_SHIFT) & 7) !== by) return fail('proprietar');
    if (!(t & T_PRESENT) && !level(i)) return fail('panta');
    if (s.occ[i] && !own.has(i) && !demolish(i)) return fail('loc');
  }
  for (const a of [-A - 1, A + 1]) { // se leagă de șina care continuă dincolo de capete
    const tx = x + f.ax * a, ty = y + f.ay * a;
    if (tx >= 0 && ty >= 0 && tx < w && ty < s.h && (s.track[ty * w + tx] & T_PRESENT)) a < 0 ? lay.unshift([tx, ty]) : lay.push([tx, ty]);
  }
  const fr = fanPaths(s, x, y, dir, A, rowsOf(n), by >= 0 ? by : (s.track[i0] >> T_OWNER_SHIFT) & 7, h0, { house: (i) => !!houseAt(s, i), center, levelMax: LEVEL_MAX, ...(cor ? { R: n - 1, reach: cor } : {}) }); // intrări separate la capete
  const fan = fr.paths, done = new Set(houses);
  for (const [tx, ty] of fan.flat()) { const i = ty * w + tx; if (s.occ[i] && !done.has(i)) { done.add(i); demolish(i); } } // casele din calea intrărilor se mută
  const flv = fr.levels.filter(([i]) => !lvl.includes(i)); // pe deal intrările urcă treptat: nivelare plătită
  for (const [i, hh] of flv) vol += Math.abs(s.height[i] - hh);
  const seen = new Set();
  for (const [tx, ty] of [...lay, ...fan.flat()]) { const i = ty * w + tx; if (!(s.track[i] & T_PRESENT)) seen.add(i); }
  return { ok: true, sep: cor, houses, pay, dir, n, lvl, flv, h0, levelCost: vol ? levelCostOf(vol) : 0, lay, fan, layCost: seen.size * COST.tile };
}

/** Prima direcție bună (cele mai puține case dărâmate), după linia care trece prin placă. null dacă nu încape. */
export function thruAuto(s, x, y, n, st = null, by = -1, cor = 0) {
  const t = s.track[y * s.w + x] & 0xff;
  let order = [0, 2, 4, 6];
  if (t & 0x11) order = [2, 6]; // linie N–S: gara la est sau vest
  else if (t & 0x44) order = [0, 4];
  else if (t) return null;
  let best = null, err = 'loc';
  for (const d of order) { const p = thruPlan(s, x, y, d, n, st, by, cor); if (!p.ok) { err = p.err; continue; } if (!best || thruCost(p, st) < thruCost(best, st)) best = p; }
  return best || fail(err);
}

/** Prețul total: gara + liniile + despăgubirile (la transformare se scade prețul gării vechi, la linii în plus doar diferența). */
export function thruCost(p, st = null) {
  const extra = (p.levelCost | 0) + (p.layCost | 0);
  if (st && st.thru) return (p.n - st.platforms) * THRU_TRACK + p.pay + extra;
  return THRU_BASE + p.n * THRU_TRACK + p.pay + extra - (st ? STATION_COST[st.size] >> 1 : 0);
}

/** Orașul gării: cel mai apropiat centru (≤ 8 plăci) sau -1. */
export function cityOf(s, x, y) {
  let best = -1, bd = 1e9;
  for (const c of s.cities) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < bd && d <= 8) { bd = d; best = c.id; } }
  return best;
}

/** Dărâmă casele, ocupă plăcile, șterge pădurea. */
export function claim(s, st, p) {
  const gone = new Set(p.houses);
  if (gone.size) for (const c of s.cities) { const n0 = c.buildings.length; c.buildings = c.buildings.filter((b) => !gone.has(b[1] * s.w + b[0])); if (c.buildings.length !== n0) s.dirty.cities = true; }
  for (const i of gone) s.occ[i] = 0;
  const all = [...(p.lvl || []).map((i) => [i, p.h0]), ...(p.flv || [])];
  if (all.length) {
    for (const [i, hh] of all) s.height[i] = hh;
    const xs = all.map(([i]) => i % s.w), ys = all.map(([i]) => (i / s.w) | 0);
    markTerrain(s, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }
  if (p.lay && p.lay.length > 1) layPath(s, p.lay, { id: st.owner });
  for (const q of p.fan || []) layPath(s, q, { id: st.owner });
  markOne(s, st);
  for (const [x, y] of thruTiles(st.x, st.y, st.dir, st.platforms)) s.forest[y * s.w + x] = 0;
  for (const [x, y] of mainTiles(st.x, st.y, st.dir, st.platforms)) if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.forest[y * s.w + x] = 0;
  if (st.cor) for (const [x, y] of corTiles(st.x, st.y, st.dir, st.platforms, st.cor)) if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.forest[y * s.w + x] = 0;
  s.dirty.forest = s.dirty.stations = s.dirty.track = true;
}
function markOne(s, st) {
  if (!s.keep) s.keep = new Uint8Array(s.w * s.h);
  for (const [x, y] of thruTiles(st.x, st.y, st.dir, st.platforms)) { const i = y * s.w + x; s.occ[i] = 1; s.roads[i] = 0; }
  for (const [x, y] of mainTiles(st.x, st.y, st.dir, st.platforms)) if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.keep[y * s.w + x] = 1;
  if (st.cor) markCor(s, st);
}
/** Strat derivat: plăcile gărilor de trecere sunt ocupate, rândul liniei principale e păstrat liber (orașul nu mai construiește acolo). */
export function markThru(s) {
  s.keep = new Uint8Array(s.w * s.h);
  for (const st of s.stations) if (st.thru) markOne(s, st);
}
export function freeThru(s, st) {
  for (const [x, y] of thruTiles(st.x, st.y, st.dir, st.platforms)) s.occ[y * s.w + x] = 0;
  markThru(s);
  s.dirty.forest = true;
}

export const spend = (s, c, amt) => { if (!s.sandbox && c.cash < amt) return false; if (!s.sandbox) c.cash -= amt; return true; };
const inMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.w && y < s.h;

/** Informații pentru previzualizare (fără să schimbe starea): { ok, err?, cost, houses, dir, n, st }.
 * `mode`: 'join' = intrare comună (scara de macaze veche); 'split' = desparte intrările unei gări existente; altfel gara nouă are intrări separate (câte o linie dreaptă pe linia gării). */
export function thruInfo(s, by, x, y, n, dir, mode = '') {
  if (!inMap(s, x, y)) return fail('harta');
  const i = y * s.w + x, st = s.stations.find((q) => q.y * s.w + q.x === i) || null;
  if (st && (st.owner !== by || st.big || st.port)) return fail(st.owner !== by ? 'proprietar' : 'teren');
  if (mode === 'split') { if (!st || !st.thru || st.sep || st.cor) return fail('exista'); n = st.platforms; }
  else if (st && st.thru && clampN(n) <= st.platforms) return fail('exista');
  const t = s.track[i];
  if (!st && (t & T_PRESENT) && ((t >> T_OWNER_SHIFT) & 7) !== by) return fail('proprietar');
  if (!st && (s.water[i] || s.height[i] <= WATER_H)) return fail('teren');
  const sep = mode === 'join' || (st && st.thru && !st.sep && mode !== 'split') ? 0 : sepReach(clampN(n));
  const p = st && st.thru ? thruPlan(s, x, y, st.dir, n, st, by, sep) : dir === undefined || dir < 0 ? thruAuto(s, x, y, n, st, by, sep) : thruPlan(s, x, y, dir | 0, n, st, by, sep);
  if (!p || !p.ok) return p || fail('loc');
  if (sep && p.fan.length < p.n) return fail('intrari'); // intrări separate: măcar atâtea capete câte linii
  return { ...p, cost: thruCost(p, st), st };
}

/** Cel mai bun loc din jurul plăcii atinse (rază 5): întâi placa însăși, apoi cel mai ieftin, cu preferință pentru aproape. */
export function thruNear(s, by, x, y, n, R = 5, mode = '') {
  const here = thruInfo(s, by, x, y, n, undefined, mode);
  let best = null, bs = Infinity;
  if (here.ok) { // placa atinsă are un mic avantaj, dar nu dacă în jur e un loc cu mai multe intrări
    const ci = cityOf(s, x, y), cd = ci >= 0 ? Math.max(Math.abs(s.cities[ci].x - x), Math.abs(s.cities[ci].y - y)) : 9;
    best = { ...here, x, y }; bs = here.cost + cd * 2500 + Math.max(0, 8 - here.fan.length) * 2500 - 1000;
  }
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const tx = x + dx, ty = y + dy;
    if ((!dx && !dy) || !inMap(s, tx, ty)) continue;
    const t = s.track[ty * s.w + tx];
    if ((t & 0xff) && !(t & 0x55)) continue; // pe diagonală nu se poate
    const r = thruInfo(s, by, tx, ty, n, undefined, mode);
    if (!r.ok) continue;
    const ci = cityOf(s, tx, ty), cd = ci >= 0 ? Math.max(Math.abs(s.cities[ci].x - tx), Math.abs(s.cities[ci].y - ty)) : 9;
    const score = r.cost + cd * 2500 + Math.max(Math.abs(dx), Math.abs(dy)) * 300 + (t & T_PRESENT ? 0 : 1500) + Math.max(0, 8 - (r.fan ? r.fan.length : 0)) * 2500; // cât mai în oraș, cu intrări la ambele capete
    if (score < bs) { bs = score; best = { ...r, x: tx, y: ty }; }
  }
  return best || here;
}

/** buildThru { x, y, n, dir? }: gară nouă de trecere sau transformarea gării tale normale de pe placă. */
function buildThru(s, cmd, c) {
  const r = thruInfo(s, c.id, cmd.x, cmd.y, cmd.n === undefined ? 4 : cmd.n, cmd.dir, cmd.join ? 'join' : '');
  if (!r.ok) return r;
  if (r.st && r.st.thru) return fail('exista');
  if (!spend(s, c, r.cost)) return fail('bani');
  const i = cmd.y * s.w + cmd.x;
  let st = r.st;
  if (!st) {
    st = { id: s.nextId++, owner: c.id, x: cmd.x, y: cmd.y, size: 2, name: '', cityId: -1, dir: 0, platforms: 1, waiting: { pass: 0, mail: 0 }, rem: { pass: 0, mail: 0 }, cargo: new Array(NG).fill(0), up: UPGRADES.map(() => 0) };
    s.stations.push(st);
    s.track[i] = s.track[i] | T_PRESENT | (c.id << T_OWNER_SHIFT);
    s.stm[i] = 1;
  }
  const cityId = st.cityId >= 0 ? st.cityId : cityOf(s, st.x, st.y), city = cityId >= 0 ? s.cities[cityId] : null;
  const same = city ? s.stations.filter((q) => q.thru && q.cityId === cityId).length : 0;
  if (r.sep) st.sep = r.sep;
  Object.assign(st, { thru: 1, dir: r.dir, platforms: r.n, size: 2, cityId, name: city ? `Gara Mare ${city.name}${same ? ' ' + (same + 1) : ''}` : `Gara Mare ${st.id}` });
  claim(s, st, r);
  syncAuto(s);
  addNews(s, '🏙️', `S-a deschis ${st.name}: ${r.n} linii${r.houses.length ? `, ${r.houses.length} case mutate (despăgubiri ${r.pay} lei)` : ''}!`);
  return { ok: true, cost: r.cost, id: st.id };
}

/** setThruTracks { id, n }: mai multe linii la gara de trecere (doar în sus). */
function setThruTracks(s, cmd, c) {
  const st = s.stations.find((q) => q.id === cmd.id);
  if (!st || !st.thru) return fail('inexistent');
  if (st.owner !== c.id) return fail('proprietar');
  if (st.cor) return fail('limita'); // culoarul are liniile alese la construire
  if ((cmd.n | 0) > THRU_MAX) return fail('limita');
  const r = thruInfo(s, c.id, st.x, st.y, cmd.n, st.dir);
  if (!r.ok) return r;
  if (!spend(s, c, r.cost)) return fail('bani');
  st.platforms = r.n; if (st.sep) st.sep = r.sep;
  claim(s, st, r);
  syncAuto(s);
  addNews(s, '🏙️', `${st.name} are acum ${st.platforms} linii!`);
  return { ok: true, cost: r.cost };
}

/** splitThru { id }: „Desparte intrările” — gara de trecere veche primește linii drepte separate în față (plătit: șină nouă, nivelare, case mutate). */
function splitThru(s, cmd, c) {
  const st = s.stations.find((q) => q.id === cmd.id);
  if (!st || !st.thru) return fail('inexistent');
  if (st.owner !== c.id) return fail('proprietar');
  const r = thruInfo(s, c.id, st.x, st.y, st.platforms, st.dir, 'split');
  if (!r.ok) return r;
  if (!spend(s, c, r.cost)) return fail('bani');
  st.sep = r.sep;
  claim(s, st, r);
  syncAuto(s);
  addNews(s, '🏙️', `${st.name}: fiecare linie iese acum separat în față (${r.fan.length} capete).`);
  return { ok: true, cost: r.cost };
}

export const THRU_COMMANDS = { buildThru, setThruTracks, splitThru };
