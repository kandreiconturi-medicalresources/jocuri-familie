// Gara mare de trecere cu intrări separate: n linii drepte în față (capete proprii), „intrare comună” opțională, „Desparte intrările” pentru gări vechi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, hashState, serialize, deserialize, applyCommand, stepWorld } from '../games/trenuri/src/sim/index.js';
import { thruInfo } from '../games/trenuri/src/sim/thru.js';
import { frameOf } from '../games/trenuri/src/sim/terminal.js';
import { sepReach } from '../games/trenuri/src/sim/thruFan.js';
import { deriveLayers } from '../games/trenuri/src/sim/roads.js';
import { ALLOWED } from '../games/trenuri/src/net/wire.js';

const ok = (r) => { assert.ok(r.ok, r.err); return r; };
const cmd = (s, c) => applyCommand(s, { by: 0, ...c });
function world() {
  const s = createWorld({ seed: 4, size: 'M', year: 1960 });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.industries.length = 0;
  s.cities.forEach((c, i) => { c.x = 2 + i * 3; c.y = 90; c.buildings = []; });
  const c = s.cities[0];
  c.x = 40; c.y = 30; c.pop = 900;
  for (const [x, y] of [[39, 38], [40, 38], [41, 38], [38, 39], [42, 39]]) c.buildings.push([x, y, 2, 0]);
  deriveLayers(s);
  s.companies[0].cash = 5000000;
  return s;
}
const tileOf = (s, st) => st.y * s.w + st.x;
const lineTo = (x0, y0, x1) => { const p = []; for (let x = x0; x <= x1; x++) p.push([x, y0]); return p; };
const feed = (s) => { if (s.tick % 10 === 0) for (const q of s.stations) q.waiting.pass = 100; };
/** Capătul de est al liniei de pe rândul y (cea mai îndepărtată placă de șină). */
const eastEnd = (s, y) => { for (let x = s.w - 1; x > 41; x--) if (s.track[y * s.w + x] & 0x4000) return [x, y]; return null; };

test('gara cu 5 linii: 5 capete diferite pe fiecare latură, drepte și paralele; intrarea comună rămâne opțiune', () => {
  const s = world();
  const r = thruInfo(s, 0, 40, 36, 5, 0);
  assert.ok(r.ok, r.err);
  const ends = r.fan.map((q) => q[q.length - 1]);
  assert.equal(ends.length, 10);
  assert.equal(new Set(ends.map((e) => e.join())).size, 10, 'zece capete distincte');
  const east = ends.filter(([x]) => x > 40), west = ends.filter(([x]) => x < 40);
  assert.equal(east.length, 5); assert.equal(west.length, 5);
  assert.equal(new Set(east.map(([, y]) => y)).size, 5, 'cinci linii pe rânduri diferite');
  assert.ok(east.every(([x]) => x === 40 + sepReach(5)), 'toate capetele la aceeași distanță');
  const j = thruInfo(s, 0, 40, 36, 5, 0, 'join');
  assert.ok(j.ok && j.fan.length <= 8, 'intrarea comună: scara veche, cel mult 4 capete pe latură');
  assert.ok(j.cost < r.cost);
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 5, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
  assert.equal(st.sep, sepReach(5));
  assert.ok(ends.every(([x, y]) => s.track[y * s.w + x] & 0x4000), 'capetele au șină');
  assert.ok(ALLOWED.has('splitThru') && ALLOWED.has('liftTrain'));
});

