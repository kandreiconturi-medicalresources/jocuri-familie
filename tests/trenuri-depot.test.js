// Etapa 6.6, runda 2: depouri (coadă, macara, linii de reparații), defecțiuni, remorcare, semnale de bloc, teren, determinism și lockstep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createWorld, stepWorld, hashState, serialize, deserialize, dirtyChunks, DEPOT } from '../games/trenuri/src/sim/index.js';
import { ok, run, flat, station, track, lane, buy, watch } from './trenuri-sig-helpers.js';
import { createHub } from './trenuri-hub.js';

const cmd = (s, c) => applyCommand(s, { by: 0, ...c });
const SPUR = [[20, 20], [20, 21], [20, 22], [20, 23]];
/** Linie A(8,20)—B(34,20) cu o ramură spre sud de la (20,20) și depou la capătul ei (20,23). */
function yard() {
  const s = flat();
  const a = station(s, 8, 20), b = station(s, 34, 20);
  track(s, [8, 20], [34, 20]);
  lane(s, SPUR);
  const dep = ok(cmd(s, { type: 'buildDepot', x: 20, y: 23 })).id;
  return { s, a, b, d: s.depots.find((q) => q.id === dep) };
}
const feed = (w) => { if (w.tick % 10 === 0) for (const st of w.stations) st.waiting.pass = 100; };
const go = (w) => { feed(w); stepWorld(w); };
const runF = (w, n) => { for (let i = 0; i < n; i++) go(w); };
const breakNow = (t) => { t.dead = 1; t.speed = 0; };
const onLine = (s, t) => { let k = 0; while (!(t.state === 1 && t.seg > 12) && k++ < 3000) go(s); };

test('buildDepot: doar la capăt de linie, plătit; demolarea lui e refuzată', () => {
  const s = flat();
  station(s, 8, 20); station(s, 34, 20); track(s, [8, 20], [34, 20]);
  assert.equal(cmd(s, { type: 'buildDepot', x: 15, y: 20 }).err, 'drum', 'în mijlocul liniei nu');
  assert.equal(cmd(s, { type: 'buildDepot', x: 8, y: 20 }).err, 'gara');
  lane(s, SPUR.slice(0, 3));
  const cash = s.companies[0].cash;
  ok(cmd(s, { type: 'buildDepot', x: 20, y: 22 }));
  assert.equal(cash - s.companies[0].cash, DEPOT.cost);
  assert.equal(s.depots.length, 1);
  assert.equal(cmd(s, { type: 'buildDepot', x: 20, y: 22 }).err, 'gara');
  assert.equal(cmd(s, { type: 'removeTrack', x: 20, y: 22 }).err, 'gara');
});

test('sendToDepot: coadă → lift → repair → lower → ruta reluată', () => {
  const { s, a, b, d } = yard();
  const t = buy(s, 3, a, [a, b]);
  t.rel = 70;
  runF(s, 30);
  ok(cmd(s, { type: 'sendToDepot', trainId: t.id }));
  const seen = [];
  let queued = false, k = 0;
  while (k++ < 4000 && !(seen.length && t.state !== 3 && !d.jobs.length)) {
    go(s);
    if (t.state === 3 && (d.queue.includes(t.id) || d.jobs.length)) queued = true;
    const j = d.jobs[0];
    if (j && seen[seen.length - 1] !== j.phase) seen.push(j.phase);
  }
  assert.ok(queued, 'a stat la coadă');
  assert.deepEqual(seen, ['lift', 'repair', 'lower']);
  assert.ok(t.rel >= 96, 'reparat: ' + t.rel);
  const n = t.money;
  runF(s, 3000);
  assert.ok(t.money > n, 'și-a reluat ruta');
  assert.ok(s.news.some((x) => x.text.includes('reparat la')));
});

test('două linii de reparații, macara unică: al treilea tren așteaptă la coadă', () => {
  const { s, a, b, d } = yard();
  const ts = [0, 1, 2].map(() => buy(s, 3, a, [a, b]));
  ts.forEach((t) => { t.rel = 60; ok(cmd(s, { type: 'sendToDepot', trainId: t.id })); });
  let maxJobs = 0, cranes = 0, queued3 = false;
  for (let i = 0; i < 1500; i++) {
    go(s);
    maxJobs = Math.max(maxJobs, d.jobs.length);
    cranes = Math.max(cranes, d.jobs.filter((j) => j.phase !== 'repair').length);
    if (d.jobs.length === 2 && d.queue.length === 1) queued3 = true;
  }
  assert.equal(maxJobs, 2); assert.equal(cranes, 1); assert.ok(queued3);
});

