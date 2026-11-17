import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand, coastSpot, islandAt, WATER_H } from '../games/trenuri/src/sim/index.js';
import { resolveHit, contextOptions } from '../games/trenuri/src/input/contextTool.js';

const ids = (o) => o.map((q) => q.id);
const world = () => createWorld({ seed: 6, size: 'S', map: 'islands', year: 1950, ai: [1] });
const normal = () => createWorld({ seed: 3, size: 'S', year: 1950 });
const tile = (x, y) => ({ x, y, fx: x + 0.5, fz: y + 0.5 });
const dry = (s, x, y) => !s.water[y * s.w + x] && s.height[y * s.w + x] > WATER_H && !s.occ[y * s.w + x];

test('teren liber (hartă obișnuită): șină, gară, terminal, nivelare; fără port și fără teren', () => {
  const s = normal();
  let t = null;
  for (let y = 2; y < s.h - 2 && !t; y++) for (let x = 2; x < s.w - 2 && !t; x++) if (dry(s, x, y) && !(s.track[y * s.w + x] & 0x4000)) t = tile(x, y);
  const o = ids(contextOptions(s, t, {}, 0));
  assert.deepEqual(o, ['track', 'station', 'thru', 'terminal', 'level']);
});

test('apa nu are meniu', () => {
  const s = normal();
  let t = null;
  for (let i = 0; i < s.water.length && !t; i++) if (s.water[i]) t = tile(i % s.w, (i / s.w) | 0);
  if (t) assert.deepEqual(contextOptions(s, t, {}, 0), []);
});

test('insule: portul apare doar pe coasta insulei tale, terenul doar pe insula altuia', () => {
  const s = world();
  const mine = s.islands.findIndex((q) => q.owner === 0), other = s.islands.findIndex((q) => q.owner === 1);
  assert.ok(mine >= 0 && other >= 0);
  const c = coastSpot(s, mine);
  assert.ok(c, 'coastă');
  const o = ids(contextOptions(s, tile(c.x, c.y), {}, 0));
  assert.ok(o.includes('port'));
  assert.ok(!o.includes('land'));
  // o placă de pe insula altuia
  let t = null;
  for (let y = 0; y < s.h && !t; y++) for (let x = 0; x < s.w && !t; x++) if (islandAt(s, x, y) === other && dry(s, x, y)) t = tile(x, y);
  const o2 = ids(contextOptions(s, t, {}, 0));
  assert.ok(o2.includes('land'));
  assert.ok(!o2.includes('port'));
});

test('gară și port: tren, mărește, info; vaporul doar la port; gara altuia doar info', () => {
  const st = { id: 5, owner: 0, x: 3, y: 3 }, port = { id: 6, owner: 0, x: 4, y: 4, port: 1 };
  const s = normal();
  assert.deepEqual(ids(contextOptions(s, tile(3, 3), { station: st }, 0)), ['trainFrom', 'platform', 'infoStation']);
  assert.deepEqual(ids(contextOptions(s, tile(4, 4), { station: port }, 0)), ['trainFrom', 'shipFrom', 'platform', 'infoStation']);
  assert.deepEqual(ids(contextOptions(s, tile(3, 3), { station: { ...st, owner: 1 } }, 0)), ['infoStation']);
});

test('tren: info, pauză/continuă, vagoane, depou (doar dacă ai), vinde; trenul altuia doar info', () => {
  const s = normal();
  const tr = { id: 1, owner: 0, paused: 0, state: 1 };
  assert.deepEqual(ids(contextOptions(s, tile(1, 1), { train: tr }, 0)), ['infoTrain', 'pause', 'cars', 'sell']);
  s.depots.push({ x: 1, y: 1, owner: 0 });
  assert.deepEqual(ids(contextOptions(s, tile(1, 1), { train: { ...tr, paused: 1 } }, 0)), ['infoTrain', 'resume', 'cars', 'toDepot', 'sell']);
  assert.deepEqual(ids(contextOptions(s, tile(1, 1), { train: { ...tr, state: 3 } }, 0)).includes('cars'), false);
  assert.deepEqual(ids(contextOptions(s, tile(1, 1), { train: { ...tr, owner: 1 } }, 0)), ['infoTrain']);
  assert.equal(contextOptions(s, tile(1, 1), { train: tr }, 0).find((q) => q.id === 'sell').danger, true);
});

test('industrie și oraș: info și planifică ruta; pe o placă ocupată nu se oferă construcții', () => {
  const s = normal();
  const ind = s.industries.find((o) => o.type !== undefined);
  const t = tile(ind.x, ind.y);
  s.occ[ind.y * s.w + ind.x] = 1;
  const o = ids(contextOptions(s, t, { industry: ind }, 0));
  assert.equal(o[0], 'infoIndustry');
  assert.ok(o.includes('plan'));
  assert.ok(!o.includes('station'));
  const c = s.cities[0];
  assert.deepEqual(ids(contextOptions(s, tile(c.x, c.y), { city: c }, 0)).slice(0, 2), ['infoCity', 'plan']);
});

test('resolveHit: tren înaintea gării, vapor înaintea gării, gară înaintea orașului', () => {
  const s = normal();
  const st = { id: 9, owner: 0, x: 5, y: 5 };
  s.stations.push(st);
  const find = { train: (fx) => (fx < 1 ? { id: 1 } : null), ship: () => null, industry: () => ({ id: 2 }), city: () => ({ id: 3 }) };
  assert.equal(resolveHit(s, tile(5, 5), find).station, st);
  assert.equal(resolveHit(s, tile(0, 0), find).train.id, 1);
  assert.equal(resolveHit(s, tile(7, 7), find).industry.id, 2);
  assert.equal(resolveHit(s, tile(7, 7), { ...find, industry: () => null }).city.id, 3);
});
