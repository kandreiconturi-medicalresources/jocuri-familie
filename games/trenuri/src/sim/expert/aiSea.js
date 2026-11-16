// Etapa 7.5: AI-ul care face comerț pe mare (doar în lumea cu insule). Lunar, din aiMonth, prin aceleași comenzi ca un jucător:
// port pe insula lui (dacă n-are), vapoare spre insulele care fac ce-i lipsește (cumpără acolo și aduce acasă, iar la plecare
// duce surplusul de acasă), linii de tren industrie → port (export) și port → consumator (import), vânzarea vapoarelor inutile.
// Cel mult SEA_PLANS calcule de drum (seaPath / planTrack) pe lună și AI. Memoria e `co.ai.sea` (doar tablouri și întregi).
import { SHIP_MODELS, PORT } from '../consts.js';
import { NG, INDUSTRIES, cityGoods } from '../goods.js';
import { applyCommand } from '../commands.js';
import { islandAt, islandOfCo, islandGoods, matMissing, portsOf } from '../islands.js';
import { islandBalance, priceOf } from '../market.js';
import { coastSpot } from '../ports.js';
import { seaPath } from '../seaPath.js';
import { buildLink, fund } from './ai.js';
import { nodeKey } from './aiplan.js';

/** Pe niveluri: câte vapoare, cât păstrează în cont, după câte decizii începe și după câte decizii fără comerț vinde vaporul.
 *  O decizie = o lună în care AI-ul nu se odihnește după un proiect (la 1–5 luni, după nivel). */
export const SEA_LEVELS = [
  { ships: 1, reserve: 30000, start: 2, idle: 5, loans: false },
  { ships: 2, reserve: 20000, start: 1, idle: 5, loans: true },
  { ships: 3, reserve: 12000, start: 1, idle: 4, loans: true },
];
export const SEA_PLANS = 2;

const run = (s, co, cmd) => applyCommand(s, { by: co.id, ...cmd });
const homePort = (s, co, home) => portsOf(s, co.id).find((q) => islandAt(s, q.x, q.y) === home) || null;
const mineShips = (s, co) => s.ships.filter((q) => q.owner === co.id);
const target = (sh) => (sh.route.length > 1 && sh.route[1].l && sh.route[1].l.length ? sh.route[1].l[0] : -1);

/** Ce îi lipsește insulei (cerere fără producție), cele mai cerute întâi; plus materialele pentru vaporul următor. */
function wanted(s, co, home, model) {
  const can = islandGoods(s, home), b = islandBalance(s, home), out = [];
  if (model && mineShips(s, co).length) for (const [g] of matMissing(s, co.id, model.mat)) if (!can[g]) out.push(g);
  const rest = [];
  for (let g = 2; g < NG; g++) if (!can[g] && b.dem[g] > 0 && !out.includes(g)) rest.push(g);
  rest.sort((x, y) => b.dem[y] - b.dem[x] || x - y);
  return out.concat(rest);
}

/** Portul altei insule de unde se cumpără g: cel cu cel mai mult stoc (apoi cel mai ieftin, apoi id-ul). */
function sourceFor(s, co, home, g, mem) {
  let best = null, bs = -1;
  for (const st of s.stations) {
    if (!st.port || st.owner === co.id || mem.bad.includes(st.id)) continue;
    const k = islandAt(s, st.x, st.y);
    if (k < 0 || k === home || (!islandGoods(s, k)[g] && st.cargo[g] < 20)) continue;
    const sc = st.cargo[g] * 1000 - priceOf(s, k, g);
    if (sc > bs) { bs = sc; best = st; }
  }
  return best;
}

/** Ruta: acasă (descarcă tot, încarcă surplusul) → portul sursă (vinde surplusul, cumpără g). */
function routeFor(s, home, port, src, g) {
  const k = islandAt(s, src.x, src.y), can = islandGoods(s, home), there = islandGoods(s, k), ex = [];
  for (let q = 2; q < NG && ex.length < 3; q++) if (can[q] && !there[q] && q !== g) ex.push(q);
  return [{ p: port.id, a: 'sell', g: [], l: ex }, { p: src.id, a: 'sell', g: [], l: [g] }];
}

/** Drum pe apă verificat (consumă din buget); portul fără drum intră în lista proastă. */
function reachable(s, port, src, mem, budget) {
  if (budget.n <= 0) return false;
  budget.n--;
  if (seaPath(s, port.dock, src.dock)) return true;
  mem.bad.push(src.id);
  if (mem.bad.length > 20) mem.bad.shift();
  return false;
}

/** Cel mai încăpător model pe care și-l permite (bani peste rezervă și, de la al doilea vapor, materialele). */
function pickShip(s, co, S, budget) {
  let best = null;
  const first = !mineShips(s, co).length;
  for (const m of SHIP_MODELS) {
    if (m.year > s.date.y || m.price + budget > co.cash + (S.loans ? 20000 : 0)) continue;
    if (!first && matMissing(s, co.id, m.mat).length) continue;
    if (!best || m.cap > best.cap) best = m;
  }
  return best;
}

/** Vaporul cel mai bun pe care l-ar cumpăra acum (doar ca să știe ce materiale să aducă). */
const nextModel = (s) => SHIP_MODELS.filter((m) => m.year <= s.date.y).reduce((a, m) => (!a || m.cap > a.cap ? m : a), null);