test('defecțiunea blochează secțiunea; remorca vine, cuplează, duce trenul la depou și secțiunea se eliberează', () => {
  const { s, a, b, d } = yard();
  const t1 = buy(s, 3, a, [a, b]);
  onLine(s, t1);
  breakNow(t1);
  const held = t1.rv.slice();
  assert.ok(held.length > 0 && held.every((i) => s.resv[i] === t1.id + 1), 'ține rezervarea');
  runF(s, 5); // înainte să treacă ziua după care pornește remorcarea automată
  assert.ok(!s.trains.some((q) => q.tow));
  assert.ok(held.every((i) => s.resv[i] === t1.id + 1), 'secțiunea rămâne blocată');
  ok(cmd(s, { type: 'rescueTrain', trainId: t1.id }));
  const tow = s.trains.find((q) => q.tow);
  assert.ok(tow && tow.tow.targetId === t1.id);
  let coupled = false, k = 0;
  while (k++ < 8000 && !t1.dq) { go(s); if (t1.cpl) coupled = true; }
  assert.ok(coupled && t1.dq === d.id, 'cuplat și dus la depou');
  assert.ok(s.news.some((x) => x.text.includes(`Trenul ${t1.id} a fost remorcat la ${d.name}`)), 'ziarul');
  runF(s, 20);
  assert.ok(!s.trains.includes(tow), 'remorca a dispărut din listă');
  assert.ok(held.every((i) => s.resv[i] !== t1.id + 1), 'secțiunea e liberă');
});

test('în modul simplu remorcarea pornește singură după o zi, iar trenul revine în circulație', () => {
  const { s, a, b } = yard();
  const t1 = buy(s, 3, a, [a, b]);
  onLine(s, t1);
  breakNow(t1);
  runF(s, 5);
  assert.ok(!s.trains.some((q) => q.tow));
  runF(s, 12);
  assert.ok(s.trains.some((q) => q.tow), 'remorca a plecat singură');
  const m = t1.money;
  let k = 0;
  while (k++ < 12000 && !(t1.state !== 3 && !t1.dead && t1.money > m)) go(s);
  assert.ok(t1.money > m && !s.trains.some((q) => q.tow), 'reparat și își face ruta');
});

test('convoi în același sens cu blocuri; în sens opus nu intră pe linia ocupată', () => {
  const trips = (blocks) => {
    const s = flat();
    const a = station(s, 6, 30), b = station(s, 44, 30);
    track(s, [6, 30], [44, 30]);
    if (blocks) ok(cmd(s, { type: 'setAutoBlock', n: 6 }));
    const ts = [buy(s, 3, a, [a, b]), buy(s, 3, a, [a, b]), buy(s, 3, a, [a, b])];
    let both = 0;
    const r = watch(s, ts, 2500, (w) => { feed(w); if (ts.filter((t) => t.state === 1).length >= 2) both++; });
    assert.equal(r.clash, 0);
    return both;
  };
  const plain = trips(false), blk = trips(true);
  assert.ok(blk > plain, `blocuri: ${blk} vs ${plain}`);
  const s = flat();
  const a = station(s, 6, 30), b = station(s, 44, 30);
  track(s, [6, 30], [44, 30]);
  ok(cmd(s, { type: 'setAutoBlock', n: 5 }));
  const ts = [buy(s, 3, a, [a, b]), buy(s, 3, a, [a, b]), buy(s, 3, b, [b, a]), buy(s, 3, b, [b, a])];
  const r = watch(s, ts, 6000, feed);
  assert.equal(r.clash, 0, 'nicio placă ocupată de două trenuri');
  assert.ok(ts.every((t) => t.money > 0), 'toate au livrat: ' + ts.map((t) => t.money));
});