test('5 trenuri pe 5 șine diferite ajung toate în gară și nimic nu se blochează', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 5, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
  const f = frameOf(0), ends = [0, 1, 2, 3, 4].map((r) => eastEnd(s, 36 + f.cy * r));
  assert.ok(ends.every(Boolean));
  const rs = ends.map(([x, y]) => { ok(cmd(s, { type: 'buildTrack', path: lineTo(x, y, x + 12) })); return ok(cmd(s, { type: 'buildStation', x: x + 12, y, size: 0 })).id; });
  const trains = rs.map((r) => { const tid = ok(cmd(s, { type: 'buyTrain', model: 3, kinds: [0, 1], stationId: r, route: [r, st.id] })).id; return s.trains.find((q) => q.id === tid); });
  const first = trains.map(() => 0);
  let most = 0;
  for (let i = 1; i <= 3000; i++) {
    feed(s); stepWorld(s);
    most = Math.max(most, trains.filter((t) => t.state === 2 && t.to === st.id).length);
    trains.forEach((t, k) => { if (!first[k] && t.state === 2 && t.to === st.id) first[k] = i; });
  }
  // gara e o singură placă logică: trenurile de pe cele 5 șine intră pe rând prin gâtul scurt dinaintea ei (fiecare linie are însă capătul și semnalele ei)
  assert.ok(first.every(Boolean), 'toate cele 5 au intrat în gară: ' + first);
  assert.ok(most >= 2, 'mai multe trenuri în gară deodată: ' + most);
  assert.ok(trains.every((t) => t.money > 0), 'toate au câștigat, nimic nu s-a blocat');
});

test('„Desparte intrările”: gara veche (scară) se transformă contra cost; salvarea veche are același hash până atunci', () => {
  const s = world();
  const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 5, dir: 0, join: true })).id, st = s.stations.find((q) => q.id === id);
  assert.ok(!st.sep);
  const h0 = hashState(s);
  const copy = deserialize(JSON.parse(JSON.stringify(serialize(s))));
  assert.equal(hashState(copy), h0, 'salvarea veche se încarcă neschimbată');
  const info = thruInfo(s, 0, 40, 36, 5, undefined, 'split');
  assert.ok(info.ok, info.err);
  const cash = s.companies[0].cash;
  ok(cmd(s, { type: 'splitThru', id }));
  assert.equal(cash - s.companies[0].cash, info.cost);
  assert.equal(st.sep, sepReach(5));
  assert.notEqual(hashState(s), h0);
  assert.equal(cmd(s, { type: 'splitThru', id }).err, 'exista', 'a doua oară nu mai merge');
  assert.equal(new Set(info.fan.map((q) => q[q.length - 1].join())).size, 10);
});

test('semnale pe fiecare linie la ieșire și determinism cu serializare la mijloc', () => {
  const mk = (until) => {
    const s = world();
    const id = ok(cmd(s, { type: 'buildThru', x: 40, y: 36, n: 4, dir: 0 })).id, st = s.stations.find((q) => q.id === id);
    const e = eastEnd(s, 36), a = ok(cmd(s, { type: 'buildStation', x: e[0] + 8, y: e[1], size: 0 })).id;
    ok(cmd(s, { type: 'buildTrack', path: lineTo(e[0], e[1], e[0] + 8) }));
    const w = eastEnd(s, 36), b = ok(cmd(s, { type: 'buildStation', x: 20, y: 36, size: 0 })).id;
    void w;
    ok(cmd(s, { type: 'buildTrack', path: lineTo(20, 36, 33) }));
    ok(cmd(s, { type: 'buyTrain', model: 3, kinds: [0, 1], stationId: a, route: [a, b] }));
    for (let i = 0; i < until; i++) { feed(s); stepWorld(s); }
    return { s, st };
  };
  const { s, st } = mk(1);
  const rows = new Set(s.signals.filter((g) => g.auto && (g.y - st.y) * frameOf(0).cy > 0 && (g.y - st.y) * frameOf(0).cy < 4 && Math.abs(g.x - st.x) > 5).map((g) => g.y));
  assert.ok(rows.size >= 3, 'câte un semnal pe liniile 1–3: ' + [...rows]);
  const w1 = mk(1500).s, half = mk(300).s;
  const s2 = deserialize(JSON.parse(JSON.stringify(serialize(half))));
  assert.equal(hashState(s2), hashState(half));
  for (let i = 300; i < 1500; i++) { feed(s2); stepWorld(s2); }
  assert.equal(hashState(s2), hashState(w1));
});
