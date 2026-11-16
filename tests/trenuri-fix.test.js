import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetWorld } from '../games/trenuri/src/sim/index.js';
import { createHub } from './trenuri-hub.js';
import {
  createWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, INDUSTRIES, NG, MODELS, UPGRADES, WORKSHOP,
  industryAdvice, trainAdvice, suggestKinds, relOf, parallelPlan, trackSection, switches, computeTodos,
} from '../games/trenuri/src/sim/index.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };

function flat(year = 1950, extra = {}) {
  const s = createWorld({ seed: 4, size: 'S', year, ...extra });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0;
  return s;
}
function addInd(s, key, x, y) {
  const o = { id: s.industries.length, type: T[key], x, y, name: key, in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  s.industries.push(o); s.occ[y * s.w + x] = 1;
  return o;
}
const station = (s, x, y, size = 1) => ok(applyCommand(s, { type: 'buildStation', by: 0, x, y, size })).id;
const track = (s, a, b) => ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, a, b, 0).path }));

test('sondă → rafinărie → oraș: tren automat cu vagoanele propuse livrează combustibil', () => {
  const s = flat();
  const sonda = addInd(s, 'sonda', 6, 30), raf = addInd(s, 'rafinarie', 30, 30);
  const c = s.cities[0]; c.x = 56; c.y = 30; c.pop = 3000; c.level = 2; c.buildings = [];
  const A = station(s, 8, 30), B = station(s, 28, 30), C = station(s, 54, 30);
  track(s, [8, 30], [54, 30]);
  assert.deepEqual(suggestKinds(s, [A, B, C]).filter((k) => k !== 5), [], 'propune cisterne');
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, route: [A, B, C] })); // fără kinds: vagoane potrivite
  const tr = s.trains.find((q) => q.id === t.id);
  assert.ok(tr.kinds.every((k) => k === 5));
  run(s, 12000);
  assert.ok(raf.made > 100, 'rafinăria a produs: ' + raf.made);
  assert.ok(sonda.made > 0 && c.prev[13] + c.got[13] > 0, 'orașul a primit combustibil');
  assert.ok(tr.money > 0);
});

test('cu vagoane de pasageri marfa nu pleacă, iar UI-ul spune de ce', () => {
  const s = flat();
  const sonda = addInd(s, 'sonda', 6, 30), raf = addInd(s, 'rafinarie', 30, 30);
  const A = station(s, 8, 30), B = station(s, 28, 30);
  track(s, [8, 30], [28, 30]);
  const adv = industryAdvice(s, raf);
  assert.ok(!adv.ok && /nevoie de petrol/.test(adv.lines[0]) && adv.lines[1].includes(sonda.name));
  assert.ok(adv.lines.join(' ').includes('Cumpără un tren') && adv.goto.x === sonda.x);
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, kinds: [0, 0, 1], route: [A, B] }));
  const tr = s.trains.find((q) => q.id === t.id);
  run(s, 3000);
  assert.equal(raf.made, 0);
  assert.ok(industryAdvice(s, raf).lines.join(' ').includes(`Trenul ${tr.id} nu are vagoane de cisternă`));
  assert.ok(trainAdvice(s, tr).some((l) => /Nu are vagoane de cisternă/.test(l)), trainAdvice(s, tr).join('|'));
});

test('ramificația din mijlocul unei șine creează macaz și trenurile o folosesc', () => {
  const s = flat();
  const A = station(s, 10, 30, 0);
  station(s, 40, 30, 0);
  track(s, [10, 30], [40, 30]);
  assert.equal(switches(s).length, 0);
  const C = station(s, 25, 45, 0);
  track(s, [25, 30], [25, 45]); // pornește din mijlocul șinei
  assert.deepEqual(switches(s), [[25, 30]]);
  const t1 = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, route: [A, C] }));
  const tr = s.trains.find((q) => q.id === t1.id);
  let used = false, arrived = false;
  for (let i = 0; i < 1800 && !arrived; i++) { stepWorld(s); if (tr.state === 1 && tr.path.includes(30 * s.w + 25)) used = true; if (tr.state === 2 && tr.to === C) arrived = true; }
  assert.ok(arrived, 'a ajuns pe ramificație');
  assert.ok(used, 'a trecut prin macaz');
});

test('linia dublă: două trenuri în sensuri opuse nu așteaptă', () => {
  const play = (double) => {
    const s = flat();
    const A = station(s, 10, 31, 0), B = station(s, 50, 31, 0);
    track(s, [10, 31], [50, 31]);
    if (double) {
      const sec = trackSection(s, [10, 31], [50, 31]);
      const p = parallelPlan(s, sec, 1, 0);
      assert.ok(p, 'plan paralel');
      assert.ok(p.path.slice(1, -1).every(([, y]) => y === 32), 'la o placă distanță');
      ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }));
      assert.equal(switches(s).length, 2, 'macazuri la capete');
    }
    ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, route: [A, B] }));
    ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: B, route: [B, A] }));
    let waits = 0;
    for (let i = 0; i < 1500; i++) { stepWorld(s); for (const t of s.trains) if (t.state === 1 && t.speed === 0 && t.hold > 0) waits++; }
    return { waits, turns: s.news.filter((n) => n.icon === '↩️').length };
  };
  const one = play(false), two = play(true);
  assert.equal(two.waits, 0, 'fără așteptare pe linie dublă');
  assert.equal(two.turns, 0);
  assert.ok(one.waits > 0 || one.turns > 0, 'pe linie simplă se așteaptă sau se întoarce');
});

