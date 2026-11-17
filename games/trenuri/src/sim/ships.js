// Vapoare (etapa 7.2): cumpărare, rută între porturi (ale tale sau ale altora), mers pe apă și vânzare.
// `s.ships = [{ id, owner, model, route: [{p, a, g, w}], at, dest, state /*0 pe mare, 1 în port*/, wait, path, seg, pos, load, money, born }]`.
// Vapoarele nu se ciocnesc (trec unul prin altul). Drumul se ia din `seaPath` (cache derivat), dar se salvează pe vapor.
import { SHIP_MODELS, PORT, LEN } from './consts.js';
import { NG } from './goods.js';
import { seaPath, stepDir } from './seaPath.js';
import { trade, tellTrade } from './shipTrade.js';
import { addNews } from './news.js';

const fail = (err) => ({ ok: false, err });
const ACTS = ['load', 'sell', 'swap'];
const portById = (s, id) => s.stations.find((q) => q.id === id && q.port);

/** Validează și curăță ruta: 1–6 opriri, porturi existente, drum pe apă între ele. null = rută proastă. */
export function cleanShipRoute(s, route) {
  if (!Array.isArray(route) || route.length < 1 || route.length > PORT.stops) return null;
  const out = [];
  for (const r of route) {
    if (!r || !portById(s, r.p) || !ACTS.includes(r.a)) return null;
    const g = r.g === undefined ? [] : r.g;
    if (!Array.isArray(g) || g.length > NG || g.some((x) => !Number.isInteger(x) || x < 2 || x >= NG)) return null;
    if (r.a === 'swap' && (!Number.isInteger(r.w) || r.w < 2 || r.w >= NG)) return null;
    if (r.l !== undefined && (!Array.isArray(r.l) || r.l.length > NG || r.l.some((x) => !Number.isInteger(x) || x < 2 || x >= NG))) return null;
    const o = r.a === 'swap' ? { p: r.p, a: r.a, g: g.slice(), w: r.w } : { p: r.p, a: r.a, g: g.slice() };
    if (r.l && r.l.length) o.l = r.l.slice(); // după vânzare, încarcă și astea
    out.push(o);
  }
  for (let i = 0; i < out.length; i++) {
    const A = portById(s, out[i].p), B = portById(s, out[(i + 1) % out.length].p);
    if (A !== B && !seaPath(s, A.dock, B.dock)) return null;
  }
  return out;
}

function arriveAt(s, sh) {
  const st = portById(s, sh.dest);
  sh.state = 1; sh.wait = PORT.dwell; sh.path = []; sh.seg = 0; sh.pos = 0;
  if (!st) return;
  sh.at = sh.route.findIndex((r) => r.p === sh.dest);
  tellTrade(s, sh, st, trade(s, sh, st, sh.at >= 0 ? sh.route[sh.at] : null));
}

function depart(s, sh) {
  const next = sh.route.length ? (sh.at + 1) % sh.route.length : -1;
  if (next < 0 || sh.route[next].p === sh.dest) { sh.wait = PORT.dwell; return; } // o singură oprire: stă în port
  const A = portById(s, sh.dest), B = portById(s, sh.route[next].p), p = A && B ? seaPath(s, A.dock, B.dock) : null;
  if (!p) { sh.wait = PORT.dwell * 5; return; }
  sh.at = next; sh.dest = B.id; sh.path = p.slice(); sh.seg = 0; sh.pos = 0; sh.state = 0;
  if (p.length < 2) arriveAt(s, sh);
}

/** Un pas pentru toate vapoarele. */
export function stepShips(s) {
  for (const sh of s.ships) {
    if (sh.state === 1) { if (--sh.wait <= 0) depart(s, sh); continue; }
    sh.pos += SHIP_MODELS[sh.model].speed;
    for (;;) {
      const L = LEN[stepDir(s.w, sh.path[sh.seg], sh.path[sh.seg + 1])];
      if (sh.pos < L) break;
      sh.pos -= L; sh.seg++;
      if (sh.seg >= sh.path.length - 1) { arriveAt(s, sh); break; }
    }
  }
}

/** buyShip { portId, model, route? }: în portul tău; ruta se poate da odată cu cumpărarea (în rețea nu aștepți id-ul). */
function buyShip(s, cmd, c) {
  if (!s.islands) return fail('insula');
  const st = portById(s, cmd.portId), m = SHIP_MODELS[cmd.model];
  if (!m) return fail('model');
  if (m.year > s.date.y) return fail('epoca');
  if (!st || st.owner !== c.id) return fail('port');
  const route = cmd.route === undefined ? [{ p: st.id, a: 'load', g: [] }] : cleanShipRoute(s, cmd.route);
  if (!route) return fail('vapor');
  if (!s.sandbox && c.cash < m.price) return fail('bani');
  if (!s.sandbox) c.cash -= m.price;
  const sh = { id: s.nextId++, owner: c.id, model: m.id, route, at: -1, dest: st.id, state: 1, wait: PORT.dwell, path: [], seg: 0, pos: 0, load: [], money: 0, born: s.date.y * 12 + s.date.m };
  s.ships.push(sh);
  arriveAt(s, sh); // încarcă la prima oprire, dacă e aici
  addNews(s, '🚢', `${c.name} are un vapor nou: ${m.name}!`);
  return { ok: true, cost: m.price, id: sh.id };
}

function setShipRoute(s, cmd, c) {
  const sh = s.ships.find((q) => q.id === cmd.shipId);
  if (!sh) return fail('inexistent');
  if (sh.owner !== c.id) return fail('proprietar');
  const route = cleanShipRoute(s, cmd.route);
  if (!route) return fail('vapor');
  sh.route = route;
  sh.at = route.findIndex((r) => r.p === sh.dest);
  if (sh.state === 1) sh.wait = Math.min(sh.wait, 5);
  return { ok: true, cost: 0 };
}

function sellShip(s, cmd, c) {
  const k = s.ships.findIndex((q) => q.id === cmd.shipId);
  if (k < 0) return fail('inexistent');
  const sh = s.ships[k];
  if (sh.owner !== c.id) return fail('proprietar');
  const back = SHIP_MODELS[sh.model].price >> 1;
  if (!s.sandbox) c.cash += back;
  s.ships.splice(k, 1);
  return { ok: true, cost: -back };
}

export const SHIP_COMMANDS = { buyShip, setShipRoute, sellShip };
