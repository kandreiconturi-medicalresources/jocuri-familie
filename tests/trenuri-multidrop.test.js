// Descărcare parțială (tot / după cerere / X vagoane / % / nimic), destinațiile industriei după profit, selecția din asistent și determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommand, createWorld, stepWorld, hashState, serialize, deserialize, tileDist, destinations, suppliers, wantOf, INDUSTRIES, NG, G,
} from '../games/trenuri/src/sim/index.js';
import { unload } from '../games/trenuri/src/sim/cargo.js';
import { newAssist, assistReduce, pruneStops, buildOrders, buyCommand, dropOf, stationRows } from '../games/trenuri/src/ui/assistState.js';
import { ok, flat, station, track, buy } from './trenuri-sig-helpers.js';
import { createHub } from './trenuri-hub.js';

const FOOD = G.mancare, FRIGO = 6, CEREALE = G.cereale, CUTIE = 2; // frigorificul duce mâncare, cutia duce cereale
const T = Object.fromEntries(INDUSTRIES.map((t, i) => [t.key, i]));
const addInd = (s, key, x, y) => {
  const o = { id: s.industries.length, type: T[key], x, y, name: key + s.industries.length, in: new Array(NG).fill(0), out: new Array(NG).fill(0), made: 0, boost: 0 };
  s.industries.push(o); s.occ[y * s.w + x] = 1;
  return o;
};

/** Gara A (marfa), orașele B (cere puțin: pop 320 → 20 pe lună) și C (cere mult: pop 1600 → 100 pe lună), legate cu șină. */
function world() {
  const s = flat();
  const [cb, cc] = s.cities;
  Object.assign(cb, { x: 24, y: 22, pop: 320, level: 0 }); Object.assign(cc, { x: 44, y: 22, pop: 1600, level: 0 });
  const a = station(s, 4, 20), b = station(s, 24, 20), c = station(s, 44, 20);
  track(s, [4, 20], [24, 20]); track(s, [24, 20], [44, 20]);
  s.stations[0].cargo[FOOD] = 120;
  return { s, a, b, c, cb, cc };
}
const orders = (drops, g = FOOD) => drops.map((d) => ({ load: [g], unload: null, drop: d }));
const keepCities = (w) => { w.cb.pop = 320; w.cc.pop = 1600; w.cb.level = 0; w.cc.level = 0; }; // fără creștere: cererea rămâne 20 și 100
const total = (t) => t.load.reduce((q, b) => q + b.n, 0);

test('6 vagoane de mâncare descarcă după cerere în 2 orașe: suma livrată și venitul sunt corecte', () => {
  const w = world(), { s } = w;
  const r = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, kinds: Array(6).fill(FRIGO), stationId: w.a, route: [w.a, w.b, w.c], orders: orders([null, { m: 'demand' }, { m: 'all' }]) }));
  const tr = s.trains.find((q) => q.id === r.id);
  let loaded = 0, afterFirst = null;
  for (let i = 0; i < 9000 && (loaded === 0 || s.stats.del[FOOD] < loaded); i++) {
    keepCities(w); stepWorld(s);
    const n = total(tr);
    loaded = Math.max(loaded, n);
    if (afterFirst === null && loaded && n < loaded && n > 0) afterFirst = n;
  }
  assert.ok(loaded > 20, 'trenul a încărcat (marfa se mai strică în gară, deci nu exact 120)');
  assert.equal(s.stats.del[FOOD], loaded, 'toată marfa încărcată a fost livrată');
  assert.equal(afterFirst, loaded - 20, 'după primul oraș trenul mai duce restul (B a cerut 20)');
  assert.equal(tr.load.length, 0);
  assert.equal(w.cb.got[FOOD] + w.cb.prev[FOOD], 20); assert.equal(w.cc.got[FOOD] + w.cc.prev[FOOD], loaded - 20);
  const base = 20 * tileDist(s.stations[0], s.stations[1]) * 4 + (loaded - 20) * tileDist(s.stations[0], s.stations[2]) * 4; // tone × plăci × tarif
  assert.ok(tr.money >= Math.floor((base * 70) / 100) - 2 && tr.money <= (base * 150) / 100, `venit ${tr.money} între ${base * 0.7} și ${base * 1.5}`);
});

