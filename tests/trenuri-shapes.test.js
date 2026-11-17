// Forme de șină (buildShape) și rutare inteligentă: trenul ia imediat linia liberă când blocul din față e ținut de alt tren.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, SHAPES, shapePlan, waitReason, SIG_ALT, T_PRESENT } from '../games/trenuri/src/sim/index.js';
import { ok, flat, station, track, buy, tile, watch } from './trenuri-sig-helpers.js';
import { linkCount } from '../games/trenuri/src/sim/blocks.js';
import { hold } from '../games/trenuri/src/sim/reserve.js';
import { createHub } from './trenuri-hub.js';
import { wire, unwire, ALLOWED } from '../games/trenuri/src/net/wire.js';

const K = (key) => SHAPES.findIndex((q) => q.key === key);
const shape = (s, key, x, y, rot = 0, flip = false) => applyCommand(s, { type: 'buildShape', by: 0, kind: K(key), x, y, rot, flip });

/** Linie A (6,20) — B (40,20) cu stația de încrucișare pusă ca formă la mijloc (firul al doilea pe y = 21). */
function loopLine(s) {
  const a = station(s, 6, 20), b = station(s, 40, 20);
  track(s, [6, 20], [40, 20]);
  ok(shape(s, 'loop', 23, 20));
  return [a, b];
}

test('buildShape: costul previzualizat = banii cheltuiți; macazuri și semnale automate; rotire; refuz pe casă', () => {
  const s = flat();
  track(s, [6, 20], [40, 20]);
  const plan = shapePlan(s, { kind: K('loop'), x: 23, y: 20, rot: 0 }, 0), cash = s.companies[0].cash;
  assert.ok(plan.ok && plan.cost > 0);
  const r = ok(shape(s, 'loop', 23, 20));
  assert.equal(r.cost, plan.cost);
  assert.equal(s.companies[0].cash, cash - plan.cost);
  for (const x of [17, 29]) assert.ok(linkCount(s.track[tile(s, x, 20)]) >= 3, 'macaz la ' + x);
  for (let x = 18; x <= 28; x++) assert.ok(s.track[tile(s, x, 21)] & T_PRESENT, 'firul al doilea');
  assert.ok(s.signals.some((g) => g.auto && g.x === 17 && g.y === 20) && s.signals.some((g) => g.auto && g.x === 29 && g.y === 20));
  // rotit cu 90°: linia principală devine verticală
  const v = shapePlan(s, { kind: K('double'), x: 50, y: 30, rot: 1 }, 0);
  assert.ok(v.ok);
  assert.ok(v.paths[0].every(([x]) => x === 50) && v.paths[1].every(([x]) => x === 49));
  assert.equal(v.sigs.length, 2, 'semnale de bloc pe linia dublă');
  const n = s.signals.length;
  ok(applyCommand(s, { type: 'buildShape', by: 0, kind: K('double'), x: 50, y: 30, rot: 1 }));
  assert.equal(s.signals.filter((g) => !g.auto).length, 2);
  assert.ok(s.signals.length >= n + 2);
  for (const key of ['cross', 'wye', 'bypass']) assert.ok(shapePlan(s, { kind: K(key), x: 30, y: 45, rot: 2, flip: true }, 0).ok, key);
  s.occ[tile(s, 12, 50)] = 1;
  assert.equal(shape(s, 'loop', 12, 50).err, 'cladire');
  assert.ok(!shape(s, 'loop', 1, 1).ok, 'în afara hărții');
  // fără semnale automate, forma își pune singură semnale la macaze
  ok(applyCommand(s, { type: 'setAutoSignals', by: 0, on: false }));
  const p2 = shapePlan(s, { kind: K('wye'), x: 30, y: 45 }, 0);
  assert.ok(p2.ok && p2.sigs.length >= 9, 'semnale la cele 3 macaze: ' + p2.sigs.length);
  // pe fir: comanda e mică și permisă
  const cmd = { type: 'buildShape', kind: 0, x: 3, y: 4, rot: 1, flip: true };
  assert.ok(ALLOWED.has('buildShape'));
  assert.deepEqual(unwire(wire(cmd)), cmd);
});

test('două trenuri opuse pe stația de încrucișare (formă): se depășesc fără să se întoarcă și fără timeout', () => {
  const s = flat();
  const [a, b] = loopLine(s);
  const t1 = buy(s, 3, a, [a, b]), t2 = buy(s, 3, b, [b, a]);
  let side = 0;
  const hmax = [0, 0];
  const r = watch(s, [t1, t2], 5000, (w) => {
    [t1, t2].forEach((t, k) => { if (t.redAt) hmax[k] = Math.max(hmax[k], t.hold); if (t.state === 1 && t.path.includes(tile(w, 23, 21))) side = 1; });
  });
  assert.equal(r.clash, 0, 'două trenuri pe aceeași placă');
  assert.ok(side, 'unul a luat firul al doilea');
  for (let k = 0; k < 2; k++) assert.ok(r.seen[k].has(a) && r.seen[k].has(b) && r.count[k] >= 6, `trenul ${k}: ${r.count[k]} sosiri`);
  assert.ok(!s.news.some((n) => /se întoarce/.test(n.text)), 'niciun tren nu s-a întors');
  assert.ok(Math.max(...hmax) < SIG_ALT, 'n-au așteptat timeout-ul la roșu: ' + hmax);
});

