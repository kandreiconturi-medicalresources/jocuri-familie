// Singura cale prin care jucătorul schimbă starea: applyCommand(state, cmd) → { ok, err?, cost? }.
import { START_CASH, DX, DY, opp, T_BRIDGE, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, STATION_COST, STATION_NAMES, MODELS, CAR_PRICE, MAX_CARS, WATER_H, UPGRADES } from './consts.js';
import { CONSIST_COMMANDS } from './consist.js';
import { BIG_COST, BIG_PLATFORMS, autoDir, yardProblem, claimYard, freeYard } from './terminal.js';
import { pathCost } from './plan.js';
import { addNews } from './news.js';
import { mark } from './blocks.js';
import { CAR_TYPES, NG } from './goods.js';
import { suggestKinds } from './advice.js';
import { EXPERT_COMMANDS, initCompany } from './expert/index.js';
import { SIGNAL_COMMANDS, syncAuto } from './signals.js';
import { TERRAIN_COMMANDS, applyLevels, layPath, markTerrain } from './terraform.js';
import { STATION_COMMANDS } from './stations.js';
import { THRU_COMMANDS, freeThru } from './thru.js';
import { hold, releaseAll } from './reserve.js';
import { DEPOT_COMMANDS } from './depots.js';
import { validOrders, cleanOrders } from './orders.js';
import { executePlan } from './execPlan.js';
import { islandApply, claimIsland } from './islands.js';
import { PORT_COMMANDS } from './ports.js';
import { SHIP_COMMANDS } from './ships.js';
import { BRIDGE_COMMANDS } from './bigBridge.js';
import { LAND_COMMANDS } from './land.js';
import { BANK_COMMANDS } from './bank.js';
import { TEAM_COMMANDS } from './teams.js';
import { SHAPE_COMMANDS } from './shapes.js';
import { setRoute } from './routeCmd.js';

const fail = (err) => ({ ok: false, err });
export const ERR_TEXT = {
  bani: 'Nu ai destui bani încă!', apa: 'Aici e apă: podul nu poate fi atât de lung (cel mult 30 de plăci pentru podul mare).', cladire: 'Aici e o casă!', panta: 'Dealul e prea abrupt.',
  proprietar: 'Aici e șina altcuiva.', drum: 'Traseul nu e bun.', harta: 'Ești în afara hărții.', teren: 'Aici nu se poate construi.',
  tren: 'Un tren trece pe aici!', ruta: 'Un tren folosește gara asta.', inexistent: 'Nu găsesc asta.', gara: 'Aici e o gară sau lipsește una.', legatura: 'Gările din rută nu sunt toate legate cu șină. Leagă-le sau scoate una.', model: 'Alege un tren.', epoca: 'Locomotiva asta nu a fost inventată încă!', vagoane: 'Vagoanele nu sunt bune.', exista: 'Gara are deja asta.', timp: 'Gazda n-a răspuns la timp.',
  limita: 'Gara nu poate crește: orașul și producția din jur sunt prea mici.', expert: 'Asta merge doar în modul expert.', rating: 'Banca nu mai dă împrumuturi: ratingul e prea mic.', actiuni: 'Nu se poate cu acțiunile astea.', depou: 'Ai nevoie de un depou, iar trenul să nu fie deja acolo.',
  loc: 'Terminalul mare sau gara de trecere au nevoie de loc plat lângă gară (fără alte șine, industrii sau apă; casele se mută) și de o linie dreaptă.',
  insula: 'Insula asta e a altei companii: aici nu poți construi. Cumpără teren 🏠 sau fă comerț prin port ⚓🚢.', material: 'Îți lipsesc materiale de construcție (oțel, cherestea sau bunuri) în port.',
  pod: 'Podul mare e o linie dreaptă (orizontală, verticală sau în diagonală), de pe uscat pe uscat, cu cel puțin o placă de apă între capete.', ocupat: 'Pe parcela asta sunt gări sau depouri ale altcuiva: nu se poate vinde.',
  port: 'Portul se pune pe insula ta, pe o placă de uscat chiar lângă apă.', vapor: 'Ruta vaporului nu e bună: alege porturi la care se ajunge pe apă.',
};

const inMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.w && y < s.h;
const spend = (s, c, amt) => { if (!s.sandbox && c.cash < amt) return false; if (!s.sandbox) c.cash -= amt; return true; };
const ownerOf = (t) => (t & T_OWNER_MASK) >> T_OWNER_SHIFT;