test('venitul pe fiecare livrare parțială e exact (tone × distanță × tarif × bonus de viteză)', () => {
  const w = world(), { s } = w, [A, B, C] = s.stations;
  const t = buy(s, 3, w.a, [w.a, w.b, w.c], Array(6).fill(FRIGO));
  t.orders = orders([null, { m: 'demand' }, { m: 'all' }]);
  t.load = [{ c: FOOD, n: 120, from: A.id, t: s.tick }]; // abia încărcat: bonus 150%
  t.at = 1;
  const e1 = unload(s, t, B);
  assert.equal(e1, ((20 * tileDist(A, B) * 4 * 150) / 100) | 0, 'orașul B ia 20');
  assert.equal(t.load[0].n, 100);
  assert.equal(w.cb.got[FOOD], 20);
  t.at = 2;
  const e2 = unload(s, t, C);
  assert.equal(e2, ((100 * tileDist(A, C) * 4 * 150) / 100) | 0, 'orașul C ia restul');
  assert.equal(t.load.length, 0);
  assert.equal(w.cc.got[FOOD], 100);
  assert.equal(s.stats.del[FOOD], 120);
});

test('„tot” la prima gară lasă trenul gol; „nimic” îl lasă plin; X vagoane și % împart marfa', () => {
  const left = (drop) => {
    const w = world(), { s } = w, t = buy(s, 3, w.a, [w.a, w.b, w.c], Array(6).fill(FRIGO));
    t.orders = orders([null, drop, { m: 'all' }]); t.load = [{ c: FOOD, n: 120, from: s.stations[0].id, t: s.tick }]; t.at = 1;
    unload(s, t, s.stations[1]);
    return total(t);
  };
  assert.equal(left({ m: 'all' }), 0);
  assert.equal(left({ m: 'none' }), 120);
  assert.equal(left({ m: 'cars', v: 2 }), 80, '2 vagoane × 20');
  assert.equal(left({ m: 'pct', v: 25 }), 90, '25% din 120');
  assert.equal(left({ m: 'demand' }), 100);
});

test('„tot” într-o rută cu mai multe gări livrează tot la prima, iar „după cerere” la ultima gară lasă tot', () => {
  const w = world(), { s } = w, t = buy(s, 3, w.a, [w.a, w.c], Array(6).fill(FRIGO));
  t.orders = [{ load: [FOOD], unload: null, drop: null }, { load: [FOOD], unload: null, drop: { m: 'demand' } }];
  t.load = [{ c: FOOD, n: 120, from: s.stations[0].id, t: s.tick }]; t.at = 1;
  w.cc.pop = 160; // cere doar 10, dar nicio gară următoare n-o mai cere: tot ce rămâne se lasă
  unload(s, t, s.stations[2]);
  assert.equal(t.load.length, 0);
  assert.equal(w.cc.got[FOOD], 120);
});

test('comenzi: ordinele proaste sunt refuzate, cele bune se curăță; buyTrain primește ordine', () => {
  const w = world(), { s } = w;
  const bad = (orders) => applyCommand(s, { type: 'buyTrain', by: 0, model: 3, kinds: [FRIGO], stationId: w.a, route: [w.a, w.b], orders }).err;
  assert.equal(bad([{ load: [FOOD], drop: { m: 'cars', v: 99 } }]), 'drum');
  assert.equal(bad([{ drop: { m: 'zzz' } }]), 'drum');
  const t = buy(s, 3, w.a, [w.a, w.b], [FRIGO]);
  assert.equal(applyCommand(s, { type: 'setOrders', by: 0, trainId: t.id, orders: [{ load: [FOOD], drop: { m: 'pct', v: 0 } }] }).err, 'drum');
  ok(applyCommand(s, { type: 'setOrders', by: 0, trainId: t.id, orders: [{ load: [FOOD], extra: 1, drop: { m: 'pct', v: 40, x: 1 } }, { drop: { m: 'demand' } }] }));
  assert.deepEqual(t.orders[0], { load: [FOOD], unload: null, drop: { m: 'pct', v: 40 } });
  ok(applyCommand(s, { type: 'setOrders', by: 0, trainId: t.id, orders: null }));
  assert.equal(t.orders, null);
});

