import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, ERR_TEXT } from '../games/trenuri/src/sim/index.js';
import { corInfo, corVariants } from '../games/trenuri/src/sim/corridor.js';
import { corTiles } from '../games/trenuri/src/sim/corGeo.js';
import { covers } from '../games/trenuri/src/sim/catch.js';
import { spawnCargo, monthly } from '../games/trenuri/src/sim/economy.js';
import { deriveLayers } from '../games/trenuri/src/sim/roads.js';
import { growBuildings } from '../games/trenuri/src/sim/growth.js';
import { ALLOWED } from '../games/trenuri/src/net/wire.js';
import { THRU_BASE, THRU_TRACK } from '../games/trenuri/src/sim/thru.js';
import { platsOf } from '../games/trenuri/src/sim/laneGeo.js';
import { createHub } from './trenuri-hub.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };
/** Lume plată; orașul 0 (centru 30,22, 900 locuitori) cu un bloc de case pe x 24–36, y 18–26 (câte una la două plăci). */
function town(s) {
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.industries.length = 0;
  s.cities.forEach((c, i) => { c.x = 2 + i * 3; c.y = 60; c.buildings = []; });
  const c = s.cities[0];
  c.x = 30; c.y = 22; c.pop = 900;
  for (let y = 18; y <= 26; y++) for (let x = 24; x <= 36; x++) if (!(x === 30 && y === 22) && (x + y) % 2 === 0) c.buildings.push([x, y, 2, 0]);
  deriveLayers(s);
  return s;
}
const world = () => town(createWorld({ seed: 4, size: 'S', year: 1960 }));
const stripSet = (r, n) => new Set(corTiles(r.x, r.y, r.dir, n, r.E).map(([x, y]) => y * 96 + x));

test('culoar prin centru: n linii drepte cu capete proprii, case mutate, populația nu scade, orașul nu construiește în fâșie', () => {
  const s = world(), c = s.cities[0], cash = s.companies[0].cash, b0 = c.buildings.length, pop0 = c.pop;
  const info = corInfo(s, 0, 0, 'h', 'centru', 3);
  assert.ok(info.ok, info.err);
  assert.ok(info.houses.length > 5 && info.pay > 0);
  const id = ok(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3 })).id;
  assert.equal(cash - s.companies[0].cash, info.cost, 'prețul văzut la previzualizare');
  assert.ok(info.cost >= THRU_BASE + 3 * THRU_TRACK + info.pay);
  const st = s.stations.find((q) => q.id === id);
  assert.equal(st.thru, 1); assert.equal(st.platforms, 3); assert.ok(st.cor >= 9 && st.cor <= 40);
  const strip = corTiles(st.x, st.y, st.dir, 3, st.cor);
  assert.ok(strip.length > 50);
  const set = new Set(strip.map(([x, y]) => y * s.w + x));
  assert.ok(c.buildings.every((b) => !set.has(b[1] * s.w + b[0])), 'nicio casă în fâșie');
  assert.ok(strip.every(([x, y]) => s.keep[y * s.w + x]), 'fâșia e păstrată liberă');
  // fiecare linie: capete proprii, în afara orașului (cel puțin 2 plăci dincolo de case)
  const ends = info.fan.map((q) => q[q.length - 1]);
  assert.equal(ends.length, 6);
  assert.equal(new Set(ends.map((e) => e.join())).size, 6, 'șase capete diferite (3 linii × 2)');
  assert.ok(ends.every(([x, y]) => s.track[y * s.w + x] & 0x4000), 'capetele au șină');
  const xs = c.buildings.map((b) => b[0]);
  assert.ok(ends.every(([x]) => x < Math.min(...xs) - 1 || x > Math.max(...xs) + 1), 'capetele sunt în afara orașului');
  // luni: orașul își reface casele pe alte plăci, fără să construiască în fâșie, populația nu scade
  for (let m = 0; m < 6; m++) monthly(s);
  growBuildings(s, c, 60);
  assert.ok(c.pop >= pop0, 'populația nu se pierde');
  assert.ok(c.buildings.length >= Math.min(b0, 25) - 1, 'casele s-au refăcut: ' + c.buildings.length);
  assert.ok(c.buildings.every((b) => !set.has(b[1] * s.w + b[0])), 'orașul nu construiește niciodată în fâșie');
  deriveLayers(s);
  assert.ok(strip.every(([x, y]) => s.keep[y * s.w + x]), 'după rederivarea straturilor fâșia rămâne păstrată');
});

