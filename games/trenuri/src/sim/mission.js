// Misiuni de depou: drumul trenului trimis la reparat și al remorcii (spre trenul defect, cuplare, înapoi). Folosește semnalele și rezervarea ca orice tren.
import { MODELS, RETRY } from './consts.js';
import { tailTiles, mark } from './blocks.js';
import { findRail, segLen } from './trains.js';
import { addNews } from './news.js';
import { hold, releaseAll, releaseFrom } from './reserve.js';

const byId = (s, id) => s.trains.find((q) => q.id === id);
export const depotById = (s, id) => s.depots.find((q) => q.id === id);
export const tileOf = (s, d) => d.y * s.w + d.x;
const near = (w, a, b) => Math.max(Math.abs((a % w) - (b % w)), Math.abs(((a / w) | 0) - ((b / w) | 0))) <= 1;

/** Plăcile pe care stă trupul unui tren oprit pe traseu, în ordinea drumului lui. */
export function bodyOf(t) {
  const lo = Math.max(0, t.seg - tailTiles(t)), hi = Math.min(t.path.length - 1, t.seg + 1);
  return t.path.slice(lo, hi + 1);
}

export function makeTow(s, dep, tg) {
  const m = MODELS[0];
  return { id: s.nextId++, owner: dep.owner, model: m.id, cars: 0, kinds: [], route: [], orders: null, at: 0, from: 0, to: 0, seg: 0, pos: 0, left: 0, speed: 0, path: [tileOf(s, dep)], state: 2, wait: 6, load: [], money: 0, lost: 0, hold: 0, broken: 0, rel: 100, paused: 0, noteT: -9999, born: s.date.y * 12 + s.date.m, rv: [], rl: 0, redAt: 0, tow: { targetId: tg.id, depotId: dep.id, ph: 'go', hp: null, k0: 0 } };
}

/** Scoate un tren din joc (remorca, după ce și-a făcut treaba); dispare din listă la pasul următor al depoului. */
export function dropTrain(s, t) {
  releaseAll(s, t); t.state = 3; t.gone = 1; s.dirty.trains = true;
}

function abortTow(s, t, why) {
  const tg = byId(s, t.tow.targetId);
  if (tg && tg.resc === t.id) tg.resc = 0;
  dropTrain(s, t);
  if (why) addNews(s, '🚑', why);
}

/** Trenul intră în depou: dispare din linie și așteaptă la coadă. `back` = gara de unde își reia ruta după reparație. */
export function enterDepot(s, t, dep, back) {
  releaseAll(s, t); // (stepTrain a scos deja marcajul de ocupare al trenului care se mișcă)
  t.state = 3; t.path = [tileOf(s, dep)]; t.seg = 0; t.pos = 0; t.left = 0; t.speed = 0; t.hold = 0; t.redAt = 0; t.rl = 0;
  t.dq = dep.id; t.cpl = 0; t.dead = 0; t.resc = 0; t.toDepot = 0; t.rs = back;
  dep.queue.push(t.id);
  s.dirty.trains = true;
}

/** Remorca se cuplează: trenul defect devine parte din convoiul ei și drumul se întoarce spre depou. */
function couple(s, t, tg, approach) {
  const T = approach[approach.length - 1], body = bodyOf(tg);
  const first = near(s.w, T, body[0]) ? body : body.slice().reverse(); // plăcile trenului defect, de la cea mai apropiată de remorcă
  mark(s, tg, -1); releaseAll(s, tg); releaseAll(s, t);
  tg.state = 3; tg.cpl = t.id; tg.speed = 0; tg.redAt = 0; tg.resc = 0;
  t.kinds = [0].concat(tg.kinds); t.cars = t.kinds.length; // locomotiva defectă e primul „vagon”
  t.tow.ph = 'haul'; t.tow.hp = first.slice().reverse().concat(approach.slice().reverse()); t.tow.k0 = first.length;
  t.path = [T]; t.seg = 0; t.pos = 0; t.left = 0; t.speed = 0; t.state = 2; t.wait = 6; t.hold = 0; t.redAt = 0; t.rl = 0;
  for (const i of t.tow.hp.slice(0, first.length + 1)) hold(s, t, i);
  s.dirty.trains = true;
  addNews(s, '🚑', `Remorca s-a cuplat la trenul ${tg.id} și îl duce la depou.`);
}

function towPath(s, t) {
  const dep = depotById(s, t.tow.depotId), tg = byId(s, t.tow.targetId);
  if (!dep || !tg) { abortTow(s, t, ''); return null; }
  const here = t.path[t.path.length - 1], D = tileOf(s, dep);
  if (t.tow.ph === 'haul') {
    if (t.tow.hp) { const r = { p: t.tow.hp, k0: t.tow.k0 }; t.tow.hp = null; return r; }
    const p = findRail(s, here, D);
    if (p) return { p, k0: 0 };
    abortTow(s, t, 'Remorca nu mai găsește drumul înapoi.');
    return null;
  }
  if (!tg.dead || tg.state !== 1) { abortTow(s, t, ''); return null; }
  const p = approach(s, here, tg);
  if (!p) { abortTow(s, t, `Remorca nu găsește drumul spre trenul ${tg.id}.`); return null; }
  if (p.length < 2) { couple(s, t, tg, p); return 'done'; }
  return { p, k0: 0 };
}