test('destinațiile industriei sunt sortate după profit estimat', () => {
  const s = flat();
  const fab = addInd(s, 'fabmanc', 10, 30);
  Object.assign(s.cities[0], { x: 20, y: 30, pop: 80, level: 0 }); // aproape, cerere mică (5)
  Object.assign(s.cities[1], { x: 50, y: 30, pop: 1600, level: 0 }); // departe, cerere mare (100)
  for (const c of s.cities.slice(2)) { c.x = 2; c.y = 2; }
  const list = destinations(s, fab, FOOD);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].profit >= list[i].profit, `profit descrescător la ${i}`);
  assert.equal(list[0].o, s.cities[1], 'orașul mare și îndepărtat câștigă');
  assert.equal(list[0].level, 2);
  assert.equal(list.find((e) => e.o === s.cities[0]).level, 1);
  assert.equal(list[0].perTon, tileDist(fab, s.cities[1]) * 4);
  assert.equal(list[0].rail, 'none');
  station(s, 50, 31); // gară lângă orașul mare
  assert.equal(destinations(s, fab, FOOD)[0].rail, 'station');
  // un sat nu cere combustibil: cerere „deloc”; petrolul îl cere doar rafinăria
  const sonda = addInd(s, 'sonda', 12, 40), raf = addInd(s, 'rafinarie', 40, 40);
  const fuel = destinations(s, raf, G.combustibil);
  assert.ok(fuel.length === s.cities.length && fuel.every((e) => e.kind === 'city' && e.level === 0));
  assert.deepEqual(destinations(s, sonda, G.petrol).filter((e) => e.level > 0).map((e) => e.o), [raf]);
  assert.equal(suppliers(s, raf, G.petrol)[0].o, sonda);
  assert.equal(wantOf(s.cities[1], FOOD), 100);
});

test('selecția din asistent nu se pierde la deschiderea Info, la mutarea camerei sau la schimbarea uneltei', () => {
  let a = newAssist({ model: 3 });
  a = assistReduce(a, { t: 'set', v: { type: 'freight', good: FOOD, cars: 5 } });
  for (const id of [11, 12, 13]) a = assistReduce(a, { t: 'toggle', id });
  const before = JSON.stringify(a);
  for (const act of [{ t: 'tool', tool: 'info' }, { t: 'info', open: 'industry' }, { t: 'camera', zoom: 0.5 }, { t: 'tool', tool: 'track' }, { t: 'zzz' }]) a = assistReduce(a, act);
  assert.equal(JSON.stringify(a), before, 'aceeași selecție');
  assert.deepEqual(a.stops.map((x) => x.id), [11, 12, 13]);
  a = assistReduce(a, { t: 'move', i: 2, d: -1 });
  assert.deepEqual(a.stops.map((x) => x.id), [11, 13, 12], 'reordonare');
  a = assistReduce(a, { t: 'move', i: 0, d: -1 });
  assert.deepEqual(a.stops.map((x) => x.id), [11, 13, 12], 'prima nu urcă');
  a = assistReduce(a, { t: 'toggle', id: 13 });
  assert.deepEqual(a.stops.map((x) => x.id), [11, 12], 'a doua atingere o scoate');
  a = assistReduce(a, { t: 'remove', i: 0 });
  assert.deepEqual(a.stops.map((x) => x.id), [12]);
  for (let i = 0; i < 12; i++) a = assistReduce(a, { t: 'toggle', id: 100 + i });
  assert.equal(a.stops.length, 8, 'cel mult 8 gări');
});

test('asistentul: ordine și comandă de cumpărare pentru 3 gări (după cerere, ultima „tot”), gări demolate, listă', () => {
  const w = world(), { s } = w;
  let a = newAssist({ good: FOOD, stops: [w.a, w.b, w.c], model: 3 });
  a = assistReduce(a, { t: 'cars', n: 6 });
  assert.equal(a.step, 3); assert.equal(a.type, 'freight');
  assert.deepEqual(a.stops.map((x, i) => dropOf(a, i).m), ['demand', 'demand', 'all']);
  const cmd = buyCommand(a);
  assert.deepEqual(cmd.kinds, Array(6).fill(FRIGO)); assert.deepEqual(cmd.route, [w.a, w.b, w.c]);
  assert.deepEqual(cmd.orders.map((o) => o.drop.m), ['demand', 'demand', 'all']);
  const rows = stationRows(s, a, 0);
  assert.equal(rows[0].st.id, w.a, 'gara cu marfa aleasă e prima în listă'); assert.ok(rows[0].has);
  assert.ok(rows.find((r) => r.st.id === w.b).wants, 'B cere mâncare'); assert.equal(rows.find((r) => r.st.id === w.c).sel, 3);
  const two = newAssist({ good: FOOD, stops: [w.a, w.b] });
  assert.equal(buildOrders(two), null, 'două gări, fără alegeri: modul Automat de până acum');
  assert.equal(buyCommand(assistReduce(two, { t: 'remove', i: 1 })), null, 'o singură gară nu ajunge');
  assert.equal(buildOrders(assistReduce(two, { t: 'drop', i: 1, drop: { m: 'cars', v: 2 } }))[1].drop.v, 2);
  const r = ok(applyCommand(s, { by: 0, ...cmd }));
  assert.deepEqual(s.trains.find((q) => q.id === r.id).orders.map((o) => o.drop.m), ['demand', 'demand', 'all']);
  const w2 = world(); // gară demolată: dispare din selecție
  ok(applyCommand(w2.s, { type: 'removeStation', by: 0, id: w2.c }));
  assert.deepEqual(pruneStops(a, w2.s, 0).stops.map((x) => x.id), [w.a, w.b]);
});

