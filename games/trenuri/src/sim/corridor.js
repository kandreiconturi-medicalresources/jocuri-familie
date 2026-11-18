// „Culoar prin oraș”: gara de trecere extinsă. n (2–5) linii paralele drepte traversează tot orașul (de la o margine la alta + 2 plăci
// în afară), cu o singură gară la mijloc: toate liniile se adună în ea, deci n trenuri opresc deodată. Fiecare linie are capete proprii
// la ambele margini ale culoarului (nu se unesc), ca jucătorul să lege fiecare linie la altă șină din afară. Liniile sunt independente
// (`st.ln`, vezi laneGeo.js): fiecare are peronul ei în gară, deci n trenuri opresc deodată fără să se încurce.
// Refolosește gara de trecere (`thru.js`: loc, despăgubiri, intrări în evantai extinse până la capete); `st.cor` = jumătatea lungimii culoarului.
import { WATER_H, T_PRESENT, T_OWNER_SHIFT, UPGRADES } from './consts.js';
import { NG } from './goods.js';
import { addNews } from './news.js';
import { syncAuto } from './signals.js';
import { growBuildings } from './growth.js';
import { frameOf } from './terminal.js';
import { thruPlan, thruCost, claim, spend, houseAt, payOf } from './thru.js';
import { corTiles, corMinHalf, COR_MIN, COR_MAX } from './corGeo.js';

const fail = (err) => ({ ok: false, err });
const DIRS = { h: [4, 0], v: [2, 6] }; // direcția rândurilor: spre sud/nord (axa orizontală) sau est/vest (axa verticală)

/** Planul pe o singură latură (dir). Întoarce { ok, ... } sau { ok: false, err }. */
function corOne(s, by, city, axis, side, n, dir) {
  const w = s.w, h = s.h, hz = axis === 'h';
  let x0 = city.x, x1 = city.x, y0 = city.y, y1 = city.y;
  for (const b of city.buildings) { x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[0]); y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[1]); }
  const lo = hz ? x0 : y0, hi = hz ? x1 : y1, lo2 = hz ? y0 : x0, hi2 = hz ? y1 : x1, mid0 = hz ? city.y : city.x;
  const sg = hz ? (dir === 4 ? 1 : -1) : (dir === 2 ? 1 : -1);
  const row0 = side === 'centru' ? mid0 + sg : sg > 0 ? hi2 + 1 : lo2 - 1; // rândul liniei principale (centrul orașului rămâne pe rândul de margine)
  const E0 = (a) => Math.max(a - lo, hi - a, corMinHalf(n) - 2) + 2;
  const pos = (aa) => (hz ? [aa, row0] : [row0, aa]);
  const inStrip = (q, EE, aa) => { const [px, py] = pos(aa); return corTiles(px, py, dir, n, EE).some(([x, y]) => x === q.x && y === q.y); };
  let a = (lo + hi) >> 1, E = E0(a), st = null;
  for (let pass = 0; pass < 2; pass++) { // gara ta obișnuită de pe linia principală se transformă (culoarul se centrează pe ea)
    const inside = s.stations.filter((q) => q !== st && inStrip(q, E, a));
    if (!inside.length) break;
    const q = inside[0];
    if (pass || inside.length > 1 || (hz ? q.y : q.x) !== row0 || q.big || q.thru || q.port) return fail(q.owner !== by ? 'proprietar' : 'loc');
    if (q.owner !== by) return fail('proprietar');
    st = q; a = hz ? q.x : q.y; E = E0(a);
  }
  const [x, y] = pos(a), strip = corTiles(x, y, dir, n, E), f = frameOf(dir), mask = hz ? 0x44 : 0x11, houses = [], seen = new Set();
  for (const [tx, ty] of strip) {
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return fail('harta');
    const i = ty * w + tx, t = s.track[i], row = (tx - x) * f.cx + (ty - y) * f.cy;
    if (s.water[i] || s.height[i] <= WATER_H) return fail('teren');
    if (s.depots.some((d) => d.y * w + d.x === i)) return fail('loc');
    if (t & T_PRESENT) {
      if (((t >> T_OWNER_SHIFT) & 7) !== by) return fail('proprietar');
      if (row < 0 || row >= n || (t & 0xff & ~mask)) return fail('loc');
    }
    if (s.occ[i] && !seen.has(i)) { if (!houseAt(s, i)) return fail('loc'); seen.add(i); houses.push(i); }
  }
  const p = thruPlan(s, x, y, dir, n, st, by, E);
  if (!p.ok) return p;
  if (p.fan.length !== 2 * n || p.sides !== 2 * (n - 1)) return fail('panta'); // o linie nu ajunge până la capăt (deal prea abrupt)
  const all = new Set(p.houses);
  let pay = p.pay;
  for (const i of houses) if (!all.has(i)) { all.add(i); pay += payOf(houseAt(s, i).b); }
  const fan = p.fan.map((q) => { // linia continuă cu șina ta de dincolo de capătul culoarului, dacă există
    const [ex, ey] = q[q.length - 1], [px, py] = q[q.length - 2], nx = 2 * ex - px, ny = 2 * ey - py;
    const t = nx >= 0 && ny >= 0 && nx < w && ny < h ? s.track[ny * w + nx] : 0;
    return (t & T_PRESENT) && ((t >> T_OWNER_SHIFT) & 7) === by ? [...q, [nx, ny]] : q;
  });
  const r = { ...p, fan, houses: [...all], pay, x, y, E, dir, n, st, cityId: city.id, axis, side };
  return { ...r, ok: true, cost: thruCost(r, st) };
}

