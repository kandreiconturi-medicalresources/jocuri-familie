import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommand, planTrack, stepWorld, hashState, serialize, deserialize, INDUSTRIES, T_BRIDGE, T_PRESENT,
  SCENARIOS, scenarioById, createScenarioWorld, createFreeWorld, evaluate, checkScenario, loadMedals, recordMedal, isUnlocked,
} from '../games/trenuri/src/sim/index.js';

// ---------- bot de test: comenzi deterministe, fără nimic aleator ----------
const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));
const idx = (s, x, y) => y * s.w + x;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const stOf = (s, id) => s.stations.find((q) => q.id === id);

/** Cea mai apropiată placă liberă de (ax,ay), în inele crescătoare; ordine fixă. */
function spot(s, a, maxR = 4) {
  for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = a.x + dx, y = a.y + dy;
    if (x < 3 || y < 3 || x >= s.w - 3 || y >= s.h - 3) continue;
    const i = idx(s, x, y);
    if (s.occ[i] || s.water[i] || s.height[i] <= 3 || s.roads[i] || (s.track[i] & T_PRESENT) || s.stations.some((q) => q.x === x && q.y === y)) continue;
    return { x, y };
  }
  return null;
}
function station(s, a, maxR) {
  const p = spot(s, a, maxR);
  if (!p) return null;
  const r = applyCommand(s, { type: 'buildStation', by: 0, x: p.x, y: p.y, size: 1 });
  return r.ok ? r.id : null;
}
/** Leagă două gări cu șină; întoarce costul sau -1. */
function link(s, ia, ib) {
  const a = stOf(s, ia), b = stOf(s, ib), p = planTrack(s, [a.x, a.y], [b.x, b.y], 0);
  if (!p || p.cost > s.companies[0].cash) return -1;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }));
  return p.cost;
}
function train(s, model, kinds, route) {
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model, stationId: route[0], kinds }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route }));
}
/** Oraș + gară + legătură: perechi de orașe sortate după costul real al șinei. */
function cityPairs(s, wantBridge) {
  const out = [];
  for (const a of s.cities) for (const b of s.cities) {
    if (a.id >= b.id || cheb(a, b) < 10) continue;
    const p = planTrack(s, [a.x, a.y], [b.x, b.y], 0);
    if (!p) continue;
    const br = p.path.filter(([x, y]) => s.water[idx(s, x, y)]).length;
    if (wantBridge && !br) continue;
    out.push({ a, b, cost: p.cost, br });
  }
  return out.sort((p, q) => p.cost - q.cost || p.a.id - q.a.id || p.b.id - q.b.id);
}
const first = (s, key) => s.industries.find((o) => o.type === T[key]);
function pairLine(s, A, B, model, kinds) {
  const ia = station(s, A), ib = station(s, B);
  assert.ok(ia && ib, 'gări');
  assert.ok(link(s, ia, ib) >= 0, 'șină');
  train(s, model, kinds, [ia, ib]);
  return [ia, ib];
}
/** Rulează luna cu luna până la bronz sau termen; la fiecare 6 luni mai adaugă un tren (reinvestire). */
function play(s, extra) {
  for (let m = 0; m < 12 * 12 && s.scn.best < 1 && !s.scn.done; m++) {
    for (let i = 0; i < 300; i++) stepWorld(s);
    if (extra && m % 6 === 5) extra(s);
  }
  return s;
}