function buildTrack(s, cmd, c) {
  const path = cmd.path, lv = cmd.level && Array.isArray(path) && path.every((p) => Array.isArray(p)) ? applyLevels(s, cmd.level, path) : null; // nivelare opțională, plătită odată cu șina
  if (lv && !lv.ok) return fail(lv.err);
  const r = pathCost(s, path, c.id), total = r.ok ? r.cost + (lv ? lv.cost : 0) : 0;
  if (!r.ok || !spend(s, c, total)) { if (lv) lv.undo(); return fail(r.ok ? 'bani' : r.err); }
  if (lv && lv.box) markTerrain(s, ...lv.box);
  layPath(s, path, c);
  syncAuto(s);
  return { ok: true, cost: total };
}

function removeTrack(s, cmd, c) {
  const { x, y } = cmd;
  if (!inMap(s, x, y)) return fail('harta');
  const i = y * s.w + x, t = s.track[i];
  if (!(t & T_PRESENT)) return fail('inexistent');
  if (ownerOf(t) !== c.id) return fail('proprietar');
  if (s.stations.some((st) => st.y * s.w + st.x === i) || s.depots.some((d) => d.y * s.w + d.x === i)) return fail('gara');
  if (s.trains.some((tr) => tr.path.indexOf(i, tr.seg) >= 0)) return fail('tren');
  for (let d = 0; d < 8; d++) {
    if (!((t >> d) & 1)) continue;
    const ni = (y + DY[d]) * s.w + x + DX[d];
    s.track[ni] &= ~(1 << opp(d));
    if (!(s.track[ni] & 0xff) && !s.stations.some((st) => st.y * s.w + st.x === ni)) s.track[ni] = 0;
  }
  s.track[i] = 0;
  s.signals = s.signals.filter((g) => g.auto || g.x !== x || g.y !== y);
  syncAuto(s);
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
  const big = !!cmd.big && size === 2;
  const dir = big ? (cmd.dir === undefined ? autoDir(s, x, y) : cmd.dir | 0) : cmd.dir | 0;
  if (big) { if (dir < 0) return fail('loc'); const p = yardProblem(s, x, y, dir); if (p) return fail(p === 'harta' || p === 'cladire' || p === 'panta' ? p : 'loc'); }
  const cost = big ? BIG_COST : STATION_COST[size];
  if (!spend(s, c, cost)) return fail('bani');
  s.track[i] = t | T_PRESENT | (c.id << T_OWNER_SHIFT);
  s.forest[i] = 0;
  const cityId = nearCity(s, x, y), city = cityId >= 0 ? s.cities[cityId] : null;
  const same = city ? s.stations.filter((st) => st.cityId === cityId).length : 0;
  const name = city ? `${STATION_NAMES[size]} ${city.name}${same ? ' ' + (same + 1) : ''}` : `${STATION_NAMES[size]} ${s.stations.length + 1}`;
  const st = { id: s.nextId++, owner: c.id, x, y, size, name, cityId, dir, platforms: big ? BIG_PLATFORMS : 1, waiting: { pass: 0, mail: 0 }, rem: { pass: 0, mail: 0 }, cargo: new Array(NG).fill(0), up: UPGRADES.map(() => 0) };
  if (big) { st.big = 1; claimYard(s, st); }
  s.stations.push(st);
  s.stm[i] = 1;
  syncAuto(s);
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
  if (st.big) { freeYard(s, st); s.dirty.forest = true; }
  if (st.thru) freeThru(s, st);
  const i = st.y * s.w + st.x;
  s.stm[i] = 0;
  if (!(s.track[i] & 0xff)) s.track[i] = 0;
  syncAuto(s);
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
  if (kinds === undefined && cmd.cars === undefined && Array.isArray(cmd.route) && cmd.route.length > 1) kinds = suggestKinds(s, cmd.route, m.power); // vagoane potrivite pentru marfa rutei
  if (kinds === undefined) kinds = Array.from({ length: Math.max(1, Math.min(MAX_CARS, cmd.cars === undefined ? 3 : cmd.cars | 0)) }, (_, i) => (i % 3 === 2 ? 1 : 0));
  if (!Array.isArray(kinds) || kinds.length < 1 || kinds.length > MAX_CARS || kinds.some((k) => !Number.isInteger(k) || k < 0 || k >= CAR_TYPES.length)) return fail('vagoane');
  const route = cmd.route === undefined ? [st.id] : cmd.route; // opțional: ruta se dă odată cu cumpărarea (în rețea nu aștepți id-ul)
  if (!Array.isArray(route) || route.length < 1 || route.length > 8 || route[0] !== st.id || route.some((id) => !s.stations.some((q) => q.id === id && q.owner === c.id))) return fail('gara');
  if (cmd.orders !== undefined && !validOrders(cmd.orders)) return fail('drum'); // ordinele (ex. descărcare parțială) se dau odată cu cumpărarea
  const cost = m.price + kinds.length * CAR_PRICE;
  if (!spend(s, c, cost)) return fail('bani');
  const tr = { id: s.nextId++, owner: c.id, model: m.id, cars: kinds.length, kinds: kinds.slice(), route: route.slice(), orders: cleanOrders(cmd.orders === undefined ? null : cmd.orders), at: 0, from: st.id, to: st.id, seg: 0, pos: 0, left: 0, speed: 0, path: [], state: 2, wait: 10, load: [], money: 0, lost: 0, hold: 0, broken: 0, rel: m.rel, paused: 0, noteT: -9999, born: s.date.y * 12 + s.date.m, rv: [], rl: 0, redAt: 0 };
  s.trains.push(tr);
  hold(s, tr, st.y * s.w + st.x); // trenul stă pe un peron
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
  if (cmd.orders === undefined || !validOrders(cmd.orders)) return fail('drum');
  tr.orders = cleanOrders(cmd.orders);
  return { ok: true, cost: 0 };
}

