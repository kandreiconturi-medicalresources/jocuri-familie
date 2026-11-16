import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashState, serialize, deserialize, applyCommand, planTrack, stepWorld, CAR_PRICE } from '../games/trenuri/src/sim/index.js';
import { carsCost } from '../games/trenuri/src/sim/consist.js';
import { ALLOWED } from '../games/trenuri/src/net/wire.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const run = (s, n) => { for (let i = 0; i < n; i++) stepWorld(s); };

function line(extra = {}) {
  const s = createWorld({ seed: 4, size: 'S', year: 1950, ...extra });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0;
  s.cities.forEach((c, i) => { c.x = 2 + i; c.y = 60; });
  const by = 0;
  const A = ok(applyCommand(s, { type: 'buildStation', by, x: 8, y: 30, size: 1 })).id;
  const B = ok(applyCommand(s, { type: 'buildStation', by, x: 40, y: 30, size: 1 })).id;
  ok(applyCommand(s, { type: 'buildTrack', by, path: planTrack(s, [8, 30], [40, 30], by).path }));
  const id = ok(applyCommand(s, { type: 'buyTrain', by, model: 3, stationId: A, kinds: [0, 0, 1], route: [A, B] })).id;
  return { s, A, B, tr: s.trains.find((t) => t.id === id) };
}

test('costul: vagon nou întreg, vagon scos jumătate înapoi', () => {
  assert.equal(carsCost([0, 0, 1], [0, 0, 1, 2]), CAR_PRICE);
  assert.equal(carsCost([0, 0, 1], [0]), -CAR_PRICE);
  assert.equal(carsCost([0, 1], [2, 3]), 2 * CAR_PRICE - CAR_PRICE);
  assert.ok(ALLOWED.has('setCars'));
});

test('în gară: vagoanele se schimbă imediat, banii corecți, marfa în plus rămâne în gară', () => {
  const { s, A, tr } = line();
  const st = s.stations.find((q) => q.id === A);
  tr.load = [{ c: 0, n: 50, from: 999, t: 0 }];
  const cash = s.companies[0].cash;
  const r = ok(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [0, 6] }));
  assert.equal(r.now, true);
  assert.deepEqual(tr.kinds, [0, 6]); assert.equal(tr.cars, 2);
  assert.equal(s.companies[0].cash, cash - r.cost);
  assert.equal(r.cost, CAR_PRICE - (2 * CAR_PRICE >> 1));
  const pass = tr.load.filter((b) => b.c === 0).reduce((n, b) => n + b.n, 0);
  assert.ok(pass <= 30, 'încap doar 30 de pasageri');
  assert.ok(st.waiting.pass >= 20, 'restul a coborât în gară');
});

test('din mers: schimbarea așteaptă gara următoare; ordinele pierd mărfurile fără vagon', () => {
  const { s, tr } = line();
  ok(applyCommand(s, { type: 'setOrders', by: 0, trainId: tr.id, orders: [{ load: [0, 1], unload: null }, { load: [0, 1], unload: null }] }));
  run(s, 30);
  assert.equal(tr.state, 1, 'trenul a plecat');
  const r = ok(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [0, 0, 0] }));
  assert.equal(r.now, false);
  assert.deepEqual(tr.kinds, [0, 0, 1]); assert.deepEqual(tr.nk, [0, 0, 0]);
  for (let i = 0; i < 4000 && tr.nk; i++) stepWorld(s);
  assert.equal(tr.nk, null); assert.deepEqual(tr.kinds, [0, 0, 0]);
  assert.ok(tr.orders.every((o) => !o.load.includes(1)), 'poșta a ieșit din ordine');
});

test('refuzuri: bani, număr de vagoane, trenul altuia', () => {
  const { s, tr } = line();
  s.companies[0].cash = 0;
  assert.equal(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [0, 0, 1, 2] }).err, 'bani');
  assert.equal(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [] }).err, 'vagoane');
  assert.equal(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [0, 0, 0, 0, 0, 0, 0] }).err, 'vagoane');
  ok(applyCommand(s, { type: 'setCars', by: 0, trainId: tr.id, kinds: [0] })); // scoaterea dă bani, merge și fără bani
  const n = createNetWorld({ mode: 'comp', seed: 3, size: 'S', year: 1950, players: [{ id: 'a', name: 'A', color: '#f00' }, { id: 'b', name: 'B', color: '#00f' }] });
  n.trains.push({ ...tr, owner: 0, id: 500 });
  assert.equal(applyCommand(n, { type: 'setCars', by: 1, trainId: 500, kinds: [0] }).err, 'proprietar');
});

test('determinism: serializare cu schimbare în așteptare dă același hash', () => {
  const a = line().s, b = line().s;
  const ta = a.trains[0], tb = b.trains[0];
  run(a, 30); run(b, 30);
  ok(applyCommand(a, { type: 'setCars', by: 0, trainId: ta.id, kinds: [0, 1, 1] }));
  ok(applyCommand(b, { type: 'setCars', by: 0, trainId: tb.id, kinds: [0, 1, 1] }));
  const c = deserialize(serialize(b));
  run(a, 3000); run(c, 3000);
  assert.equal(hashState(a), hashState(c));
});