test('terenul nivelat marchează bucățile de redesenat', () => {
  const s = flat();
  s.height.fill(9);
  assert.deepEqual(dirtyChunks(s), []);
  ok(cmd(s, { type: 'levelTerrain', x0: 10, y0: 10, x1: 12, y1: 12, h: 8 }));
  assert.equal(s.dirty.terrain, true);
  assert.deepEqual(dirtyChunks(s), [[0, 0]], 'doar o bucată');
  s.dirty.tr = [];
  ok(cmd(s, { type: 'levelTerrain', x0: 31, y0: 31, x1: 33, y1: 33, h: 8 }));
  assert.deepEqual(dirtyChunks(s), [[0, 0], [1, 0], [0, 1], [1, 1]], 'la margine se ating patru bucăți');
});

// ——— determinism și lockstep ———
function scenario(w, until) {
  const a = station(w, 8, 20), b = station(w, 34, 20);
  track(w, [8, 20], [34, 20]); lane(w, SPUR);
  ok(cmd(w, { type: 'buildDepot', x: 20, y: 23 }));
  ok(cmd(w, { type: 'setAutoBlock', n: 6 }));
  const t1 = buy(w, 3, a, [a, b]), t2 = buy(w, 2, b, [b, a]);
  t1.rel = 70;
  for (let i = 0; i < until; i++) {
    if (i === 40) ok(cmd(w, { type: 'sendToDepot', trainId: t1.id }));
    if (i === 900 && t2.state === 1) breakNow(t2);
    stepWorld(w);
  }
  return w;
}
test('determinism: același hash, și după serializare în mijlocul reparației și al remorcării', () => {
  const w1 = scenario(flat(), 4000);
  const half = scenario(flat(), 960);
  assert.ok(half.trains.some((t) => t.dead || t.tow || t.state === 3), 'în mijlocul unei misiuni');
  const s2 = deserialize(JSON.parse(JSON.stringify(serialize(half))));
  assert.equal(hashState(s2), hashState(half));
  for (let i = 960; i < 4000; i++) stepWorld(s2);
  assert.equal(hashState(s2), hashState(w1));
});

test('lockstep: 3 noduri cu depou, reparație și remorcare rămân cu același hash', async () => {
  const cfg = { seed: 5, size: 'S', year: 1950, mode: 'simple', players: [{ id: 0, name: 'a', color: '#ff0000' }] };
  const mk = () => { const w = createWorld(cfg); w.height.fill(8); w.water.fill(0); w.forest.fill(0); w.occ.fill(0); w.roads.fill(0); w.industries.length = 0; for (const c of w.cities) { c.x = 2; c.y = 2; } return w; };
  const probe = mk();
  const sa = station(probe, 8, 20), sb = station(probe, 34, 20);
  const hub = createHub({ latency: 0.1 });
  const nodes = ['a', 'b', 'c'].map((id) => hub.add(id, { world: mk(), hostId: 'a', speed: 4 }));
  const [a, b, c] = nodes;
  const path = [[8, 20]]; for (let x = 9; x <= 34; x++) path.push([x, 20]);
  await hub.run(1); a.submit({ type: 'buildStation', x: 8, y: 20, size: 0 }); await hub.run(1); b.submit({ type: 'buildStation', x: 34, y: 20, size: 0 });
  await hub.run(1); c.submit({ type: 'buildTrack', path }); await hub.run(1); a.submit({ type: 'buildTrack', path: SPUR });
  await hub.run(1); b.submit({ type: 'buildDepot', x: 20, y: 23 }); await hub.run(1); c.submit({ type: 'setAutoBlock', n: 6 });
  await hub.run(1); a.submit({ type: 'buyTrain', model: 3, kinds: [0, 0, 1], stationId: sa, route: [sa, sb] });
  await hub.run(1); b.submit({ type: 'buyTrain', model: 3, kinds: [0, 1], stationId: sb, route: [sb, sa] });
  await hub.run(3);
  a.submit({ type: 'sendToDepot', trainId: a.world.trains[0].id });
  let k = 0;
  while (a.world.tick < 2500 && k++ < 4000) await hub.run(0.05);
  a.setSpeed(0); await hub.run(8);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  assert.ok(nodes.every((n) => n.world.tick === nodes[0].world.tick));
  assert.equal(a.world.depots.length, 1);
  assert.ok(a.world.news.some((n) => n.text.includes('reparat la')), 'reparația s-a făcut');
  assert.ok(nodes.every((n) => n.stats.resyncs === 0));
  assert.ok(hub.maxLen <= 4096);
});