test('determinism: același hash cu descărcare parțială, și după serializare la mijloc', () => {
  const play = (steps) => {
    const w = world(), { s } = w;
    ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, kinds: Array(6).fill(FRIGO), stationId: w.a, route: [w.a, w.b, w.c], orders: orders([null, { m: 'demand' }, { m: 'cars', v: 2 }]) }));
    s.stations[0].cargo[FOOD] = 200;
    for (let i = 0; i < steps; i++) stepWorld(s);
    return s;
  };
  const full = play(5000), half = play(1500);
  assert.ok(total(half.trains[0]) > 0 || half.stats.del[FOOD] > 0, 'trenul a livrat sau duce marfă');
  const s2 = deserialize(JSON.parse(JSON.stringify(serialize(half))));
  assert.equal(hashState(s2), hashState(half));
  for (let i = 1500; i < 5000; i++) stepWorld(s2);
  assert.equal(hashState(s2), hashState(full));
  assert.ok(full.stats.del[FOOD] > 0);
});

test('lockstep: 3 noduri cu tren cu descărcare parțială rămân cu același hash', async () => {
  const cfg = { seed: 5, size: 'S', year: 1950, mode: 'simple', players: [{ id: 0, name: 'a', color: '#ff0000' }] };
  const mk = () => {
    const w = createWorld(cfg); w.height.fill(8); w.water.fill(0); w.forest.fill(0); w.occ.fill(0); w.roads.fill(0); w.industries.length = 0;
    for (const c of w.cities) { c.x = 2; c.y = 2; }
    addInd(w, 'ferma', 8, 18); addInd(w, 'fabmanc', 24, 18); addInd(w, 'fabmanc', 40, 18); // cerealele de la fermă merg la două fabrici
    return w;
  };
  const hub = createHub({ latency: 0.1 });
  const nodes = ['a', 'b', 'c'].map((id) => hub.add(id, { world: mk(), hostId: 'a', speed: 4 }));
  const [a, b, c] = nodes;
  const path = []; for (let x = 8; x <= 40; x++) path.push([x, 20]);
  await hub.run(1); a.submit({ type: 'buildStation', x: 8, y: 20, size: 0 });
  await hub.run(1); b.submit({ type: 'buildStation', x: 24, y: 20, size: 0 });
  await hub.run(1); c.submit({ type: 'buildStation', x: 40, y: 20, size: 0 });
  await hub.run(1); a.submit({ type: 'buildTrack', path });
  await hub.run(1);
  const [sa, sb, sc] = a.world.stations.map((q) => q.id);
  a.submit({ type: 'buyTrain', model: 3, kinds: Array(6).fill(CUTIE), stationId: sa, route: [sa, sb, sc], orders: orders([null, { m: 'pct', v: 30 }, { m: 'all' }], CEREALE) });
  await hub.run(2);
  let k = 0;
  while (a.world.tick < 2500 && k++ < 4000) await hub.run(0.05);
  a.setSpeed(0); await hub.run(8);
  const hs = nodes.map((n) => hashState(n.world));
  assert.ok(hs.every((h) => h === hs[0]), 'hash-uri diferite: ' + hs);
  assert.equal(a.world.trains.length, 1);
  assert.deepEqual(a.world.trains[0].orders.map((o) => (o.drop ? o.drop.m : null)), [null, 'pct', 'all']);
  assert.ok(a.world.stats.del[CEREALE] > 0, 'marfa a ajuns la fabrici');
  assert.ok(nodes.every((n) => n.stats.resyncs === 0));
  assert.ok(hub.maxLen <= 4096);
});
