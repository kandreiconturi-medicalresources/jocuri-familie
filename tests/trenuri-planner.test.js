// Planificatorul de rută: sursa recomandată, vagoanele, orașul de pe drum vs. cel departe, „Fă tot” care livrează efectiv, determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createWorld, createNetWorld, planTrack, T_PRESENT, stepWorld, hashState, INDUSTRIES, NG, G } from '../games/trenuri/src/sim/index.js';
import { buildPlan, rankOptions, otherTakers, cityRequests, carsNeeded, pickModel, railLink } from '../games/trenuri/src/sim/planner.js';
import { runPlan, planCommand } from '../games/trenuri/src/ui/plannerRun.js';
import { encodePath, decodePath } from '../games/trenuri/src/sim/execPlan.js';
import { ALLOWED, wire } from '../games/trenuri/src/net/wire.js';
import { createHub } from './trenuri-hub.js';
import { MODELS } from '../games/trenuri/src/sim/consts.js';
import { flat, station, track } from './trenuri-sig-helpers.js';

const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
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

// ---- executePlan: comanda compusă, atomică (șină + gări + tren într-un singur mesaj) ----
const exec1 = (s, plan, by = 0) => applyCommand(s, { by, ...planCommand(plan).cmd });

test('executePlan local: o singură comandă face gări, șină și tren, iar trenul livrează', () => {
  const { s, a, b, near } = world();
  const plan = buildPlan(s, req(s, [near, b, a])), built = planCommand(plan);
  assert.equal(built.cmd.type, 'executePlan');
  assert.ok(ALLOWED.has('executePlan'));
  const cash0 = s.companies[0].cash, r = applyCommand(s, { by: 0, ...built.cmd });
  assert.ok(r.ok, r.err);
  assert.equal(cash0 - s.companies[0].cash, r.cost);
  assert.equal(r.ids.length, 3);
  assert.equal(r.trains.length, plan.nd.trains);
  const tr = s.trains.find((q) => q.id === r.trains[0]);
  assert.deepEqual(tr.route, r.ids, 'ruta folosește id-urile reale ale gărilor noi');
  assert.deepEqual(tr.orders.map((o) => o.drop.m), ['demand', 'demand', 'all']);
  for (let i = 0; i < 300 * 8; i++) { stepWorld(s); b.pop = 640; a.pop = 1280; b.level = a.level = 0; }
  assert.ok(s.stats.del[FOOD] > 20, `livrat ${s.stats.del[FOOD]}`);
});

test('executePlan cu bani puțini sau plan stricat: nu se schimbă nimic și rezultatul spune motivul', () => {
  const { s, a, near } = world();
  s.companies[0].cash = 2500;
  const plan = buildPlan(s, req(s, [near, a])), h0 = hashState(s), cash = s.companies[0].cash;
  const r = exec1(s, plan);
  assert.ok(!r.ok && r.err === 'bani', r.err);
  assert.equal(hashState(s), h0, 'lumea e neschimbată');
  assert.equal(s.companies[0].cash, cash);
  assert.equal(s.stations.length + s.trains.length, 0);
  const rr = runPlan(plan, (cmd) => applyCommand(s, { by: 0, ...cmd }));
  assert.ok(!rr.ok && rr.none && rr.steps.filter((q) => q.err === 'Nu ai destui bani încă!').length === 1);
  // gara se construiește, dar trenul n-are bani: totul se anulează, inclusiv gara
  s.companies[0].cash = 1500 + 200;
  const half = { type: 'executePlan', by: 0, plan: { st: [[10, 10, 0, 0], [20, 10, 0, 0]], tk: [encodePath([[10, 10], [11, 10], [12, 10]])], tr: [{ m: 3, k: [0], r: [{ new: 0 }, { new: 1 }] }] } };
  const h1 = hashState(s), q = applyCommand(s, half);
  assert.ok(!q.ok, 'nu ajung banii');
  assert.equal(hashState(s), h1, 'nici gările făcute înainte de eroare nu rămân');
  const noRef = { type: 'executePlan', by: 0, plan: { st: [], tk: [], tr: [{ m: 3, k: [0], r: [{ new: 0 }] }] } };
  assert.equal(applyCommand(s, noRef).err, 'drum');
  assert.equal(hashState(s), h1);
});

test('mesajul executePlan încape sub 4 KB chiar pentru trasee foarte lungi', () => {
  const stair = [[2, 2]];
  for (let i = 0; i < 400; i++) { const l = stair[stair.length - 1]; stair.push(i % 2 ? [l[0] + 1, l[1]] : [l[0] + 1, l[1] + 1]); } // cel mai rău caz: direcția se schimbă la fiecare placă
  const e = encodePath(stair), long = encodePath(Array.from({ length: 900 }, (_, i) => [2 + i, 5]));
  assert.equal(e.d.length, 400);
  assert.ok(long.d.length < 8, long.d);
  assert.deepEqual(decodePath(e.x, e.y, e.d), stair);
  const cmd = { type: 'executePlan', plan: { st: [[2, 2, 1, 0], [402, 202, 1, 0]], tk: [e, e], tr: [{ m: 3, k: [0, 0, 1], r: [{ new: 0 }, { new: 1 }], n: 2, o: [{ load: [3], unload: null, drop: { m: 'demand' } }, { load: [3], unload: null, drop: { m: 'all' } }] }] } };
  const len = JSON.stringify(wire(cmd)).length;
  assert.ok(len < 3000, `mesaj ${len} B`);
  // pe o hartă plată: un traseu real lung (șerpuit, ~700 de plăci) se aplică dintr-o comandă
  const { s } = world();
  s.companies[0].cash = 1e7;
  const snake = [];
  for (let r = 0; r < 12; r++) {
    for (let q = 0; q < 55; q++) snake.push([3 + (r % 2 ? 54 - q : q), 20 + r * 3]);
    if (r < 11) { const x = 3 + (r % 2 ? 0 : 54); snake.push([x, 21 + r * 3], [x, 22 + r * 3]); }
  }
  const enc = encodePath(snake), last = snake[snake.length - 1];
  const big = { type: 'executePlan', by: 0, plan: { st: [[snake[0][0], snake[0][1], 1, 0], [last[0], last[1], 1, 0]], tk: [enc], tr: [{ m: 3, k: [0, 0, 1], r: [{ new: 0 }, { new: 1 }] }] } };
  assert.ok(JSON.stringify(big).length < 3000);
  const r = applyCommand(s, big);
  assert.ok(r.ok, r.err + ' pas ' + r.step);
  assert.equal(s.trains.length, 1);
});

