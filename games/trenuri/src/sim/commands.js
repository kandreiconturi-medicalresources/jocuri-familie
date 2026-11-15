// Singura cale prin care jucătorul schimbă starea: applyCommand(state, cmd) → { ok, err?, cost? }.
import { DX, DY, opp, T_BRIDGE, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, STATION_COST, STATION_NAMES, MODELS, CAR_PRICE, MAX_CARS, WATER_H, UPGRADES } from './consts.js';
import { pathCost } from './plan.js';
import { addNews } from './news.js';
import { mark } from './blocks.js';
import { CAR_TYPES, NG } from './goods.js';

const fail = (err) => ({ ok: false, err });
export const ERR_TEXT = {
  bani: 'Nu ai destui bani încă!', apa: 'Aici e apă: podul nu poate fi atât de lung.', cladire: 'Aici e o casă!', panta: 'Dealul e prea abrupt.',
  proprietar: 'Aici e șina altcuiva.', drum: 'Traseul nu e bun.', harta: 'Ești în afara hărții.', teren: 'Aici nu se poate construi.',
  tren: 'Un tren trece pe aici!', ruta: 'Un tren folosește gara asta.', inexistent: 'Nu găsesc asta.', gara: 'Aici e o gară sau lipsește una.', model: 'Alege un tren.', epoca: 'Locomotiva asta nu a fost inventată încă!', vagoane: 'Vagoanele nu sunt bune.', exista: 'Gara are deja asta.',
};

const inMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.w && y < s.h;
const spend = (s, c, amt) => { if (!s.sandbox && c.cash < amt) return false; if (!s.sandbox) c.cash -= amt; return true; };
const ownerOf = (t) => (t & T_OWNER_MASK) >> T_OWNER_SHIFT;

function buildTrack(s, cmd, c) {
  const path = cmd.path, r = pathCost(s, path, c.id);
  if (!r.ok) return fail(r.err);
  if (!spend(s, c, r.cost)) return fail('bani');
  const w = s.w;
  for (let k = 0; k < path.length; k++) {
    const i = path[k][1] * w + path[k][0];
    let t = s.track[i] | T_PRESENT | (c.id << T_OWNER_SHIFT);
    if (s.water[i]) t |= T_BRIDGE;
    if (k > 0) {
      const dx = path[k][0] - path[k - 1][0], dy = path[k][1] - path[k - 1][1];
      const d = DX.findIndex((v, q) => v === dx && DY[q] === dy), pi = path[k - 1][1] * w + path[k - 1][0];
      t |= 1 << opp(d);
      s.track[pi] |= 1 << d;
    }
    s.track[i] = t;
    s.forest[i] = 0;
  }
  s.dirty.track = s.dirty.forest = true;
  return { ok: true, cost: r.cost };
}

function removeTrack(s, cmd, c) {
  const { x, y } = cmd;
  if (!inMap(s, x, y)) return fail('harta');
  const i = y * s.w + x, t = s.track[i];
  if (!(t & T_PRESENT)) return fail('inexistent');
  if (ownerOf(t) !== c.id) return fail('proprietar');
  if (s.stations.some((st) => st.y * s.w + st.x === i)) return fail('gara');
  if (s.trains.some((tr) => tr.path.indexOf(i, tr.seg) >= 0)) return fail('tren');
  for (let d = 0; d < 8; d++) {
    if (!((t >> d) & 1)) continue;
    const ni = (y + DY[d]) * s.w + x + DX[d];
    s.track[ni] &= ~(1 << opp(d));
    if (!(s.track[ni] & 0xff) && !s.stations.some((st) => st.y * s.w + st.x === ni)) s.track[ni] = 0;
  }
  s.track[i] = 0;
  s.dirty.track = true;
  return { ok: true, cost: 0 };
}

function nearCity(s, x, y) {
  let best = -1, bd = 1e9;
  for (const c of s.cities) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < bd && d <= 4) { bd = d; best = c.id; } }
  return best;
}

function buildStation(s, cmd, c) {
  const { x, y } = cmd, size = cmd.size | 0;
  if (!inMap(s, x, y)) return fail('harta');
  if (size < 0 || size > 2) return fail('teren');
  const i = y * s.w + x;
  if (s.occ[i]) return fail('cladire');
  if (s.water[i] || s.height[i] <= WATER_H) return fail('teren');
  const t = s.track[i];
  if ((t & T_PRESENT) && ownerOf(t) !== c.id) return fail('proprietar');
  if (s.stations.some((st) => st.y * s.w + st.x === i)) return fail('teren');
  const cost = STATION_COST[size];
  if (!spend(s, c, cost)) return fail('bani');
  s.track[i] = t | T_PRESENT | (c.id << T_OWNER_SHIFT);
  s.forest[i] = 0;
  const cityId = nearCity(s, x, y), city = cityId >= 0 ? s.cities[cityId] : null;
  const same = city ? s.stations.filter((st) => st.cityId === cityId).length : 0;
  const name = city ? `${STATION_NAMES[size]} ${city.name}${same ? ' ' + (same + 1) : ''}` : `${STATION_NAMES[size]} ${s.stations.length + 1}`;
  const st = { id: s.nextId++, owner: c.id, x, y, size, name, cityId, dir: cmd.dir | 0, waiting: { pass: 0, mail: 0 }, rem: { pass: 0, mail: 0 }, cargo: new Array(NG).fill(0), up: [0, 0, 0, 0] };
  s.stations.push(st);
  s.stm[i] = 1;
  s.dirty.track = s.dirty.stations = s.dirty.forest = true;
  addNews(s, '🚉', `S-a deschis ${name}!`);
  return { ok: true, cost, id: st.id };
}

