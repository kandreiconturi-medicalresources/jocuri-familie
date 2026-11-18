import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, maxPlatforms } from '../games/trenuri/src/sim/index.js';
import { thruTiles, mainTiles, thruInfo, thruNear, THRU_BASE, THRU_TRACK, HOUSE_PAY, THRU_MAX } from '../games/trenuri/src/sim/thru.js';
import { covers } from '../games/trenuri/src/sim/catch.js';
import { spawnCargo } from '../games/trenuri/src/sim/economy.js';
import { deriveLayers } from '../games/trenuri/src/sim/roads.js';
import { growBuildings } from '../games/trenuri/src/sim/growth.js';
import { platsOf } from '../games/trenuri/src/sim/laneGeo.js';
import { createHub } from './trenuri-hub.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
/** Lume plată; orașul 0 e la (30,22) cu case pe rândurile 28–29 și pe linia y = 30 (de dărâmat). */
function town(s) {
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.industries.length = 0;
  s.cities.forEach((c, i) => { c.x = 2 + i * 3; c.y = 60; c.buildings = []; });
  const c = s.cities[0];
  c.x = 30; c.y = 22; c.pop = 900;
  for (const [x, y] of [[29, 28], [30, 28], [31, 28], [28, 29], [32, 29], [27, 30], [33, 30], [25, 27]]) c.buildings.push([x, y, x === 30 ? 9 : 2, 0]);
  deriveLayers(s);
  return s;
}
const world = () => town(createWorld({ seed: 4, size: 'S', year: 1960 }));

test('gara de trecere: ocupă locul, dărâmă casele cu despăgubire, preț corect', () => {
  const s = world(), c = s.cities[0], cash = s.companies[0].cash, n0 = c.buildings.length;
  const info = thruInfo(s, 0, 30, 30, 6, 0);
  assert.ok(info.ok, info.err);
  const r = ok(applyCommand(s, { type: 'buildThru', by: 0, x: 30, y: 30, n: 6, dir: 0 }));
  const st = s.stations.find((q) => q.id === r.id);
  assert.equal(st.thru, 1); assert.equal(st.platforms, 6); assert.equal(st.cityId, 0); assert.equal(maxPlatforms(s, st), THRU_MAX);
  assert.match(st.name, /^Gara Mare /);
  const tiles = thruTiles(30, 30, 0, 6), main = mainTiles(30, 30, 0, 6);
  assert.ok(tiles.every(([x, y]) => s.occ[y * s.w + x]), 'locul gării e ocupat');
  const set = new Set([...tiles, ...main].map(([x, y]) => y * s.w + x));
  assert.ok(c.buildings.every((b) => !set.has(b[1] * s.w + b[0])), 'nicio casă în locul gării');
  const gone = n0 - c.buildings.length;
  assert.equal(gone, info.houses.length, 'casele din loc și din calea liniilor s-au mutat');
  assert.ok(gone >= 7, 'cel puțin cele 7 din locul gării');
  assert.equal(info.pay, (gone - 1) * HOUSE_PAY + 700, 'blocul înalt costă mai mult');
  assert.equal(cash - s.companies[0].cash, THRU_BASE + 6 * THRU_TRACK + info.pay + info.layCost + info.levelCost, 'gară + linii + despăgubiri + linia principală pusă de gară');
  assert.ok(main.every(([x, y]) => !s.occ[y * s.w + x]), 'rândul liniei principale e liber');
  growBuildings(s, c, 60);
  assert.ok(c.buildings.every((b) => !set.has(b[1] * s.w + b[0])), 'orașul nu mai construiește în locul gării sau pe linia ei');
  // linia trece prin gară, dar nu poate intra în curte
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [10, 30], [50, 30], 0).path }));
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: tiles[0][0], y: tiles[0][1], size: 0 }).err, 'cladire');
  // mai multe linii: doar în sus, plătești diferența
  const before = s.companies[0].cash;
  ok(applyCommand(s, { type: 'setThruTracks', by: 0, id: st.id, n: 7 })); // liniile independente: câte un rând pe linie (centrul orașului e pe rândul 8)
  assert.equal(st.platforms, 7);
  assert.ok(before - s.companies[0].cash >= THRU_TRACK);
  assert.equal(applyCommand(s, { type: 'setThruTracks', by: 0, id: st.id, n: 6 }).err, 'exista');
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id: st.id }).err, 'loc', 'linia a 8-a ar trece prin centrul orașului');
  assert.equal(applyCommand(s, { type: 'setThruTracks', by: 0, id: st.id, n: 11 }).err, 'limita');
  assert.ok(thruTiles(30, 30, 0, 7, true).every(([x, y]) => s.occ[y * s.w + x]), 'locul gării cu 7 linii e ocupat');
  // demolarea eliberează locul
  ok(applyCommand(s, { type: 'removeStation', by: 0, id: st.id }));
  assert.ok(thruTiles(30, 30, 0, 7, true).every(([x, y]) => !s.occ[y * s.w + x]));
  assert.ok(!s.stAt.some(Boolean), 'liniile nu mai sunt ale niciunei gări');
});

