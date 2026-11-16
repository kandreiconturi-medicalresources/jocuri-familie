// Planificatorul de rută: sursa recomandată, vagoanele, orașul de pe drum vs. cel departe, „Fă tot” care livrează efectiv, determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createWorld, stepWorld, hashState, INDUSTRIES, NG, G } from '../games/trenuri/src/sim/index.js';
import { buildPlan, rankOptions, otherTakers, cityRequests, carsNeeded, pickModel, railLink } from '../games/trenuri/src/sim/planner.js';
import { runPlan } from '../games/trenuri/src/ui/plannerRun.js';
import { MODELS } from '../games/trenuri/src/sim/consts.js';
import { flat, station, track } from './trenuri-sig-helpers.js';

const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));
const FOOD = G.mancare;
const addInd = (s, key, x, y, inp = 0) => {
  const o = { id: s.industries.length, type: T[key], x, y, name: key + s.industries.length, in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  if (inp) o.in[G.cereale] = inp;
  s.industries.push(o); s.occ[y * s.w + x] = 1;
  return o;
};
const city = (c, x, y, pop) => Object.assign(c, { x, y, pop, level: 0 });
const req = (s, stops, extra = {}) => ({ g: FOOD, owner: 0, stops, cash: s.companies[0].cash, year: s.date.y, ...extra });
/** Orașul A (cere 80 t) la est; fabrici de mâncare: aproape (cu gară și șină), departe; orașul B pe drum, orașul C departe în altă parte. */
function world() {
  const s = flat();
  const [a, b, c] = s.cities;
  city(a, 50, 30, 1280); city(b, 36, 31, 640); city(c, 20, 56, 640);
  const near = addInd(s, 'fabmanc', 30, 30, 250), far = addInd(s, 'fabmanc', 8, 8, 250);
  return { s, a, b, c, near, far };
}

test('sursa recomandată e cea logică: cea mai aproape, cu gară și șină deja puse', () => {
  const { s, a, near, far } = world();
  const x = station(s, 31, 30), y = station(s, 49, 30);
  track(s, [31, 30], [49, 30]);
  const r = rankOptions(s, { fixed: a, g: FOOD, owner: 0, cash: s.companies[0].cash, year: 1950 });
  assert.equal(r.length, 2);
  assert.equal(r[0].o, near, 'prima e fabrica apropiată');
  assert.ok(r[0].linked && r[0].cost === 0 && r[0].why.includes('cea mai aproape') && r[0].why.includes('șina'), r[0].why);
  assert.ok(r[1].o === far && r[1].cost > 0);
  assert.ok(x && y);
  assert.deepEqual(cityRequests(s, a).map((q) => [q.g, q.want]), [[3, 80], [5, 40]]);
});

test('numărul de vagoane crește cu cererea și cu distanța; locomotiva aleasă e potrivită', () => {
  const m = MODELS[3];
  const a = carsNeeded(m, FOOD, 20, 20).cars, b = carsNeeded(m, FOOD, 80, 20).cars, c = carsNeeded(m, FOOD, 80, 60).cars;
  assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
  assert.ok(carsNeeded(m, FOOD, 80, 60).trains >= 2, 'un tren nu ajunge');
  assert.equal(pickModel(1950, 100000).id, 3, 'cea mai rapidă disponibilă care încape într-un sfert din bani');
  assert.equal(pickModel(1960, 100000).id, 4);
  assert.equal(pickModel(1950, 5000).id, 0, 'cu puțini bani: cea mai ieftină');
  const { s, a: A, near, far } = world();
  const p1 = buildPlan(s, req(s, [near, A])), p2 = buildPlan(s, req(s, [far, A]));
  assert.ok(p2.len > p1.len && p2.nd.cars >= p1.nd.cars && p2.build.track > p1.build.track);
  assert.ok(p1.ok && p1.missing === 2 && p1.build.stations === 2000);
});

test('orașul de pe drum e propus pe același tren; cel departe primește tren nou', () => {
  const { s, a, b, c, near } = world();
  const plan = buildPlan(s, req(s, [near, a])), list = otherTakers(s, req(s, [near, a]), plan);
  const eb = list.find((e) => e.o === b), ec = list.find((e) => e.o === c);
  assert.ok(eb.onRoad && eb.where === 'between' && eb.pct < 25 && eb.stops.join() === [near, b, a].join(), `ocol ${eb.pct}%`);
  assert.ok(eb.addCars >= 0 && eb.plan.stops.length === 3);
  assert.ok(!ec.onRoad && ec.pct >= 25 && ec.plan === null);
  assert.equal(list[0].o, b, 'cel de pe drum e primul');
  assert.ok(eb.noStock && eb.gain === 0, 'fabrica face 16 t și orașul A cere 80: nu mai rămâne pentru B');
  a.pop = 160; b.pop = 96; // A cere 10, B cere 6: încap amândoi în cele 16 t
  const p2 = buildPlan(s, req(s, [near, a])), eb2 = otherTakers(s, req(s, [near, a]), p2).find((e) => e.o === b);
  assert.ok(eb2.onRoad && !eb2.noStock && eb2.gain === 6, `câștig ${eb2.gain}`);
});

test('„Fă tot” pe o hartă de test: gări, șină și un tren care livrează efectiv în 8 luni (cu orașul de pe drum)', () => {
  const { s, a, b, near } = world();
  const plan = buildPlan(s, req(s, [near, b, a]));
  assert.ok(plan.ok && plan.total < s.companies[0].cash);
  const cash0 = s.companies[0].cash, r = runPlan(plan, (cmd) => applyCommand(s, { by: 0, ...cmd }));
  assert.ok(r.ok, JSON.stringify(r.steps));
  assert.equal(r.trains.length, plan.nd.trains);
  assert.equal(cash0 - s.companies[0].cash, r.spent);
  assert.ok(railLink(s, plan.stops[0].spot, plan.stops[2].spot, 0), 'șina leagă capetele');
  const tr = s.trains[0];
  assert.deepEqual(tr.orders.map((o) => o.drop.m), ['demand', 'demand', 'all']);
  let gotB = 0;
  for (let i = 0; i < 300 * 8; i++) { stepWorld(s); b.pop = 640; a.pop = 1280; b.level = a.level = 0; gotB = Math.max(gotB, b.got[FOOD], b.prev[FOOD]); }
  assert.ok(s.stats.del[FOOD] > 20, `livrat ${s.stats.del[FOOD]}`);
  assert.ok(gotB > 0, 'orașul de pe drum a primit mâncare (are prioritate: descărcare după cerere)');
  assert.ok(tr.money > 0);
  const again = buildPlan(s, req(s, [near, b, a]));
  assert.ok(again.linked && again.missing === 0 && again.build.track === 0, 'după „Fă tot” nu mai e nimic de construit');
});

test('„Fă tot” raportează clar când n-are bani, fără să strice nimic', () => {
  const { s, a, near } = world();
  s.companies[0].cash = 2500;
  const plan = buildPlan(s, req(s, [near, a])), r = runPlan(plan, (cmd) => applyCommand(s, { by: 0, ...cmd }));
  assert.ok(!r.ok && r.steps.some((q) => !q.ok && q.err === 'Nu ai destui bani încă!'));
  assert.ok(r.steps.some((q) => q.skipped), 'pașii următori sunt marcați ca nefăcuți');
  assert.equal(s.trains.length, 0);
});

test('determinism: același plan, același rezultat; planul nu schimbă starea', () => {
  const run = () => {
    const { s, a, b, near } = world(), h0 = hashState(s);
    const plan = buildPlan(s, req(s, [near, b, a]));
    assert.equal(hashState(s), h0, 'planificarea nu atinge lumea');
    runPlan(plan, (cmd) => applyCommand(s, { by: 0, ...cmd }));
    for (let i = 0; i < 1500; i++) stepWorld(s);
    return [hashState(s), plan.total, plan.nd.cars, plan.profit, plan.len];
  };
  assert.deepEqual(run(), run());
  const w = createWorld({ seed: 7, size: 'S', year: 1950 }), c = w.cities.find((q) => q.level >= 0);
  const o1 = rankOptions(w, { fixed: c, g: FOOD, owner: 0, cash: 100000, year: 1950 }), o2 = rankOptions(w, { fixed: c, g: FOOD, owner: 0, cash: 100000, year: 1950 });
  assert.deepEqual(o1.map((e) => [e.o.id, e.cost, e.profit, e.score]), o2.map((e) => [e.o.id, e.cost, e.profit, e.score]));
});