function removeStation(s, cmd, c) {
  const k = s.stations.findIndex((st) => st.id === cmd.id);
  if (k < 0) return fail('inexistent');
  const st = s.stations[k];
  if (st.owner !== c.id) return fail('proprietar');
  if (s.trains.some((t) => t.route.includes(st.id) || t.from === st.id || t.to === st.id)) return fail('ruta');
  s.stations.splice(k, 1);
  const i = st.y * s.w + st.x;
  s.stm[i] = 0;
  if (!(s.track[i] & 0xff)) s.track[i] = 0;
  s.dirty.track = s.dirty.stations = true;
  return { ok: true, cost: 0 };
}

function buyTrain(s, cmd, c) {
  const m = MODELS[cmd.model];
  const st = s.stations.find((q) => q.id === cmd.stationId);
  if (!m) return fail('model');
  if (m.year > s.date.y) return fail('epoca');
  if (!st || st.owner !== c.id) return fail('gara');
  let kinds = cmd.kinds;
  if (kinds === undefined) kinds = Array.from({ length: Math.max(1, Math.min(MAX_CARS, cmd.cars === undefined ? 3 : cmd.cars | 0)) }, (_, i) => (i % 3 === 2 ? 1 : 0));
  if (!Array.isArray(kinds) || kinds.length < 1 || kinds.length > MAX_CARS || kinds.some((k) => !Number.isInteger(k) || k < 0 || k >= CAR_TYPES.length)) return fail('vagoane');
  const cost = m.price + kinds.length * CAR_PRICE;
  if (!spend(s, c, cost)) return fail('bani');
  const tr = { id: s.nextId++, owner: c.id, model: m.id, cars: kinds.length, kinds: kinds.slice(), route: [st.id], orders: null, at: 0, from: st.id, to: st.id, seg: 0, pos: 0, left: 0, speed: 0, path: [], state: 2, wait: 10, load: [], money: 0, lost: 0, hold: 0, broken: 0, noteT: -9999 };
  s.trains.push(tr);
  s.dirty.trains = true;
  return { ok: true, cost, id: tr.id };
}

function buildUpgrade(s, cmd, c) {
  const st = s.stations.find((q) => q.id === cmd.stationId), u = UPGRADES[cmd.kind];
  if (!st || !u) return fail('inexistent');
  if (st.owner !== c.id) return fail('proprietar');
  if (st.up[cmd.kind]) return fail('exista');
  if (!spend(s, c, u.cost)) return fail('bani');
  st.up[cmd.kind] = 1;
  s.dirty.stations = true;
  addNews(s, u.icon, `${st.name} are acum: ${u.name.toLowerCase()}!`);
  return { ok: true, cost: u.cost };
}

function setOrders(s, cmd, c) {
  const tr = s.trains.find((q) => q.id === cmd.trainId);
  if (!tr) return fail('inexistent');
  if (tr.owner !== c.id) return fail('proprietar');
  const o = cmd.orders, good = (l) => l == null || (Array.isArray(l) && l.every((g) => Number.isInteger(g) && g >= 0 && g < NG));
  if (o !== null && !(Array.isArray(o) && o.length <= 8 && o.every((x) => x && good(x.load) && good(x.unload)))) return fail('drum');
  tr.orders = o ? o.map((x) => ({ load: x.load ? x.load.slice() : null, unload: x.unload ? x.unload.slice() : null })) : null;
  return { ok: true, cost: 0 };
}

function setRoute(s, cmd, c) {
  const tr = s.trains.find((t) => t.id === cmd.trainId);
  if (!tr) return fail('inexistent');
  if (tr.owner !== c.id) return fail('proprietar');
  const route = cmd.route;
  if (!Array.isArray(route) || route.length < 1 || route.length > 8 || route.some((id) => !s.stations.some((st) => st.id === id && st.owner === c.id))) return fail('gara');
  tr.route = route.slice();
  const k = tr.route.indexOf(tr.to);
  tr.at = k >= 0 ? k : 0;
  return { ok: true, cost: 0 };
}

function sellTrain(s, cmd, c) {
  const k = s.trains.findIndex((t) => t.id === cmd.trainId);
  if (k < 0) return fail('inexistent');
  const tr = s.trains[k];
  if (tr.owner !== c.id) return fail('proprietar');
  mark(s, tr, -1);
  const back = (MODELS[tr.model].price + tr.cars * CAR_PRICE) >> 1;
  c.cash += back;
  s.trains.splice(k, 1);
  s.dirty.trains = true;
  return { ok: true, cost: -back };
}

const TABLE = { buildTrack, removeTrack, buildStation, removeStation, buyTrain, setRoute, sellTrain, buildUpgrade, setOrders };

export function applyCommand(s, cmd) {
  if (!cmd || typeof cmd.type !== 'string') return fail('drum');
  if (cmd.type === 'setSpeed') return { ok: true }; // viteza o ține gazda, în afara simulării
  const fn = TABLE[cmd.type], c = s.companies[cmd.by | 0];
  if (!fn || !c) return fail('drum');
  return fn(s, cmd, c);
}
