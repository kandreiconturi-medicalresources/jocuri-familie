// `executePlan { plan }`: comandă compusă, atomică și deterministă (planificatorul de rută, „Fă tot”). Ordinea: nivelări, șină/tunel, gări noi (pe capetele șinei), upgrade-uri, trenuri.
// Gările noi se dau prin referințe locale `{ new: i }` (i = indexul în plan.st), rezolvate aici la id-urile reale; cele existente prin id (număr).
// Atomic: planul se rulează întâi pe o copie a lumii (probă); dacă un pas e invalid sau lipsesc banii, lumea reală nu se atinge și rezultatul spune pasul și motivul.
// Mic pe fir: șina e „x,y + direcții” cu repetări (litera a–h = direcția 0–7, cifrele = de câte ori), iar nivelările șinei se recalculează aici (f:1).
import { DX, DY } from './consts.js';
import { fitLevels } from './terraform.js';
import { validOrders } from './orders.js';

const isInt = Number.isInteger, isRef = (n) => (r) => isInt(r) ? r >= 0 : !!r && isInt(r.new) && r.new >= 0 && r.new < n;
const MAX_TRAINS = 8, MAX_TILES = 3000, DIRS = 'abcdefgh';

/** Traseu [[x,y],...] → { x, y, d } cu d compact (repetări), sau null dacă nu e format din pași vecini. */
export function encodePath(path) {
  let d = '', run = 0, last = -1;
  const flush = () => { if (run) d += DIRS[last] + (run > 1 ? run : ''); };
  for (let i = 1; i < path.length; i++) {
    const k = DX.findIndex((v, q) => v === path[i][0] - path[i - 1][0] && DY[q] === path[i][1] - path[i - 1][1]);
    if (k < 0) return null;
    if (k === last && run < 999) run++; else { flush(); last = k; run = 1; }
  }
  flush();
  return { x: path[0][0], y: path[0][1], d };
}

/** Invers: [[x,y],...] sau null (format greșit sau prea lung). */
export function decodePath(x, y, d) {
  if (typeof d !== 'string' || !/^(?:[a-h]\d{0,3})+$/.test(d)) return null;
  const path = [[x, y]];
  for (const m of d.matchAll(/([a-h])(\d*)/g)) {
    const k = DIRS.indexOf(m[1]), n = m[2] ? +m[2] : 1;
    for (let q = 0; q < n; q++) { const l = path[path.length - 1]; path.push([l[0] + DX[k], l[1] + DY[k]]); }
    if (path.length > MAX_TILES) return null;
  }
  return path;
}

const ints = (a, n) => Array.isArray(a) && a.length === n && a.every(isInt);

/** null dacă forma planului e bună și gările existente sunt ale companiei; altfel codul erorii. */
function check(s, p, c) {
  if (!p || typeof p !== 'object') return 'drum';
  const { st = [], lv = [], tk = [], up = [], tr = [] } = p;
  if (![st, lv, tk, up, tr].every(Array.isArray) || st.length > 8 || lv.length > 8 || tk.length > 40 || up.length > 16 || tr.length > 4 || !tr.length) return 'drum';
  if (!st.every((q) => Array.isArray(q) && q.length >= 3 && q.length <= 4 && q.every(isInt))) return 'drum';
  if (!lv.every((q) => ints(q, 5))) return 'drum';
  if (!tk.every((q) => q && (q.u ? ints(q.u, 4) : isInt(q.x) && isInt(q.y) && typeof q.d === 'string' && q.d.length <= MAX_TILES && decodePath(q.x, q.y, q.d)))) return 'drum';
  const ref = isRef(st.length), mine = (r) => (isInt(r) ? s.stations.some((q) => q.id === r && q.owner === c.id) : true);
  if (!up.every((q) => Array.isArray(q) && q.length === 2 && ref(q[0]) && isInt(q[1]) && mine(q[0]))) return 'drum';
  let n = 0;
  for (const t of tr) {
    if (!t || !isInt(t.m) || !Array.isArray(t.k) || !t.k.every(isInt) || !Array.isArray(t.r) || t.r.length < 1 || t.r.length > 8 || !t.r.every(ref)) return 'drum';
    if (t.n !== undefined && !(isInt(t.n) && t.n >= 1 && t.n <= MAX_TRAINS)) return 'drum';
    if (t.o !== undefined && !validOrders(t.o)) return 'drum';
    if (!t.r.every(mine)) return 'gara'; // gara altcuiva (competitiv) sau inexistentă
    n += t.n || 1;
  }
  return n > MAX_TRAINS ? 'drum' : null;
}

/** Aplică pașii pe `s` prin `apply`; întoarce { ok, cost, ids (gările noi), trains } sau { ok:false, err, step }. */
function run(s, p, c, apply) {
  const by = c.id, ids = [], trains = [];
  let n = 0, cost = 0, bad = null;
  const go = (cmd) => {
    if (bad) return null;
    const r = apply(s, { ...cmd, by });
    if (!r.ok) { bad = { ok: false, err: r.err, step: n }; return null; }
    n++; cost += r.cost || 0;
    return r;
  };
  const id = (r) => (isInt(r) ? r : ids[r.new]);
  for (const [x0, y0, x1, y1, h] of p.lv || []) go({ type: 'levelTerrain', x0, y0, x1, y1, h });
  for (const q of p.tk || []) {
    if (q.u) { go({ type: 'buildTunnel', x0: q.u[0], y0: q.u[1], x1: q.u[2], y1: q.u[3] }); continue; }
    const path = decodePath(q.x, q.y, q.d), level = q.f && !bad ? fitLevels(s, path.map((t) => t[1] * s.w + t[0])) : [];
    go(level.length ? { type: 'buildTrack', path, level } : { type: 'buildTrack', path });
  }
  for (const [x, y, size, dir] of p.st || []) { const r = go({ type: 'buildStation', x, y, size, dir: dir | 0 }); ids.push(r ? r.id : -1); }
  for (const [r, kind] of p.up || []) go({ type: 'buildUpgrade', stationId: id(r), kind });
  for (const t of p.tr || []) {
    const route = t.r.map(id);
    for (let i = 0; i < (t.n || 1); i++) {
      const r = go({ type: 'buyTrain', model: t.m, kinds: t.k, stationId: route[0], route, ...(t.o !== undefined ? { orders: t.o } : {}) });
      if (r) trains.push(r.id);
    }
  }
  return bad || { ok: true, cost, ids, trains };
}

/** Copie adâncă a lumii (tablouri tipate, tablouri, obiecte, Map/Set), fără structuredClone (Safari 15.0–15.3 nu-l are). */
export function cloneState(v) {
  if (v === null || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) return v.slice();
  if (Array.isArray(v)) return v.map(cloneState);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, cloneState(x)]));
  if (v instanceof Set) return new Set([...v].map(cloneState));
  const o = {};
  for (const k of Object.keys(v)) o[k] = cloneState(v[k]);
  return o;
}

/** `apply` = applyCommand (dat de commands.js, ca să nu fie import circular). */
export function executePlan(s, cmd, c, apply) {
  const err = check(s, cmd.plan, c);
  if (err) return { ok: false, err, step: 0 };
  const sim = cloneState(s); // proba: pe o copie; lumea reală se schimbă doar dacă tot planul merge
  const dry = run(sim, cmd.plan, sim.companies[c.id], apply);
  if (!dry.ok) return dry;
  return run(s, cmd.plan, c, apply);
}