test('A* fără refolosire nu trece peste șina existentă', () => {
  const s = flat();
  station(s, 10, 30, 0); station(s, 40, 30, 0);
  track(s, [10, 30], [40, 30]);
  const p = planTrack(s, [10, 30], [40, 30], 0, { reuse: false });
  assert.ok(p && p.path.slice(1, -1).every(([, y]) => y !== 30));
  assert.equal(planTrack(s, [10, 30], [40, 30], 0).cost, 0);
});

test('pauseTrain / resumeTrain: trenul stă în gară și hash-ul e identic între două rulări', () => {
  const play = () => {
    const s = flat();
    const A = station(s, 10, 30, 0), B = station(s, 30, 30, 0);
    track(s, [10, 30], [30, 30]);
    const id = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, route: [A, B] })).id;
    run(s, 200);
    ok(applyCommand(s, { type: 'pauseTrain', by: 0, trainId: id }));
    run(s, 1200);
    const t = s.trains[0], at = t.to;
    assert.equal(t.state, 2, 'oprit în gară');
    run(s, 400);
    assert.ok(t.state === 2 && t.to === at, 'stă în gară');
    ok(applyCommand(s, { type: 'resumeTrain', by: 0, trainId: id }));
    run(s, 600);
    assert.equal(applyCommand(s, { type: 'pauseTrain', by: 0, trainId: 999 }).ok, false);
    return hashState(deserialize(serialize(s)));
  };
  assert.equal(play(), play());
});

test('uzura scade fiabilitatea (blând în simplu, complet în expert) și atelierul o repară', () => {
  const mk = (mode) => {
    const s = flat(1950, { mode });
    const A = station(s, 10, 30, 0), B = station(s, 30, 30, 0);
    track(s, [10, 30], [30, 30]);
    const id = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, route: [A, B] })).id;
    return { s, A, B, t: s.trains.find((q) => q.id === id) };
  };
  const simple = mk('simple'), ex = mk('expert');
  run(simple.s, 10 * 30 * 12 * 2); run(ex.s, 10 * 30 * 12 * 2);
  const full = MODELS[3].rel;
  assert.ok(relOf(simple.t) >= 70 && relOf(simple.t) < full, 'simplu blând: ' + relOf(simple.t));
  assert.ok(relOf(ex.t) < relOf(simple.t) && relOf(ex.t) >= 30, 'expert complet: ' + relOf(ex.t));
  ok(applyCommand(ex.s, { type: 'buildUpgrade', by: 0, stationId: ex.B, kind: WORKSHOP }));
  assert.equal(UPGRADES[WORKSHOP].key, 'shop');
  for (let i = 0; i < 2000 && !(ex.t.state === 2 && ex.t.to === ex.B); i++) stepWorld(ex.s);
  assert.equal(relOf(ex.t), full, 'atelierul a reparat trenul care a oprit acolo');
  const broken = (st) => { let n = 0; for (let i = 0; i < 6000; i++) { stepWorld(st.s); if (st.t.broken > 0) n++; } return n; };
  const worn = mk('expert'); worn.t.rel = 30;
  assert.ok(broken(worn) > broken(mk('expert')), 'uzat se strică mai des');
});

test('lista „De făcut”: tren fără rută și marfă fără tren', () => {
  const s = flat();
  addInd(s, 'mincarb', 10, 40);
  const A = station(s, 12, 40, 0), B = station(s, 30, 40, 0);
  track(s, [12, 40], [30, 40]);
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A })).id;
  s.stations[0].cargo[6] = 40;
  const items = computeTodos(s, 0);
  assert.ok(items.some((i) => i.kind === 'train' && i.ref.id === t && i.icon === '❗'));
  assert.ok(items.some((i) => i.kind === 'cargo' && i.icon === '📦'));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t, route: [A, B] }));
  const after = computeTodos(s, 0);
  assert.ok(!after.some((i) => i.kind === 'cargo') && !after.some((i) => i.kind === 'train'));
});

test('pauseTrain / resumeTrain în lockstep: 3 noduri ajung la același hash', async () => {
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1950, players: PL };
  const mk = () => { const w = createNetWorld(cfg); w.height.fill(8); w.water.fill(0); w.forest.fill(0); w.occ.fill(0); w.roads.fill(0); w.industries.length = 0; return w; };
  const probe = mk();
  const sa = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 10, y: 30, size: 0 })).id, sb = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 40, y: 30, size: 0 })).id;
  const path = planTrack(probe, [10, 30], [40, 30], 0).path, trainId = probe.nextId;
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: mk(), hostId: 'a', speed: 4, raw: false }));
  const [a, b, c] = nodes, host = a;
  await hub.run(1); a.submit({ type: 'buildStation', x: 10, y: 30, size: 0 });
  await hub.run(0.5); b.submit({ type: 'buildStation', x: 40, y: 30, size: 0 });
  await hub.run(0.5); c.submit({ type: 'buildTrack', path });
  await hub.run(0.5); b.submit({ type: 'buyTrain', model: 3, kinds: [0, 0, 1], stationId: sa, route: [sa, sb] });
  await hub.run(8);
  b.submit({ type: 'pauseTrain', trainId }); await hub.run(1.3);
  c.submit({ type: 'pauseTrain', trainId: 9999 }); // refuzat peste tot la fel
  await hub.run(10);
  assert.ok(host.world.trains[0].paused === 1, 'pus pe pauză pe gazdă');
  a.submit({ type: 'resumeTrain', trainId }); await hub.run(6);
  let k = 0;
  while (host.world.tick < 3000 && k++ < 4000) await hub.run(0.05);
  host.setSpeed(0); await hub.run(8);
  const ticks = nodes.map((n) => n.world.tick);
  assert.ok(ticks.every((t) => t === ticks[0]), 'pași diferiți: ' + ticks);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  assert.equal(host.world.trains[0].paused, 0);
});