function pauseTrain(s, cmd, c) {
  const tr = s.trains.find((q) => q.id === cmd.trainId);
  if (!tr) return fail('inexistent');
  if (tr.owner !== c.id) return fail('proprietar');
  tr.paused = cmd.type === 'pauseTrain' ? 1 : 0; // trenul în mers termină drumul și stă în gara următoare
  return { ok: true, cost: 0 };
}

function sellTrain(s, cmd, c) {
  const k = s.trains.findIndex((t) => t.id === cmd.trainId);
  if (k < 0) return fail('inexistent');
  const tr = s.trains[k];
  if (tr.owner !== c.id) return fail('proprietar');
  if (tr.state === 3 || tr.tow) return fail('depou');
  mark(s, tr, -1);
  releaseAll(s, tr);
  const back = (MODELS[tr.model].price + tr.cars * CAR_PRICE) >> 1;
  c.cash += back;
  s.trains.splice(k, 1);
  s.dirty.trains = true;
  return { ok: true, cost: -back };
}

/** Doar gazda o generează: un jucător nou în competitiv primește o companie (cel mult 8 încap în biții de proprietar). */
function joinCompany(s, cmd) {
  const n = s.net;
  if (!n || n.mode !== 'comp' || s.companies.length >= 8 || n.pl[cmd.pl] !== undefined) return fail('drum');
  const id = s.companies.length;
  s.companies.push({ id, name: String(cmd.name || 'Jucător').slice(0, 20), color: String(cmd.color || '#8fd3ff').slice(0, 9), cash: START_CASH, loan: 0, history: [], month: 0, record: 0 });
  if (s.mode === 'expert') initCompany(s.companies[id]);
  else if (s.islands) s.companies[id].tr = []; // 7.4: banca și în modul simplu
  n.pl[cmd.pl] = id;
  if (n.team) { if (!n.nm) n.nm = {}; n.nm[cmd.pl] = s.companies[id].name.slice(0, 14); } // 7.5: echipă nouă cu un singur membru
  if (s.islands) claimIsland(s, id);
  addNews(s, '🏢', `A intrat în joc: ${s.companies[id].name}!`);
  return { ok: true, cost: 0 };
}

const planRun = (s, cmd, c) => executePlan(s, cmd, c, applyCommand);
const TABLE = { ...SHAPE_COMMANDS, ...TEAM_COMMANDS, ...BRIDGE_COMMANDS, ...LAND_COMMANDS, ...BANK_COMMANDS, ...PORT_COMMANDS, ...SHIP_COMMANDS, ...CONSIST_COMMANDS, ...DEPOT_COMMANDS, executePlan: planRun, ...SIGNAL_COMMANDS, ...TERRAIN_COMMANDS, ...STATION_COMMANDS, ...THRU_COMMANDS, joinCompany, buildTrack, removeTrack, buildStation, removeStation, buyTrain, setRoute, sellTrain, buildUpgrade, setOrders, pauseTrain, resumeTrain: pauseTrain };

export function applyCommand(s, cmd) {
  if (!cmd || typeof cmd.type !== 'string') return fail('drum');
  if (cmd.type === 'setSpeed') return { ok: true }; // viteza o ține gazda, în afara simulării
  const fn = TABLE[cmd.type] || EXPERT_COMMANDS[cmd.type], c = s.companies[cmd.by | 0];
  if (!fn || !c) return fail('drum');
  return s.islands ? islandApply(s, cmd, c, fn) : fn(s, cmd, c);
}
