import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, MODELS, DWELL } from '../games/trenuri/src/sim/index.js';
import { BIG_COST, yardTiles, autoDir } from '../games/trenuri/src/sim/terminal.js';
import { maxPlatforms } from '../games/trenuri/src/sim/stations.js';
import { createHub } from './trenuri-hub.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
const clear = (s) => { s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0); s.industries.length = 0; s.cities.forEach((c, i) => { c.x = 2 + i; c.y = 62; c.buildings = []; }); return s; };
const flat = () => clear(createWorld({ seed: 4, size: 'S', year: 1950 }));

test('terminalul mare: curte 4×5 ocupată, 4 linii, preț, refuz pe curte ocupată', () => {
  const s = flat(), cash = s.companies[0].cash;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [10, 30], [40, 30], 0).path }));
  const spent = cash - s.companies[0].cash;
  assert.equal(autoDir(s, 20, 30), 0, 'șină E–V: curtea la nord');
  const r = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 20, y: 30, size: 2, big: true }));
  assert.equal(cash - s.companies[0].cash - spent, BIG_COST);
  const st = s.stations.find((q) => q.id === r.id);
  assert.equal(st.big, 1); assert.equal(st.platforms, 4); assert.equal(maxPlatforms(s, st), 6);
  const yard = yardTiles(20, 30, st.dir);
  assert.equal(yard.length, 20);
  assert.ok(yard.every(([x, y]) => s.occ[y * s.w + x]), 'curtea e ocupată');
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: yard[0][0], y: yard[0][1], size: 0 }).err, 'cladire');
  const p = planTrack(s, [20, 25], [20, 29], 0);
  assert.ok(!p || p.path.every(([x, y]) => !s.occ[y * s.w + x]), 'șina ocolește curtea');
  // al doilea terminal suprapus nu încape
  assert.ok(!applyCommand(s, { type: 'buildStation', by: 0, x: 22, y: 30, size: 2, big: true, dir: 0 }).ok);
  // demolarea eliberează curtea, iar starea derivată după serializare o păstrează
  const c = deserialize(serialize(s));
  assert.ok(yard.every(([x, y]) => c.occ[y * c.w + x]));
  ok(applyCommand(s, { type: 'removeStation', by: 0, id: st.id }));
  assert.ok(yard.every(([x, y]) => !s.occ[y * s.w + x]));
});

test('terminalul: 4 trenuri stau deodată pe 4 linii, service repară, macaraua scurtează oprirea', () => {
  const s = flat();
  const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 8, y: 30, size: 1 })).id;
  const T = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 40, y: 30, size: 2, big: true })).id;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [8, 30], [40, 30], 0).path }));
  const ids = [0, 1, 2, 3].map(() => ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0], route: [T, A] })).id);
  const trs = ids.map((id) => s.trains.find((t) => t.id === id));
  assert.ok(trs.every((t) => t.state === 2), 'toți 4 în terminal, fiecare pe linia lui');
  trs[0].rel = 40;
  for (const t of trs) t.paused = 1;
  trs[0].paused = 0;
  let seen = false;
  for (let i = 0; i < 6000; i++) { stepWorld(s); if (trs[0].state === 2 && trs[0].to === T && trs[0].wait === DWELL >> 1) seen = true; if (seen && trs[0].rel === MODELS[3].rel) break; }
  assert.ok(seen, 'oprire scurtă în terminal');
  assert.equal(trs[0].rel, MODELS[3].rel, 'reparat în service');
});

test('terminalul: determinism cu serializare și în lockstep cu 3 noduri', async () => {
  const a = flat(), b = flat();
  for (const s of [a, b]) {
    const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 8, y: 30, size: 1 })).id;
    const T = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 40, y: 30, size: 2, big: true })).id;
    ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [8, 30], [40, 30], 0).path }));
    ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0, 1], route: [T, A] }));
  }
  run(a, 500); run(b, 500);
  const c = deserialize(serialize(b));
  run(a, 2500); run(c, 2500);
  assert.equal(hashState(a), hashState(c));

  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1950, players: PL };
  const mk = () => clear(createNetWorld(cfg));
  const probe = mk();
  const sa = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 10, y: 30, size: 0 })).id, sb = ok(applyCommand(probe, { type: 'buildStation', by: 0, x: 40, y: 30, size: 2, big: true })).id;
  const path = planTrack(probe, [10, 30], [40, 30], 0).path;
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: mk(), hostId: 'a', speed: 4, raw: false }));
  const [n1, n2, n3] = nodes;
  await hub.run(1); n1.submit({ type: 'buildStation', x: 10, y: 30, size: 0 });
  await hub.run(0.5); n2.submit({ type: 'buildStation', x: 40, y: 30, size: 2, big: true });
  await hub.run(0.5); n3.submit({ type: 'buildTrack', path });
  await hub.run(0.5); n2.submit({ type: 'buyTrain', model: 3, kinds: [0, 0], stationId: sb, route: [sb, sa] });
  let k = 0;
  while (n1.world.tick < 2500 && k++ < 4000) await hub.run(0.05);
  n1.setSpeed(0); await hub.run(8);
  assert.ok(n1.world.stations.some((q) => q.big), 'terminal mare construit în rețea');
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
});
