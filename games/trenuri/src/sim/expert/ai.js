// Concurenții AI ai modului expert: decid lunar (ieftin pentru CPU), prin aceleași comenzi ca un jucător, cu rng-ul stării.
import { MODELS, CAR_PRICE, STATION_COST, availableModels } from '../consts.js';
import { trainMaint } from './finance.js';
import { CAR_OF } from '../goods.js';
import { applyCommand } from '../commands.js';
import { planTrack } from '../plan.js';
import { roll } from '../rand.js';
import { LOAN_TR, AI_LEVELS } from './consts.js';
import { candidates, ownStation, spotFor, nodeKey } from './aiplan.js';
import { aiSea } from './aiSea.js';

const run = (s, co, cmd) => applyCommand(s, { by: co.id, ...cmd });
const ageM = (s, t) => s.date.y * 12 + s.date.m - (t.born === undefined ? s.date.y * 12 + s.date.m : t.born);
const trainPrice = (t) => MODELS[t.model].price + t.cars * CAR_PRICE;

/** Cel mai rapid model pe care și-l permite (cu 3 vagoane) sau cel mai ieftin. */
function pickModel(s, budget) {
  const ms = availableModels(s.date.y);
  let best = ms[0];
  for (const m of ms) if (m.price + 3 * CAR_PRICE <= budget && m.vmax > best.vmax) best = m;
  return best;
}

/** Împrumută tranșe până acoperă `need` (cât permite nivelul și ratingul); întoarce true dacă acum are destul. */
export function fund(s, co, L, need) {
  while (co.cash < need && co.tr.length < L.loans) if (!run(s, co, { type: 'takeLoan' }).ok) break;
  return co.cash >= need;
}

/** O legătură nouă: gări (sau cele existente), șină, un tren cu vagoane potrivite mărfii. */
export function buildLink(s, co, L, c) {
  const sa = ownStation(s, co, c.a), sb = ownStation(s, co, c.b);
  const pa = sa || spotFor(s, c.a, c.b), pb = sb || spotFor(s, c.b, c.a);
  if (!pa || !pb) return 'bad';
  const plan = planTrack(s, [pa.x, pa.y], [pb.x, pb.y], co.id);
  if (!plan) return 'bad';
  const cheap = availableModels(s.date.y)[0], kinds = c.good < 0 ? [0, 0, 1] : [CAR_OF[c.good], CAR_OF[c.good], CAR_OF[c.good]];
  const need = plan.cost + (sa ? 0 : STATION_COST[1]) + (sb ? 0 : STATION_COST[1]) + cheap.price + kinds.length * CAR_PRICE + (L.reserve >> 2);
  if (!fund(s, co, L, need)) return 'poor';
  const ids = [];
  for (const [st, p] of [[sa, pa], [sb, pb]]) {
    if (st) { ids.push(st.id); continue; }
    const r = run(s, co, { type: 'buildStation', x: p.x, y: p.y, size: 1 });
    if (!r.ok) return 'bad';
    ids.push(r.id);
  }
  if (!run(s, co, { type: 'buildTrack', path: plan.path }).ok) return 'bad';
  const m = pickModel(s, co.cash - (L.reserve >> 2));
  if (!run(s, co, { type: 'buyTrain', model: m.id, stationId: ids[0], kinds, route: ids }).ok) run(s, co, { type: 'buyTrain', model: cheap.id, stationId: ids[0], kinds, route: ids });
  return 'ok';
}

function expand(s, co, L) {
  const list = candidates(s, co, L).slice(0, 4);
  if (!list.length) return false;
  const start = L.cool > 3 || list.length < 2 ? 0 : roll(s, Math.min(2, list.length)); // cei prudenți aleg mereu cea mai bună
  for (let k = 0, plans = 0; k < list.length && plans < 2; k++) {
    const c = list[(start + k) % list.length];
    plans++;
    const r = buildLink(s, co, L, c);
    if (r === 'bad') co.ai.bad.push(nodeKey(c.a, c.b));
    if (r === 'ok') { co.ai.done.push(nodeKey(c.a, c.b)); return true; }
  }
  return false;
}

/** Trenuri în plus pe liniile cu marfă multă; vinde trenurile care după un an tot n-au câștigat nimic. */
function upkeep(s, co, L) {
  const mine = s.trains.filter((t) => t.owner === co.id);
  for (const t of mine.slice(0, 6)) {
    const mo = s.date.m - 1, mt = trainMaint(s, t) * 1.1, weak = (ageM(s, t) > 10 && t.money < ageM(s, t) * mt) || (ageM(s, t) > 12 && mo >= 6 && t.money - (t.pm | 0) < mo * mt);
    if (weak) { run(s, co, { type: 'sellTrain', trainId: t.id }); continue; }
    if (t.route.length < 2 || t.money < trainPrice(t) / 3 || co.cash < L.reserve + trainPrice(t)) continue;
    const same = mine.filter((q) => q.route.join() === t.route.join()).length;
    const st = s.stations.find((q) => q.id === t.route[0]), st2 = s.stations.find((q) => q.id === t.route[1]);
    const wait = (q) => (q ? q.waiting.pass + q.waiting.mail + q.cargo.reduce((n, v) => n + v, 0) : 0);
    if (same < L.perLine && wait(st) + wait(st2) > 100) { run(s, co, { type: 'buyTrain', model: t.model, stationId: t.route[0], kinds: t.kinds, route: t.route }); break; }
  }
}

/** Un pas lunar pentru un AI: plătește datoriile când e bogat, apoi construiește sau îngrijește linii. */
export function aiMonth(s, co) {
  const L = AI_LEVELS[co.ai.lv];
  if (co.tr.length && co.cash > L.reserve * 2 + LOAN_TR) run(s, co, { type: 'repayLoan' });
  upkeep(s, co, L);
  if (co.ai.cool > 0) { co.ai.cool--; return; }
  if (s.islands) aiSea(s, co, L); // 7.5: port, vapoare, export și import (când AI-ul nu „se odihnește” după un proiect)
  const recent = co.history.slice(-6).reduce((n, v) => n + v, 0);
  if (co.cash < L.reserve / 4 && recent < 0) { // criză: vinde trenul cu cel mai mic câștig pe lună
    const mine = s.trains.filter((t) => t.owner === co.id && ageM(s, t) > 3);
    if (mine.length > 1) { const w = mine.reduce((a, b) => (b.money / (ageM(s, b) + 1) < a.money / (ageM(s, a) + 1) ? b : a)); run(s, co, { type: 'sellTrain', trainId: w.id }); }
  }
  if (co.history.length >= 6 && recent < -L.reserve / 4) { co.ai.cool = 1; return; } // pierde bani: întâi îndreaptă, apoi extinde
  co.ai.cool = expand(s, co, L) ? L.cool + roll(s, 2) : 1;
  if (co.ai.bad.length > 40) co.ai.bad.shift();
}