test('gara de trecere: refuzată pe linie în diagonală sau peste apă; o gară normală se poate transforma', () => {
  const s = world();
  s.water[27 * s.w + 30] = 1; s.height[27 * s.w + 30] = 2;
  assert.ok(!applyCommand(s, { type: 'buildThru', by: 0, x: 30, y: 30, n: 6, dir: 0 }).ok, 'apă în curte');
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: [[40, 40], [41, 41], [42, 42], [43, 43], [44, 44]] }));
  assert.equal(thruInfo(s, 0, 42, 42, 4).err, 'loc', 'linia în diagonală nu merge');
  const a = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 30, y: 30, size: 1 })).id;
  ok(applyCommand(s, { type: 'buildThru', by: 0, x: 30, y: 30, n: 4 }));
  const st = s.stations.find((q) => q.id === a);
  assert.equal(st.thru, 1, 'aceeași gară (același id), acum de trecere');
  assert.equal(st.dir, 4, 'curtea spre sud, fiindcă la nord e apă');
});

test('gara de trecere acoperă tot orașul (pasageri, poștă, cerere de marfă)', () => {
  const s = world(), c = s.cities[0];
  c.x = 30; c.y = 20; // centrul e departe (10 plăci): o gară normală nu l-ar acoperi
  deriveLayers(s);
  const n = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 40, y: 30, size: 1 })).id;
  const t = ok(applyCommand(s, { type: 'buildThru', by: 0, x: 22, y: 30, n: 3, dir: 4 })).id;
  const sn = s.stations.find((q) => q.id === n), st = s.stations.find((q) => q.id === t);
  st.cityId = 0;
  assert.ok(!covers(sn, c)); assert.ok(covers(st, c));
  for (let i = 0; i < 5; i++) spawnCargo(s);
  assert.equal(sn.waiting.pass, 0);
  assert.ok(st.waiting.pass > 0, 'pasagerii din tot orașul vin la gara mare');
});

/** Două gări legate; trenurile pornesc din gara de trecere (n linii). */
function line(s, n) {
  const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 8, y: 30, size: 1 })).id;
  const T = ok(applyCommand(s, { type: 'buildThru', by: 0, x: 30, y: 30, n, dir: 0 })).id;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [8, 30], [50, 30], 0).path }));
  return { A, T };
}

test('gara de trecere: n trenuri stau deodată (fiecare pe linia lui), niciodată mai multe decât liniile', () => {
  const s = world(), { A, T } = line(s, 6), P = platsOf(s, s.stations.find((q) => q.id === T)), busy = () => P.reduce((a, i) => a + s.pocc[i], 0);
  s.companies[0].cash = 1e6;
  assert.equal(P.length, 6, 'linii independente: câte un peron pe linie');
  const trs = [];
  for (let i = 0; i < 6; i++) { const id = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0], route: [T, A] })).id; trs.push(s.trains.find((t) => t.id === id)); }
  assert.ok(trs.every((t) => t.state === 2 && t.to === T), 'toate 6 stau deodată în gară');
  assert.equal(busy(), 6);
  assert.ok(P.every((i) => s.pocc[i] === 1), 'fiecare tren pe peronul liniei lui');
  // se duc pe rând la A și se întorc; la întoarcere rămân în gara mare (pauză): la final toate 6 stau iar deodată
  let most = 0, i = 0;
  for (; i < 30000; i++) {
    stepWorld(s);
    for (const t of trs) if (t.state === 2 && t.to === T && t.from === A) t.paused = 1;
    most = Math.max(most, busy());
    assert.ok(P.every((i) => s.pocc[i] <= 1), 'un singur tren pe un peron');
    if (trs.every((t) => t.paused && t.state === 2 && t.to === T)) break;
  }
  assert.ok(most <= 6, 'niciodată mai multe trenuri decât linii');
  assert.ok(trs.every((t) => t.state === 2 && t.to === T), 'toate s-au întors și stau deodată pe cele 6 linii');
});

