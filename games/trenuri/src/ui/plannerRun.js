// „Fă tot”: dă comenzile planului în ordine (gări, șină, tren) prin `exec` (în joc: applyCommand sau rețeaua) și spune clar ce n-a mers.
// Pură (fără DOM): testabilă cu exec = (c) => applyCommand(s, { by: 0, ...c }).
import { ERR_TEXT } from '../sim/commands.js';
import { CAR_OF } from '../sim/goods.js';
import { buyCommand } from './assistState.js';

/** Comanda de cumpărare a unui tren al planului, cu gările deja construite (stationIds în ordinea opririlor). */
export function trainCommand(plan, stationIds) {
  const a = { type: 'freight', good: plan.g, model: plan.model.id, cars: CAR_OF[plan.g] - 1, n: plan.nd.carsPer, stops: stationIds.map((id, i) => ({ id, drop: plan.stops[i].drop || null })) };
  return buyCommand(a);
}

/** Pașii după nume: gări noi, șină, trenuri. Întoarce { ok, steps: [{ text, ok, err? }], trains: [id], spent }. */
export function runPlan(plan, exec) {
  const steps = [], ids = [], trains = [];
  let spent = 0, failed = false;
  const step = (text, cmd) => {
    if (failed) { steps.push({ text, ok: false, skipped: true }); return null; }
    const r = exec(cmd);
    if (r && r.ok) { spent += r.cost || 0; steps.push({ text, ok: true, cost: r.cost || 0 }); return r; }
    failed = true; steps.push({ text, ok: false, err: ERR_TEXT[r && r.err] || 'Nu merge asta.' });
    return null;
  };
  plan.stops.forEach((x, i) => {
    if (x.st) { ids[i] = x.st.id; return; }
    const r = step(`🚉 Gară la ${x.o.name}`, { type: 'buildStation', x: x.spot.x, y: x.spot.y, size: x.size, dir: 0 });
    ids[i] = r ? r.id : undefined;
  });
  plan.legs.forEach((l, i) => {
    if (l.link || !l.plan) return;
    l.plan.cmds.forEach((cmd, k) => step(`🛤️ Șină ${i + 1}➜${i + 2}${l.plan.cmds.length > 1 ? ` (${k + 1}/${l.plan.cmds.length})` : ''}`, cmd));
  });
  for (let t = 0; t < plan.nd.trains; t++) {
    const cmd = ids.every((v) => v !== undefined) ? trainCommand(plan, ids) : null;
    if (!cmd && !failed) { failed = true; steps.push({ text: '🚂 Tren', ok: false, err: 'Nu găsesc gările noi (în rețea, așteaptă puțin și încearcă iar).' }); continue; }
    const r = step(`🚂 Tren ${t + 1}: ${plan.model.name}, ${plan.nd.carsPer} vagoane`, cmd);
    if (r && r.id) trains.push(r.id);
  }
  return { ok: !failed, steps, trains, spent, stationIds: ids };
}