test('culoar pe margine: toate casele rămân pe o singură parte; ambele variante au preț', () => {
  const s = world(), c = s.cities[0];
  const v = corVariants(s, 0, 0, 'v', 2);
  assert.ok(v.centru.ok && v.margine.ok);
  assert.ok(v.margine.houses.length < v.centru.houses.length, 'pe margine se mută mai puține case');
  assert.ok(v.margine.cost < v.centru.cost);
  const id = ok(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'v', side: 'margine', n: 2 })).id;
  const st = s.stations.find((q) => q.id === id);
  const xs = corTiles(st.x, st.y, st.dir, 2, st.cor, true).map(([x]) => x), lo = Math.min(...xs), hi = Math.max(...xs);
  const left = c.buildings.filter((b) => b[0] < lo).length, right = c.buildings.filter((b) => b[0] > hi).length;
  assert.ok(left === 0 || right === 0, `casele pe o singură parte (${left} / ${right})`);
  assert.ok(c.buildings.length > 10);
});

/** Culoar cu n linii și o gară vecină A legată de capătul liniei principale. */
function withLine(s, n) {
  const r = corInfo(s, 0, 0, 'h', 'centru', n);
  assert.ok(r.ok, r.err);
  const T = ok(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n, dir: r.dir })).id;
  const A = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 6, y: r.y, size: 1 })).id;
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: planTrack(s, [6, r.y], [r.x - r.E, r.y], 0).path }));
  return { A, T, r };
}

test('5 trenuri pe 5 linii opresc deodată în aceeași gară, iar gara adună din tot orașul', () => {
  const s = world(), c = s.cities[0];
  s.companies[0].cash = 1e6;
  const { A, T, r } = withLine(s, 5);
  const st = s.stations.find((q) => q.id === T), P = platsOf(s, st), busy = () => P.reduce((a, i) => a + s.pocc[i], 0);
  assert.equal(st.platforms, 5); assert.equal(P.length, 5, 'câte un peron pe fiecare linie');
  const trs = [];
  for (let i = 0; i < 5; i++) { const id = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0], route: [T, A] })).id; trs.push(s.trains.find((t) => t.id === id)); }
  assert.ok(trs.every((t) => t.state === 2 && t.to === T), 'toate 5 stau deodată în gară');
  assert.equal(busy(), 5);
  assert.ok(P.every((i) => s.pocc[i] === 1), 'fiecare tren pe peronul lui');
  run(s, 600);
  assert.ok(busy() <= 5 && P.every((i) => s.pocc[i] <= 1));
  // gara acoperă tot orașul, chiar și casele de la 7+ plăci de ea
  assert.ok(covers(st, c));
  const s2 = world();
  const T2 = withLine(s2, 3).T, st2 = s2.stations.find((q) => q.id === T2);
  for (let k = 0; k < 6; k++) spawnCargo(s2);
  assert.ok(st2.waiting.pass > 0, 'pasagerii din tot orașul vin la gara culoarului');
});