test('trenul oprit la roșu de blocul ținut de alt tren ia imediat firul paralel liber', () => {
  const s = flat();
  const [a, b] = loopLine(s);
  const t1 = buy(s, 3, a, [a, b]); t1.paused = 1; // stă în gara A; mai jos îi dăm firul drept (ca un tren stricat care își ține rezervarea)
  const t2 = buy(s, 3, a, [a, b]);
  let k = 0;
  while (!(t2.state === 1 && t2.seg >= 2) && k++ < 400) stepWorld(s);
  assert.ok(t2.path.includes(tile(s, 23, 20)), 'pornește pe firul drept');
  for (let x = 18; x <= 28; x++) hold(s, t1, tile(s, x, 20));
  let hmax = 0, why = null, red = null;
  for (k = 0; k < 3000 && !(t2.state === 2 && t2.to === b); k++) {
    stepWorld(s);
    if (t2.state === 1 && t2.speed === 0) hmax = Math.max(hmax, t2.hold);
    if (!why && t2.rr) why = waitReason(s, t2);
  }
  assert.equal(t2.to, b); assert.equal(t2.state, 2, 'al doilea a ajuns');
  assert.ok(t2.path.includes(tile(s, 23, 21)) && !t2.path.includes(tile(s, 23, 20)), 'pe firul al doilea');
  assert.ok(hmax < SIG_ALT, 'fără timeout: ' + hmax);
  assert.equal(why, '🔀 Ocolește pe linia liberă');
  // motivul așteptării la roșu, cu trenul care ține linia
  const t3 = buy(s, 3, a, [a, b]);
  for (let x = 18; x <= 28; x++) hold(s, t1, tile(s, x, 21));
  for (k = 0; k < 600 && !(t3.redAt && t3.hold >= 3); k++) stepWorld(s);
  red = waitReason(s, t3);
  assert.ok(t3.redAt && /Așteaptă la semnal/.test(red) && red.includes(`trenul ${t1.id}`), red);
});

const scenario = (s) => {
  const [a, b] = loopLine(s);
  ok(shape(s, 'cross', 12, 30));
  buy(s, 3, a, [a, b]); buy(s, 2, b, [b, a]); buy(s, 3, a, [a, b], [0, 1]);
};

test('determinism cu forme și ocoliri: același hash, și după serializare în mijloc', () => {
  const go = (save) => {
    let s = flat(); scenario(s);
    for (let i = 0; i < 4000; i++) {
      if (save && i === 1555) s = deserialize(JSON.parse(JSON.stringify(serialize(s))));
      if (i % 10 === 0) for (const st of s.stations) st.waiting.pass = 50;
      stepWorld(s);
    }
    return s;
  };
  const x = go(false), y = go(true), z = go(false);
  assert.equal(hashState(x), hashState(z));
  assert.equal(hashState(x), hashState(y));
  assert.ok(x.trains.every((t) => t.money > 0), 'toate trenurile au livrat');
});

test('lockstep: 3 noduri cu buildShape și trenuri care se încrucișează rămân cu același hash', async () => {
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1950, players: PL };
  const mk = () => { const s = createNetWorld(cfg); s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0); s.industries.length = 0; s.cities.forEach((c, i) => { c.x = 2 + i; c.y = 62; c.buildings = []; }); return s; };
  const probe = mk();
  const sa = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 6, y: 20, size: 1 })).id, sb = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 40, y: 20, size: 1 })).id;
  const path = planTrack(probe, [6, 20], [40, 20], 0).path;
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: mk(), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(1); n1.submit({ type: 'buildStation', x: 6, y: 20, size: 1 });
  await hub.run(0.5); n2.submit({ type: 'buildStation', x: 40, y: 20, size: 1 });
  await hub.run(0.5); n3.submit({ type: 'buildTrack', path });
  await hub.run(0.5); n1.submit({ type: 'buildShape', kind: K('loop'), x: 23, y: 20, rot: 0 });
  await hub.run(0.5); n2.submit({ type: 'buyTrain', model: 3, kinds: [0, 0], stationId: sa, route: [sa, sb] });
  await hub.run(0.3); n3.submit({ type: 'buyTrain', model: 3, kinds: [0, 1], stationId: sb, route: [sb, sa] });
  let k = 0;
  while (n1.world.tick < 3000 && k++ < 4000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  const w = n1.world;
  assert.ok(w.track[21 * w.w + 23] & T_PRESENT, 'forma construită în rețea');
  assert.equal(w.trains.length, 2);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  assert.ok(nodes.every((n) => n.stats.resyncs === 0), 'fără resincronizări');
});