const BOTS = {
  primul: (s) => { const p = cityPairs(s)[0]; pairLine(s, p.a, p.b, 2, [0, 0, 0]); },
  posta: (s) => { const p = cityPairs(s)[0]; pairLine(s, p.a, p.b, 2, [1, 1, 1]); },
  carbune: (s) => { pairLine(s, first(s, 'mincarb'), first(s, 'otelarie'), 2, [3, 3, 3]); },
  sat: (s) => { const p = cityPairs(s)[0]; pairLine(s, p.a, p.b, 2, [0, 0, 1]); },
  paine: (s) => {
    const farm = first(s, 'ferma'), fab = first(s, 'fabmanc');
    const city = [...s.cities].sort((a, b) => cheb(a, fab) - cheb(b, fab))[0];
    const [, ib] = pairLine(s, farm, fab, 2, [2, 2, 2]);
    const ic = station(s, city, 2);
    assert.ok(ic && link(s, ib, ic) >= 0, 'oraș');
    train(s, 2, [6, 6, 6], [ib, ic]);
  },
  munti: (s) => { const p = cityPairs(s, true)[0]; assert.ok(p, 'pod necesar'); pairLine(s, p.a, p.b, 2, [0, 0, 1]); },
  retea: (s) => { // arbore de acoperire (Prim) peste 4 orașe apropiate; un tren pe fiecare legătură
    const ids = new Map(), pairs = cityPairs(s);
    const get = (c) => { if (!ids.has(c.id)) ids.set(c.id, station(s, c, 2)); return ids.get(c.id); };
    const used = new Set([pairs[0].a.id]);
    while (used.size < 4) {
      const e = pairs.find((p) => used.has(p.a.id) !== used.has(p.b.id) && p.cost < s.companies[0].cash / 4);
      assert.ok(e, 'rețea');
      const ia = get(e.a), ib = get(e.b);
      assert.ok(link(s, ia, ib) >= 0);
      train(s, 2, [0, 0, 1], [ia, ib]);
      used.add(e.a.id); used.add(e.b.id);
    }
  },
  metropola: (s) => { const p = cityPairs(s)[0]; pairLine(s, p.a, p.b, 3, [0, 0, 1, 1]); },
};

for (const sc of SCENARIOS) {
  test(`scenariu „${sc.name}”: botul ia cel puțin bronz înainte de termen`, () => {
    const s = createScenarioWorld(sc);
    BOTS[sc.id](s);
    const t0 = s.date.y;
    play(s, (w) => { const c = w.companies[0].cash; if (c > 40000 && w.trains.length) { const t = w.trains[0]; applyCommand(w, { type: 'buyTrain', by: 0, model: t.model, kinds: t.kinds, stationId: t.route[0] }); const n = w.trains[w.trains.length - 1]; applyCommand(w, { type: 'setRoute', by: 0, trainId: n.id, route: t.route }); } });
    const ev = evaluate(s, sc);
    console.log(`  ${sc.id}: medalie ${ev.medal}, valori ${ev.goals.map((g) => g.value)}, ani ${s.date.y - t0}/${sc.years}`);
    assert.ok(s.scn.best >= 1, 'bronz');
    assert.ok(s.date.y < s.scn.end || s.scn.best >= 1);
  });
}

// ---------- obiective, medalii, determinism ----------
test('scenariile: 8, cu hartă fixă, deterministe, dificultate crescătoare', () => {
  assert.equal(SCENARIOS.length, 8);
  assert.equal(new Set(SCENARIOS.map((q) => q.id)).size, 8);
  for (const sc of SCENARIOS) {
    assert.ok(sc.story.length > 20 && sc.year >= 1840 && sc.years > 0 && sc.cash > 0);
    for (const g of sc.goals) assert.ok(g.t[0] < g.t[1] && g.t[1] < g.t[2], 'bronz < argint < aur');
    assert.equal(hashState(createScenarioWorld(sc)), hashState(createScenarioWorld(sc)));
  }
  assert.ok(SCENARIOS[7].years > SCENARIOS[0].years && SCENARIOS[7].cash > SCENARIOS[0].cash);
});

test('obiectivele se evaluează corect și lunar', () => {
  const sc = scenarioById('primul'), s = createScenarioWorld(sc);
  assert.equal(evaluate(s, sc).medal, 0);
  s.stats.del[0] = 99; assert.equal(evaluate(s, sc).medal, 0);
  s.stats.del[0] = 100; assert.equal(evaluate(s, sc).medal, 1);
  s.stats.del[0] = 1500; assert.equal(evaluate(s, sc).medal, 2);
  s.stats.del[0] = 5000; assert.equal(evaluate(s, sc).medal, 3);
  const s2 = createScenarioWorld(sc);
  s2.stats.del[0] = 120;
  for (let i = 0; i < 299; i++) stepWorld(s2);
  assert.equal(s2.scn.best, 0, 'nu se verifică înainte de sfârșit de lună');
  stepWorld(s2);
  assert.equal(s2.scn.best, 1, 'la sfârșit de lună apare bronzul');
  assert.ok(!s2.scn.done);
  s2.stats.del[0] = 6000; for (let i = 0; i < 300; i++) stepWorld(s2);
  assert.ok(s2.scn.best === 3 && s2.scn.done, 'aurul încheie scenariul');
});