/** Informații pentru previzualizare (fără să schimbe starea): varianta cea mai ieftină dintre cele două laturi (sau `dir` dat). */
export function corInfo(s, by, cityId, axis, side, n, dir = -1) {
  const city = Number.isInteger(cityId) ? s.cities[cityId] : null;
  if (!city) return fail('inexistent');
  if (axis !== 'h' && axis !== 'v') return fail('culoar');
  if (side !== 'centru' && side !== 'margine') return fail('culoar');
  if (!Number.isInteger(n) || n < COR_MIN || n > COR_MAX) return fail('culoar');
  if (s.stations.some((q) => q.cor && q.cityId === cityId)) return fail('culoar1'); // un singur culoar pe oraș
  let best = null, err = 'loc';
  for (const d of DIRS[axis]) {
    if (dir >= 0 && dir !== d) continue;
    const r = corOne(s, by, city, axis, side, n, d);
    if (!r.ok) { err = r.err; continue; }
    if (!best || r.cost < best.cost) best = r;
  }
  return best || fail(err);
}
/** Ambele variante, pentru butoane și previzualizare: { centru, margine } (fiecare cu ok/err și preț). */
export const corVariants = (s, by, cityId, axis, n) => ({ centru: corInfo(s, by, cityId, axis, 'centru', n), margine: corInfo(s, by, cityId, axis, 'margine', n) });

/** buildCorridor { city, axis: 'h'|'v', side: 'centru'|'margine', n: 2..5, dir? } */
function buildCorridor(s, cmd, c) {
  const r = corInfo(s, c.id, cmd.city, cmd.axis, cmd.side, cmd.n, Number.isInteger(cmd.dir) ? cmd.dir : -1);
  if (!r.ok) return r;
  if (!spend(s, c, r.cost)) return fail('bani');
  const city = s.cities[r.cityId];
  let st = r.st;
  if (!st) {
    st = { id: s.nextId++, owner: c.id, x: r.x, y: r.y, size: 2, name: '', cityId: -1, dir: 0, platforms: 1, waiting: { pass: 0, mail: 0 }, rem: { pass: 0, mail: 0 }, cargo: new Array(NG).fill(0), up: UPGRADES.map(() => 0) };
    s.stations.push(st);
    const i = r.y * s.w + r.x;
    s.track[i] = s.track[i] | T_PRESENT | (c.id << T_OWNER_SHIFT);
    s.stm[i] = 1;
  }
  Object.assign(st, { thru: 1, dir: r.dir, platforms: r.n, size: 2, cityId: r.cityId, cor: r.E, name: `Gara Culoar ${city.name}` });
  claim(s, st, r);
  growBuildings(s, city, r.houses.length); // orașul își reface casele pe alte plăci libere (populația nu se pierde)
  syncAuto(s);
  addNews(s, '🛤️', `${city.name}: culoar cu ${r.n} linii și o singură gară${r.houses.length ? `, ${r.houses.length} case mutate (despăgubiri ${r.pay} lei)` : ''}!`);
  return { ok: true, cost: r.cost, id: st.id };
}

export const COR_COMMANDS = { buildCorridor };
