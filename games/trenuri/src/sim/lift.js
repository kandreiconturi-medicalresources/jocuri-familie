// Macaraua ridică un tren defect de pe linie: în depou (cel mai apropiat) sau, fără depou, îl repară pe loc fără să ocupe linia. Numai întregi.
import { DEPOT, MODELS } from './consts.js';
import { mark } from './blocks.js';
import { releaseAll, hold } from './reserve.js';
import { addNews } from './news.js';
import { enterDepot, tileOf } from './mission.js';

const fail = (err) => ({ ok: false, err });
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Ridică trenul defect `t` de pe linie. `inStep` = e apelat din pasul propriu al trenului (marcajele de ocupare sunt deja scoase). */
export function liftNow(s, t, inStep, auto) {
  if (!inStep) mark(s, t, -1);
  const i = t.path[Math.max(0, Math.min(t.path.length - 1, t.seg))], x = i % s.w, y = (i / s.w) | 0;
  let dep = null, bd = 1e9;
  for (const d of s.depots) if (d.owner === t.owner) { const q = cheb(d, { x, y }); if (q < bd) { bd = q; dep = d; } }
  const why = auto ? 'ca să nu rămână linia blocată' : 'de pe linie';
  if (dep) {
    enterDepot(s, t, dep, t.from);
    addNews(s, '🏗️', `Macaraua a ridicat trenul ${t.id} ${why} și l-a dus la ${dep.name}.`);
    return;
  }
  const st = s.stations.find((q) => q.id === t.from) || s.stations.find((q) => q.id === t.to) || s.stations[0];
  releaseAll(s, t);
  t.dead = 0; t.resc = 0; t.toDepot = 0; t.speed = 0; t.hold = 0; t.redAt = 0; t.rl = 0; t.pos = 0; t.left = 0;
  if (!st) { t.rel = MODELS[t.model].rel; t.broken = 30; addNews(s, '🏗️', `Trenul ${t.id} a fost reparat pe loc.`); return; }
  t.state = 3; t.path = [st.y * s.w + st.x]; t.seg = 0; t.rs = st.id; t.lf = DEPOT.lfTicks;
  s.dirty.trains = true;
  addNews(s, '🏗️', `Macaraua a ridicat trenul ${t.id} ${why}; îl repară în câteva zile și se întoarce la ${st.name}.`);
}

/** Trenurile ridicate fără depou se repară și reapar în gară, când locul e liber. */
export function liftStep(s) {
  for (const t of s.trains) {
    if (!t.lf || --t.lf > 0) continue;
    const i = t.path[0];
    if (s.pocc[i] > 0) { t.lf = 1; continue; }
    t.lf = 0; t.rel = MODELS[t.model].rel; t.broken = 0;
    t.state = 2; t.wait = 6; t.hold = 0; t.org = i + 1;
    if (t.route.includes(t.rs)) t.to = t.rs;
    hold(s, t, i);
    s.dirty.trains = true;
    addNews(s, '🔧', `Trenul ${t.id} a fost reparat și pleacă din nou.`);
  }
}

export function liftTrain(s, cmd, c) {
  const t = s.trains.find((q) => q.id === cmd.trainId);
  if (!t) return fail('inexistent');
  if (t.owner !== c.id) return fail('proprietar');
  if (!t.dead || t.state !== 1 || t.tow) return fail('defect');
  if (!s.sandbox && c.cash < DEPOT.liftCost) return fail('bani');
  if (!s.sandbox) c.cash -= DEPOT.liftCost;
  liftNow(s, t, false, false);
  return { ok: true, cost: DEPOT.liftCost };
}