test('două obiective: medalia e cea mai mică; termenul închide scenariul', () => {
  const sc = scenarioById('munti'), s = createScenarioWorld(sc);
  s.stats.del[0] = 1200;
  assert.equal(evaluate(s, sc).medal, 0, 'fără poduri nu e medalie');
  s.track[0] = T_PRESENT | T_BRIDGE; s.track[1] = T_PRESENT | T_BRIDGE; s.track[2] = T_PRESENT | T_BRIDGE;
  assert.equal(evaluate(s, sc).medal, 2);
  const t = createScenarioWorld(scenarioById('posta'));
  t.date.y = t.scn.end - 1; t.date.m = 12; t.date.d = 30;
  for (let i = 0; i < 20; i++) stepWorld(t);
  assert.ok(t.scn.done && t.scn.best === 0, 'termen fără medalie');
});

test('medaliile se salvează (doar cele mai bune) și deblochează scenariile pe rând', () => {
  const mem = {}, save = { get: (k, d) => (k in mem ? JSON.parse(mem[k]) : d), set: (k, v) => { mem[k] = JSON.stringify(v); return true; } };
  assert.deepEqual(loadMedals(save), {});
  assert.ok(isUnlocked({}, 0) && !isUnlocked({}, 1));
  assert.ok(recordMedal(save, 'primul', 2));
  assert.ok(!recordMedal(save, 'primul', 1), 'nu se coboară');
  assert.ok(recordMedal(save, 'primul', 3));
  assert.equal(loadMedals(save).primul, 3);
  assert.ok(isUnlocked(loadMedals(save), 1) && !isUnlocked(loadMedals(save), 2));
});

test('progresul scenariului și statisticile se salvează cu starea; construcția liberă nu are termen', () => {
  const s = createScenarioWorld(SCENARIOS[0]);
  s.stats.del[0] = 7; s.scn.best = 1;
  const r = deserialize(serialize(s));
  assert.equal(r.stats.del[0], 7); assert.equal(r.scn.best, 1); assert.equal(hashState(r), hashState(s));
  const f = createFreeWorld(5);
  assert.ok(f.sandbox && !f.scn && f.date.y >= 1970);
  checkScenario(f);
});

// ---------- Ajutorul: sfaturi pe starea jocului ----------
import { findTip } from '../games/trenuri/src/ui/tips.js';

test('Ajutorul: sfat pentru tren fără rută, locomotivă nouă și oraș care cere marfă', () => {
  const s = createScenarioWorld(SCENARIOS[4]);
  assert.equal(findTip(s, new Set(), 0), null, 'la început nu are ce spune');
  assert.equal(findTip(s, new Set(), 60).key, 'nostation');
  const c = s.cities[0], st = ok(applyCommand(s, { type: 'buildStation', by: 0, ...spot(s, c, 4), size: 1 }));
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 0, stationId: st.id }));
  assert.match(findTip(s, new Set(), 0).text, /stă degeaba/);
  assert.equal(findTip(s, new Set([`idle:${t.id}`]), 0).key.startsWith('loco:'), true, 'bani pentru locomotivă mai bună');
  const shown = new Set([`idle:${t.id}`, 'loco:2']);
  const w = findTip(s, shown, 0);
  assert.ok(!w || /vrea/.test(w.text) || w.key === 'second');
  const f = createFreeWorld(3);
  assert.ok(!findTip(f, new Set(), 0) || !/locomotivă nouă/.test(findTip(f, new Set(), 0).text), 'în construcție liberă nu se vorbește de bani');
});