test('gara de trecere: serializare, determinism și lockstep cu 3 noduri', async () => {
  const a = world(), b = world();
  for (const s of [a, b]) { const { A, T } = line(s, 5); ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0, 1], route: [T, A] })); }
  run(a, 400); run(b, 400);
  const c = deserialize(serialize(b));
  assert.equal(hashState(c), hashState(b));
  assert.ok(thruTiles(30, 30, 0, 5).every(([x, y]) => c.occ[y * c.w + x]), 'locul ocupat se reface la încărcare');
  run(a, 2000); run(c, 2000);
  assert.equal(hashState(a), hashState(c));

  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1960, players: PL };
  const mk = () => town(createNetWorld(cfg));
  const probe = mk();
  const sa = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 8, y: 30, size: 0 })).id, sb = ok(applyCommand(probe, { type: 'buildThru', by: 0, x: 30, y: 30, n: 4, dir: 0 })).id;
  const path = planTrack(probe, [8, 30], [50, 30], 0).path;
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: mk(), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(1); n1.submit({ type: 'buildStation', x: 8, y: 30, size: 0 });
  await hub.run(0.5); n2.submit({ type: 'buildThru', x: 30, y: 30, n: 4, dir: 0 });
  await hub.run(0.5); n3.submit({ type: 'buildTrack', path });
  await hub.run(0.5); n2.submit({ type: 'buyTrain', model: 3, kinds: [0, 0], stationId: sb, route: [sb, sa] });
  await hub.run(0.5); n1.submit({ type: 'setThruTracks', id: sb, n: 6 });
  let k = 0;
  while (n1.world.tick < 2500 && k++ < 4000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  const st = n1.world.stations.find((q) => q.thru);
  assert.ok(st && st.platforms === 6, 'gară de trecere cu 6 linii construită în rețea');
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
});

test('gara de trecere cu 10 linii încape în orice oraș (caută locul, pune linia dreaptă, nivelează)', () => {
  let wide = 0, all = 0;
  for (const seed of [1, 2, 3]) {
    const s = createWorld({ seed, size: 'M', year: 2025 });
    s.sandbox = 1;
    for (const c of s.cities) { // liniile independente cer 10 rânduri de plăci: unde nu încap, rămâne intrarea comună
      const r = thruNear(s, 0, c.x, c.y, 10), j = r.ok ? r : thruNear(s, 0, c.x, c.y, 10, 5, 'join');
      all++; if (r.ok) wide++;
      assert.ok(j.ok, `${seed} ${c.name}: ${r.err} / ${j.err}`);
      assert.ok(j.fan.length >= 4, `${seed} ${c.name}: doar ${j.fan.length} intrări`); // casele se mută, dealul se nivelează treptat
    }
    const c = s.cities[0], sep = thruNear(s, 0, c.x, c.y, 10), r = sep.ok ? sep : thruNear(s, 0, c.x, c.y, 10, 5, 'join');
    const b = applyCommand(s, { type: 'buildThru', by: 0, x: r.x, y: r.y, n: 10, dir: r.dir, join: !sep.ok });
    assert.ok(b.ok, b.err);
    const st = s.stations.find((q) => q.id === b.id);
    assert.equal(st.platforms, 10);
    assert.ok(mainTiles(st.x, st.y, st.dir, 10).every(([x, y]) => s.track[y * s.w + x] & 0x4000), 'linia principală e pusă');
  }
  assert.ok(wide * 3 >= all * 2, `liniile separate încap în majoritatea orașelor: ${wide} din ${all}`);
});

test('gara mare are intrări separate: 5 linii din 5 locuri diferite, trenurile lor intră toate în gară', () => {
  const s = world();
  s.companies[0].cash = 1e6;
  const info = thruInfo(s, 0, 30, 30, 5);
  assert.ok(info.ok, info.err);
  assert.ok(info.fan.length >= 5, 'cel puțin 5 intrări, are ' + info.fan.length);
  const T = ok(applyCommand(s, { type: 'buildThru', by: 0, x: 30, y: 30, n: 5, dir: info.dir })).id;
  const trains = [];
  for (const p of info.fan.slice(0, 5)) {
    const end = p[p.length - 1], prev = p[p.length - 2], dx = end[0] - prev[0], dy = end[1] - prev[1];
    const far = [end[0] + dx * 7, end[1] + dy * 7], path = [];
    for (let k = 0; k <= 7; k++) path.push([end[0] + dx * k, end[1] + dy * k]); // fiecare intrare cu șina ei dreaptă, separată
    ok(applyCommand(s, { type: 'buildTrack', by: 0, path }));
    const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: far[0], y: far[1], size: 0 })).id;
    trains.push(ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: A, kinds: [0], route: [A, T] })).id);
  }
  const seen = new Set();
  let most = 0;
  for (let i = 0; i < 6000 && seen.size < trains.length; i++) {
    stepWorld(s);
    const here = s.trains.filter((t) => t.state === 2 && t.to === T);
    for (const t of here) seen.add(t.id);
    most = Math.max(most, here.length);
  }
  assert.equal(seen.size, trains.length, 'toate trenurile au ajuns în gara mare');
  assert.equal(most, 5, 'toate 5 deodată în gară, fiecare pe linia lui: ' + most);
});