test('executePlan în competitiv: gările altuia nu se pot folosi', () => {
  const cfg = { mode: 'comp', seed: 7, size: 'S', year: 1950, players: PL.slice(0, 2) };
  const s = createNetWorld(cfg);
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  const mine = { type: 'executePlan', plan: { st: [[10, 10, 1, 0], [30, 10, 1, 0]], tk: [encodePath(Array.from({ length: 21 }, (_, i) => [10 + i, 10]))], tr: [{ m: 3, k: [0, 0, 1], r: [{ new: 0 }, { new: 1 }] }] } };
  const r = applyCommand(s, { by: 0, ...mine });
  assert.ok(r.ok, r.err);
  const h0 = hashState(s);
  const steal = { type: 'executePlan', by: 1, plan: { st: [], tk: [], tr: [{ m: 3, k: [0, 0, 1], r: r.ids }] } };
  assert.equal(applyCommand(s, steal).err, 'gara');
  const up = { type: 'executePlan', by: 1, plan: { st: [], tk: [], up: [[r.ids[0], 0]], tr: [{ m: 3, k: [0], r: [{ new: 0 }] }] } };
  assert.ok(!applyCommand(s, up).ok);
  const onTheirs = { type: 'executePlan', by: 1, plan: { st: [[12, 10, 0, 0]], tk: [], tr: [{ m: 3, k: [0], r: [{ new: 0 }, { new: 0 }] }] } };
  assert.ok(!applyCommand(s, onTheirs).ok, 'nici gară pe șina altuia');
  assert.equal(hashState(s), h0, 'refuzurile nu schimbă nimic');
});

test('executePlan în lockstep cu 3 clienți: hash-uri identice și trenul există la toți', async () => {
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1950, players: PL };
  const w = createNetWorld(cfg);
  let cmd = null;
  const near = (c) => {
    for (let r = 2; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy, i = y * w.w + x;
      if (x > 2 && y > 2 && x < w.w - 3 && y < w.h - 3 && !w.occ[i] && !w.water[i] && w.height[i] > 3 && !w.roads[i] && !(w.track[i] & T_PRESENT)) return { x, y };
    }
    return null;
  };
  const cs = w.cities.slice().sort((p, q) => p.id - q.id);
  for (let i = 0; i < cs.length && !cmd; i++) for (let j = i + 1; j < cs.length && !cmd; j++) {
    const a = near(cs[i]), b = near(cs[j]), p = a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 10 ? planTrack(w, [a.x, a.y], [b.x, b.y], 0) : null;
    if (!p || p.cost > 40000) continue;
    const c = { type: 'executePlan', plan: { st: [[a.x, a.y, 1, 0], [b.x, b.y, 1, 0]], tk: [encodePath(p.path)], tr: [{ m: 3, k: [0, 0, 1], r: [{ new: 0 }, { new: 1 }] }] } };
    if (applyCommand(createNetWorld(cfg), { by: 0, ...c }).ok) cmd = c;
  }
  assert.ok(cmd, 'nu s-a găsit un plan');
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: createNetWorld(cfg), hostId: 'a', speed: 4 }));
  await hub.run(2);
  assert.ok(nodes[1].submit(cmd).ok);
  let k = 0;
  while (nodes[0].world.tick < 1500 && k++ < 2000) await hub.run(0.05);
  nodes[0].setSpeed(0);
  await hub.run(3);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((x) => x === hs[0]), 'hash-uri diferite: ' + hs + ' / ' + nodes.map((n) => n.world.tick));
  assert.ok(nodes.every((n) => n.world.trains.length === 1 && n.world.stations.length === 2 && n.world.trains[0].route.join() === n.world.stations.map((q) => q.id).join()));
  assert.ok(hub.maxLen < 4096, `mesaj maxim ${hub.maxLen}`);
});

test('executePlan: nivelările șinei (f) se recalculează în sim, fără să încarce mesajul', () => {
  const mk = () => { const { s } = world(); for (let x = 10; x <= 24; x++) s.height[30 * s.w + x] = x % 2 ? 13 : 5; return s; };
  const path = Array.from({ length: 15 }, (_, i) => [10 + i, 30]), e = encodePath(path);
  const cmd = (f) => ({ type: 'executePlan', by: 0, plan: { st: [[10, 30, 0, 0], [24, 30, 0, 0]], tk: [f ? { ...e, f: 1 } : e], tr: [{ m: 3, k: [0], r: [{ new: 0 }, { new: 1 }] }] } });
  const a = mk(), h0 = hashState(a), r0 = applyCommand(a, cmd(false));
  assert.ok(!r0.ok && hashState(a) === h0, 'fără nivelare panta e prea mare: nimic nu se schimbă');
  const b = mk(), r1 = applyCommand(b, cmd(true));
  assert.ok(r1.ok, r1.err + ' ' + r1.step);
  assert.equal(b.trains.length, 1);
});