test('refuzuri: apă, industrie, șina altcuiva, al doilea culoar, linii în plus', () => {
  const t = () => world();
  let s = t();
  s.water[24 * s.w + 30] = 1; s.height[24 * s.w + 30] = 2;
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3, dir: 4 }).err, 'teren');
  assert.ok(ERR_TEXT.teren);
  s = t(); s.occ[24 * s.w + 28] = 1; s.roads[24 * s.w + 28] = 0; // ca o industrie
  s.cities[0].buildings = s.cities[0].buildings.filter((b) => !(b[0] === 28 && b[1] === 24));
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3, dir: 4 }).err, 'loc');
  s = t(); s.track[23 * s.w + 28] = 0x4000 | 0x44 | (1 << 11); // șină a altei companii pe rândul liniei principale
  const other = applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3, dir: 4 });
  assert.ok(!other.ok && other.err === 'proprietar', String(other.err));
  s = t();
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 6 }).err, 'culoar');
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'x', side: 'centru', n: 3 }).err, 'culoar');
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 9, axis: 'h', side: 'centru', n: 3 }).err, 'inexistent');
  const id = ok(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3 })).id;
  const e2 = applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'v', side: 'margine', n: 2 });
  assert.equal(e2.err, 'culoar1'); assert.ok(ERR_TEXT.culoar1 && ERR_TEXT.culoar);
  assert.equal(applyCommand(s, { type: 'setThruTracks', by: 0, id, n: 4 }).err, 'limita');
  assert.equal(applyCommand(s, { type: 'upgradeStation', by: 0, id }).err, 'limita');
  s = t(); s.companies[0].cash = 10;
  assert.equal(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3 }).err, 'bani');
});

test('gara obișnuită de pe linia principală se transformă în gara culoarului (același id, preț scăzut)', () => {
  const s = world(), plain = corInfo(s, 0, 0, 'h', 'centru', 3, 4);
  const a = ok(applyCommand(s, { type: 'buildStation', by: 0, x: 28, y: 23, size: 1 })).id;
  const info = corInfo(s, 0, 0, 'h', 'centru', 3, 4);
  assert.ok(info.ok, info.err);
  assert.equal(info.st && info.st.id, a);
  assert.ok(info.cost < plain.cost + 5000, 'transformarea scade jumătate din prețul gării vechi');
  const id = ok(applyCommand(s, { type: 'buildCorridor', by: 0, city: 0, axis: 'h', side: 'centru', n: 3, dir: 4 })).id;
  assert.equal(id, a);
  const st = s.stations.find((q) => q.id === a);
  assert.ok(st.cor && st.thru && st.x === 28);
});

test('culoar: determinism, serializare și lockstep', async () => {
  const a = world(), b = world();
  for (const s of [a, b]) { const { A, T } = withLine(s, 4); ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: T, kinds: [0, 1], route: [T, A] })); }
  run(a, 400); run(b, 400);
  assert.equal(hashState(a), hashState(b));
  const c = deserialize(serialize(b));
  assert.equal(hashState(c), hashState(b));
  run(a, 1500); run(c, 1500);
  assert.equal(hashState(a), hashState(c), 'după încărcare, aceeași evoluție');
  const st = c.stations.find((q) => q.cor);
  assert.ok(st && corTiles(st.x, st.y, st.dir, st.platforms, st.cor).every(([x, y]) => c.keep[y * c.w + x]));

  assert.ok(ALLOWED.has('buildCorridor'));
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }];
  const cfg = { mode: 'coop', seed: 7, size: 'S', year: 1960, players: PL };
  const hub = createHub({ latency: 0.1 });
  const nodes = PL.map((p) => hub.add(p.id, { world: town(createNetWorld(cfg)), hostId: 'a', speed: 4, raw: false }));
  await hub.run(1); nodes[1].submit({ type: 'buildCorridor', city: 0, axis: 'v', side: 'centru', n: 3 });
  let k = 0;
  while (nodes[0].world.tick < 1500 && k++ < 4000) await hub.run(0.05);
  nodes[0].setSpeed(0); await hub.run(8);
  assert.ok(nodes[0].world.stations.some((q) => q.cor), 'culoarul s-a construit în rețea');
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
});

test('lumile fără culoar: hash-ul stării nu depinde de câmpul cor', () => {
  const s = world();
  const h0 = hashState(s);
  ok(applyCommand(s, { type: 'buildStation', by: 0, x: 8, y: 30, size: 1 }));
  assert.ok(!s.stations.some((q) => q.cor));
  assert.notEqual(hashState(s), h0);
  assert.equal(stripSet({ x: 30, y: 23, dir: 4, E: 9 }, 3).size, 19 * 5);
});