/** Drumul de la `here` până la placa dinaintea trupului trenului defect `tg`, sau null. */
function approach(s, here, tg) {
  const body = new Set(bodyOf(tg)), full = findRail(s, here, tg.path[Math.max(0, tg.seg - tailTiles(tg))]);
  if (!full) return null;
  let k = 1;
  while (k < full.length && !body.has(full[k])) k++;
  return full.slice(0, k);
}

const pathLen = (w, p) => { let L = 0; for (let k = 0; k + 1 < p.length; k++) L += segLen(w, p, k); return L; };

/** Remorca din mers: dacă ținta nu mai e defectă sau a luat-o altă remorcă, dispare spre depou; dacă o oprește alt tren defect, îl ia pe acela întâi; blocată de altă remorcă, se retrage. Întoarce true dacă a tratat pasul. */
export function towWatch(s, t) {
  if (t.state !== 1 || t.tow.ph !== 'go') return false;
  const tg = byId(s, t.tow.targetId);
  if (!tg || !tg.dead || tg.state !== 1 || tg.resc !== t.id) { abortTow(s, t, ''); return true; }
  if (t.hold < 25 || t.seg + 2 >= t.path.length) return false;
  const o = byId(s, s.resv[t.path[t.seg + 2]] - 1);
  if (!o || o === tg) return false;
  if (o.tow) { if (t.hold >= 100) abortTow(s, t, `Remorca a făcut loc la linia ocupată și se întoarce la depou.`); return t.hold >= 100; }
  if (!o.dead || o.state !== 1 || o.owner !== t.owner) return false;
  const here = t.path[t.seg + 1], p = approach(s, here, o);
  if (!p) return false;
  if (tg.resc === t.id) tg.resc = 0;
  o.resc = t.id; t.tow.targetId = o.id;
  const path = t.path.slice(0, t.seg + 1).concat(p), done = pathLen(s.w, t.path.slice(0, t.seg + 1)) + t.pos;
  releaseFrom(s, t, t.seg + 2);
  t.path = path; t.left = pathLen(s.w, path) - done; t.hold = 0;
  addNews(s, '🚑', `Remorca ia întâi trenul ${o.id}, care stă în drum.`);
  return false;
}

/** Drumul unei misiuni la plecare: { p, k0 }, null (așteaptă), 'done' (s-a făcut deja ce trebuia) sau undefined (misiunea s-a anulat: trenul merge normal). */
export function missionPath(s, t) {
  if (t.tow) return towPath(s, t);
  const dep = depotById(s, t.toDepot), A = s.stations.find((q) => q.id === t.to);
  if (!dep || !A) { t.toDepot = 0; return undefined; }
  const p = findRail(s, t.org ? t.org - 1 : A.y * s.w + A.x, tileOf(s, dep));
  if (!p) { t.toDepot = 0; addNews(s, '🤔', `Trenul ${t.id} nu găsește drumul la ${dep.name}.`); return undefined; }
  if (p.length < 2) { t.wait = RETRY; return null; }
  return { p, k0: 0 };
}

/** Sosire la capătul unei misiuni. Întoarce true dacă a tratat-o (altfel trenul face sosirea obișnuită într-o gară). */
export function arriveMission(s, t) {
  const last = t.path[t.path.length - 1];
  if (t.tow) {
    const dep = depotById(s, t.tow.depotId), tg = byId(s, t.tow.targetId);
    t.speed = 0;
    if (!dep || !tg) { abortTow(s, t, ''); return true; }
    const atDepot = last === tileOf(s, dep);
    if (t.tow.ph === 'go' && !atDepot) { if (tg.dead) couple(s, t, tg, t.path); else abortTow(s, t, ''); return true; }
    if (!atDepot || t.tow.ph === 'go') { t.state = 2; t.wait = RETRY; t.hold = 0; return true; } // s-a întors sau a rămas pe drum: pornește iar
    enterDepot(s, tg, dep, tg.from);
    addNews(s, '🚑', `Trenul ${tg.id} a fost remorcat la ${dep.name}.`);
    dropTrain(s, t);
    return true;
  }
  const dep = depotById(s, t.toDepot);
  if (!dep || last !== tileOf(s, dep)) return false;
  enterDepot(s, t, dep, t.to);
  addNews(s, '🏭', `Trenul ${t.id} a ajuns la ${dep.name}.`);
  return true;
}
