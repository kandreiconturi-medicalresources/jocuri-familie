// „Fă tot”: planul devine O SINGURĂ comandă `executePlan` (atomică, aplicată în sim/execPlan.js), la fel în jocul singur și în rețea.
// Pură (fără DOM): testabilă cu exec = (c) => applyCommand(s, { by: 0, ...c }). În rețea exec poate întoarce o promisiune (răspunsul gazdei).
import { ERR_TEXT } from '../sim/commands.js';
import { CAR_OF } from '../sim/goods.js';
import { encodePath } from '../sim/execPlan.js';
import { buyCommand } from './assistState.js';

/** Comanda de cumpărare a unui tren al planului, cu gările deja construite (stationIds în ordinea opririlor). */
export function trainCommand(plan, stationIds) {
  const a = { type: 'freight', good: plan.g, model: plan.model.id, cars: CAR_OF[plan.g] - 1, n: plan.nd.carsPer, stops: stationIds.map((id, i) => ({ id, drop: plan.stops[i].drop || null })) };
  return buyCommand(a);
}

/** Planul → { cmd: executePlan, texts: [textul fiecărui pas, în ordinea din sim], refs } sau null dacă planul nu e gata. */
export function planCommand(plan) {
  if (!plan || !plan.ok) return null;
  const st = [], tk = [], stT = [], tkT = [], refs = [];
  let bad = false;
  plan.stops.forEach((x, i) => {
    if (x.st) { refs[i] = x.st.id; return; }
    refs[i] = { new: st.length }; st.push([x.spot.x, x.spot.y, x.size, 0]); stT.push(`🚉 Gară la ${x.o.name}`);
  });
  plan.legs.forEach((l, i) => {
    if (l.link || !l.plan) return;
    l.plan.cmds.forEach((c, k) => {
      const enc = c.type === 'buildTunnel' ? null : encodePath(c.path);
      if (c.type !== 'buildTunnel' && !enc) { bad = true; return; }
      const e = enc ? { ...enc, ...(c.level ? { f: 1 } : {}) } : { u: [c.x0, c.y0, c.x1, c.y1] }; // f: nivelările se recalculează în sim
      tk.push(e); tkT.push(`🛤️ Șină ${i + 1}➜${i + 2}${l.plan.cmds.length > 1 ? ` (${k + 1}/${l.plan.cmds.length})` : ''}`);
    });
  });
  if (bad) return null;
  const b = trainCommand(plan, plan.stops.map((_, i) => i));
  if (!b) return null;
  const texts = [...tkT, ...stT]; // aceeași ordine ca în sim: șină, gări, trenuri
  for (let t = 0; t < plan.nd.trains; t++) texts.push(`🚂 Tren ${t + 1}: ${plan.model.name}, ${plan.nd.carsPer} vagoane`);
  const tr = { m: b.model, k: b.kinds, r: refs, n: plan.nd.trains };
  if (b.orders) tr.o = b.orders;
  return { cmd: { type: 'executePlan', plan: { st, tk, tr: [tr] } }, texts, refs };
}

/** Rezultatul sim → { ok, steps: [{ text, ok, err?, skipped? }], trains: [id], spent, stationIds, err? }. Dacă a eșuat, nu s-a aplicat nimic. */
export function planResult(plan, built, r) {
  const res = r || { ok: false, err: 'drum' };
  if (res.ok) {
    const ids = built.refs.map((x) => (typeof x === 'number' ? x : res.ids[x.new]));
    return { ok: true, steps: built.texts.map((text) => ({ text, ok: true })), trains: res.trains.slice(), spent: res.cost || 0, stationIds: ids };
  }
  const at = Math.min(res.step | 0, built.texts.length - 1);
  const steps = built.texts.map((text, i) => (i === at ? { text, ok: false, err: ERR_TEXT[res.err] || 'Nu merge asta.' } : { text, ok: false, skipped: true }));
  return { ok: false, steps, trains: [], spent: 0, stationIds: [], err: res.err, none: true };
}

const failed = (text, err) => ({ ok: false, steps: [{ text, ok: false, err }], trains: [], spent: 0, stationIds: [], none: true });

/** O singură comandă `executePlan` prin `exec`. Întoarce rezultatul, sau o promisiune dacă exec e asincron (în rețea: până confirmă gazda). */
export function runPlan(plan, exec) {
  const built = planCommand(plan);
  if (!built) return failed('🧭 Plan', 'Planul nu e gata: lipsește un loc de gară sau nu se poate trage șina.');
  const r = exec(built.cmd);
  return r && typeof r.then === 'function' ? r.then((x) => planResult(plan, built, x)) : planResult(plan, built, r);
}
