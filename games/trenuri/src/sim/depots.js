// Depouri: construire, trimitere la reparat, defecțiuni pe traseu și remorcare (comenzile). Coada și macaraua sunt în depotJobs.js.
import { DEPOT, opp, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, MODELS } from './consts.js';
import { linkCount } from './blocks.js';
import { findRail } from './trains.js';
import { addNews } from './news.js';
import { roll } from './rand.js';
import { syncAuto } from './signals.js';
import { makeTow, tileOf } from './mission.js';

const fail = (err) => ({ ok: false, err });
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const trainOf = (s, id) => s.trains.find((q) => q.id === id);

/** O placă de șină din care pleacă o singură legătură (capăt de linie), fără gară sau depou: acolo se poate pune un depou. */
export const depotSpot = (s, i) => !!(s.track[i] & T_PRESENT) && !s.stm[i] && linkCount(s.track[i]) === 1;

function buildDepot(s, cmd, c) {
  const { x, y } = cmd;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return fail('harta');
  const i = y * s.w + x, t = s.track[i];
  if (!(t & T_PRESENT)) return fail('inexistent');
  if (((t & T_OWNER_MASK) >> T_OWNER_SHIFT) !== c.id) return fail('proprietar');
  if (s.stm[i]) return fail('gara');
  if (linkCount(t) !== 1) return fail('drum'); // doar la capătul unei linii: trenurile intră și nu mai ocupă linia principală
  if (!s.sandbox && c.cash < DEPOT.cost) return fail('bani');
  if (!s.sandbox) c.cash -= DEPOT.cost;
  let ld = 0;
  for (let d = 0; d < 8; d++) if ((t >> d) & 1) ld = d;
  let city = null, bd = 5;
  for (const q of s.cities) { const d = cheb(q, { x, y }); if (d < bd) { bd = d; city = q; } }
  const same = s.depots.filter((d) => d.name.startsWith('Depoul ' + (city ? city.name : 'nr.'))).length;
  const name = city ? `Depoul ${city.name}${same ? ' ' + (same + 1) : ''}` : `Depoul nr. ${s.depots.length + 1}`;
  const dep = { id: s.nextId++, owner: c.id, x, y, dir: opp(ld), name, repairTracks: DEPOT.tracks, cranes: 1, queue: [], jobs: [] };
  s.depots.push(dep);
  s.stm[i] = 1;
  syncAuto(s);
  s.dirty.track = s.dirty.stations = true;
  addNews(s, '🏭', `S-a deschis ${name}!`);
  return { ok: true, cost: DEPOT.cost, id: dep.id };
}

/** Cel mai apropiat depou al companiei (după drumul pe șine) față de placa `to`: { dep, len } sau null. */
function nearestDepot(s, owner, to, pick) {
  let best = null;
  for (const d of s.depots) {
    if (d.owner !== owner || (pick && d.id !== pick)) continue;
    const p = findRail(s, tileOf(s, d), to);
    if (p && (!best || p.length < best.len)) best = { dep: d, len: p.length };
  }
  return best;
}

function sendToDepot(s, cmd, c) {
  const t = trainOf(s, cmd.trainId);
  if (!t) return fail('inexistent');
  if (t.owner !== c.id) return fail('proprietar');
  if (t.tow || t.dead || t.state === 3 || t.toDepot) return fail('depou');
  const st = s.stations.find((q) => q.id === t.to);
  if (!st) return fail('depou');
  const near = nearestDepot(s, c.id, st.y * s.w + st.x, cmd.depotId);
  if (!near) return fail(s.depots.some((d) => d.owner === c.id) ? 'drum' : 'depou');
  t.toDepot = near.dep.id; t.paused = 0;
  if (t.state === 2) t.wait = Math.min(t.wait, 4);
  addNews(s, '🏭', `Trenul ${t.id} merge la ${near.dep.name}.`);
  return { ok: true, cost: 0 };
}

/** Pornește o remorcă de la cel mai apropiat depou spre trenul defect. */
export function startRescue(s, tg) {
  if (!tg.dead || tg.resc || tg.state !== 1) return fail('depou');
  const near = nearestDepot(s, tg.owner, tg.path[Math.max(0, tg.seg - 1)], 0);
  if (!near) return fail(s.depots.some((d) => d.owner === tg.owner) ? 'drum' : 'depou');
  const tow = makeTow(s, near.dep, tg);
  s.trains.push(tow);
  tg.resc = tow.id; s.dirty.trains = true;
  addNews(s, '🚑', `Remorca pleacă de la ${near.dep.name} spre trenul ${tg.id}.`);
  return { ok: true, cost: 0, id: tow.id };
}

function rescueTrain(s, cmd, c) {
  const t = trainOf(s, cmd.trainId);
  if (!t) return fail('inexistent');
  if (t.owner !== c.id) return fail('proprietar');
  return startRescue(s, t);
}

/** O defecțiune gravă: doar la companiile cu depou (altfel n-ar avea cine să ia trenul). Trenul stă pe linie și își ține rezervarea. */
export function breakHeavy(s, t) {
  if (t.tow || !s.depots.some((d) => d.owner === t.owner) || roll(s, 3) !== 0) return false;
  t.dead = 1; t.speed = 0;
  addNews(s, '🚨', `Trenul ${t.id} s-a defectat pe traseu și blochează linia! Trimite o remorcă.`);
  return true;
}

/** Un pas cu trenul defect: în modul simplu remorca pleacă după o zi; altfel, dacă nu vine nimeni, e reparat pe loc (scump și lent). */
export function deadTick(s, t) {
  t.speed = 0; t.dead++;
  if (t.resc) return;
  if (s.mode !== 'expert' && t.dead === DEPOT.auto + 1) startRescue(s, t);
  else if (t.dead > DEPOT.self) {
    const c = s.companies[t.owner];
    if (c && !s.sandbox) c.cash -= DEPOT.selfCost;
    t.dead = 0; t.rel = MODELS[t.model].rel;
    addNews(s, '🔧', `Trenul ${t.id} a fost reparat pe loc, încet și scump (${DEPOT.selfCost} lei).`);
  }
}

export const DEPOT_COMMANDS = { buildDepot, sendToDepot, rescueTrain };