/** Vinde vapoarele care n-au mai făcut comerț de mult; schimbă ruta celor care duc ceva ce nu mai trebuie. */
function review(s, co, S, home, port, mem, want, budget) {
  const ships = mineShips(s, co);
  mem.idle = mem.idle.filter((e) => ships.some((q) => q.id === e[0]));
  for (const sh of ships) {
    let e = mem.idle.find((q) => q[0] === sh.id);
    if (!e) { e = [sh.id, sh.money, 0]; mem.idle.push(e); }
    if (sh.money !== e[1] || sh.load.length) { e[1] = sh.money; e[2] = 0; } else e[2]++;
    if (e[2] >= S.idle && sh.state === 1) { run(s, co, { type: 'sellShip', shipId: sh.id }); continue; }
    const g = target(sh);
    if (g >= 0 && want.includes(g) && !mem.bad.includes(sh.route[1].p)) continue;
    let ng = -1, src = null;
    for (const q of want) if (!ships.some((o) => o !== sh && target(o) === q) && (src = sourceFor(s, co, home, q, mem))) { ng = q; break; }
    if (src && reachable(s, port, src, mem, budget)) run(s, co, { type: 'setShipRoute', shipId: sh.id, route: routeFor(s, home, port, src, ng) });
  }
  const recent = co.history.slice(-3).reduce((n, v) => n + v, 0);
  if (co.cash < 0 && recent < 0 && ships.length) { // criză: vinde vaporul care a cheltuit cel mai mult
    const w = ships.reduce((a, b) => (b.money < a.money ? b : a));
    run(s, co, { type: 'sellShip', shipId: w.id });
  }
}

/** Un vapor nou spre o marfă care încă n-are vapor. */
function buyOne(s, co, S, L, home, port, mem, want, budget) {
  const ships = mineShips(s, co);
  if (ships.length >= S.ships) return;
  let g = -1, src = null;
  for (const q of want) if (!ships.some((o) => target(o) === q) && (src = sourceFor(s, co, home, q, mem))) { g = q; break; }
  if (!src) return;
  const m = pickShip(s, co, S, S.reserve);
  if (!m) return;
  if (co.cash < m.price + S.reserve && !(S.loans && fund(s, co, L, m.price + S.reserve))) return;
  if (!reachable(s, port, src, mem, budget)) return;
  run(s, co, { type: 'buyShip', portId: port.id, model: m.id, route: routeFor(s, home, port, src, g) });
}

const portNode = (st) => ({ k: 'p' + st.id, o: st, port: true });
const indNode = (o) => ({ k: 'i' + o.id, o });

/** Linie de tren: o industrie a insulei → port (export) sau port → cine folosește marfa adusă (import). */
function railLink(s, co, L, S, home, port, mem, budget) {
  if (budget.n <= 0 || co.cash < S.reserve + 30000 || (mem.ln | 0) >= S.ships + 2) return;
  const done = co.ai.done.concat(co.ai.bad), on = (o) => islandAt(s, o.x, o.y) === home;
  const tries = [];
  for (let g = 2; g < NG; g++) {
    if (port.cargo[g] < 40 || islandGoods(s, home)[g]) continue; // import: marfa adusă stă în port
    for (const o of s.industries) if (on(o) && INDUSTRIES[o.type].in.includes(g)) tries.push({ a: portNode(port), b: indNode(o), good: g });
    for (const c of s.cities) if (on(c) && cityGoods(c).includes(g)) tries.push({ a: portNode(port), b: { k: 'c' + c.id, o: c, city: true }, good: g });
  }
  for (const o of s.industries) { // export: producția insulei spre port
    const g = INDUSTRIES[o.type].out;
    if (g >= 2 && on(o)) tries.push({ a: indNode(o), b: portNode(port), good: g });
  }
  for (const c of tries) {
    const key = nodeKey(c.a, c.b), d = Math.abs(c.a.o.x - c.b.o.x) + Math.abs(c.a.o.y - c.b.o.y);
    if (done.includes(key) || d < 5 || d > L.maxD + 6) continue;
    budget.n--;
    const r = buildLink(s, co, L, c);
    if (r === 'ok') { co.ai.done.push(key); mem.ln = (mem.ln | 0) + 1; } else if (r === 'bad') co.ai.bad.push(key);
    return;
  }
}

/** Pasul lunar pe mare al unui AI (L = nivelul de cale ferată, S = nivelul pe mare). */
export function aiSea(s, co, L) {
  const home = islandOfCo(s, co.id);
  if (home < 0 || !s.ships) return;
  const S = SEA_LEVELS[co.ai.lv] || SEA_LEVELS[1];
  if (!co.ai.sea) co.ai.sea = { m: 0, idle: [], bad: [] };
  const mem = co.ai.sea, budget = { n: SEA_PLANS };
  mem.m++;
  let port = homePort(s, co, home);
  if (!port) {
    const p = coastSpot(s, home);
    if (!p || co.cash < PORT.cost + (S.reserve >> 1)) return;
    const r = run(s, co, { type: 'buildPort', x: p.x, y: p.y });
    if (!r.ok) return;
    port = s.stations.find((q) => q.id === r.id);
  }
  if (mem.m < S.start) return;
  const want = wanted(s, co, home, nextModel(s));
  review(s, co, S, home, port, mem, want, budget);
  buyOne(s, co, S, L, home, port, mem, want, budget);
  if ((mem.m & 1) === 0) railLink(s, co, L, S, home, port, mem, budget);
}
