// Pașii unui depou: coada, 2 linii de reparații și macaraua (1): lift → repair → lower. Numai întregi.
import { DEPOT, MODELS } from './consts.js';
import { relOf } from './wear.js';
import { addNews } from './news.js';
import { hold } from './reserve.js';
import { tileOf } from './mission.js';

const repairTicks = (t) => DEPOT.repairBase + (100 - relOf(t)) * DEPOT.repairPer;
const craneBusy = (dep) => dep.jobs.some((j) => j.phase !== 'repair');

/** Trenul reparat iese pe linia de plecare și își reia ruta. Întoarce false cât timp locul de la intrare e ocupat. */
function release(s, dep, tr) {
  const i = tileOf(s, dep);
  if (s.pocc[i] > 0) return false;
  tr.rel = MODELS[tr.model].rel; tr.broken = 0; tr.dead = 0;
  tr.state = 2; tr.wait = 6; tr.dq = 0; tr.hold = 0; tr.org = i + 1;
  if (tr.route.includes(tr.rs)) tr.to = tr.rs;
  hold(s, tr, i);
  s.dirty.trains = true;
  addNews(s, '🔧', `Trenul ${tr.id} a fost reparat la ${dep.name} și pleacă din nou.`);
  return true;
}

function stepDepot(s, dep) {
  const get = (id) => s.trains.find((q) => q.id === id);
  for (const j of dep.jobs.slice()) {
    const tr = get(j.trainId);
    if (!tr) { dep.jobs.splice(dep.jobs.indexOf(j), 1); continue; }
    if (j.t < j.d) { j.t++; continue; }
    if (j.phase === 'lift') { j.phase = 'repair'; j.t = 0; j.d = repairTicks(tr); }
    else if (j.phase === 'repair') { if (!craneBusy(dep)) { j.phase = 'lower'; j.t = 0; j.d = DEPOT.lift; } }
    else if (release(s, dep, tr)) dep.jobs.splice(dep.jobs.indexOf(j), 1);
  }
  while (dep.jobs.length < dep.repairTracks && dep.queue.length && !craneBusy(dep)) {
    const id = dep.queue.shift();
    if (!get(id)) continue;
    dep.jobs.push({ trainId: id, phase: 'lift', t: 0, d: DEPOT.lift, lane: dep.jobs.some((j) => j.lane === 0) ? 1 : 0 });
  }
}

export function depotStep(s) {
  for (const d of s.depots) stepDepot(s, d);
  for (let k = s.trains.length - 1; k >= 0; k--) if (s.trains[k].gone) { s.trains.splice(k, 1); s.dirty.trains = true; }
}
