// Schimbarea rutei unui tren existent (setRoute): validare, aplicare (în repaus și în mers), ordine, determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, stepWorld, hashState } from '../games/trenuri/src/sim/index.js';
import { ok, flat, station, track, buy, run } from './trenuri-sig-helpers.js';
import { editState, routeCommand } from '../games/trenuri/src/ui/routeEdit.js';
import { assistReduce } from '../games/trenuri/src/ui/assistState.js';

/** A–B–C legate în linie; D izolată. */
function world() {
  const s = flat();
  const a = station(s, 4, 20), b = station(s, 24, 20), c = station(s, 44, 20), d = station(s, 30, 40);
  track(s, [4, 20], [24, 20]); track(s, [24, 20], [44, 20]);
  return { s, a, b, c, d };
}
const set = (s, t, route, extra = {}) => applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route, ...extra });

test('setRoute: refuză gări nelegate, duplicate vecine, străine, trenul altcuiva și ordine de altă lungime', () => {
  const { s, a, b, c, d } = world(), t = buy(s, 3, a, [a, b]);
  assert.equal(set(s, t, [a, d]).err, 'legatura');
  assert.equal(set(s, t, [a, b, d]).err, 'legatura');
  assert.equal(set(s, t, [a, a, b]).err, 'drum');
  assert.equal(set(s, t, [a, b, b]).err, 'drum');
  assert.equal(set(s, t, [a, 9999]).err, 'gara');
  assert.equal(set(s, t, []).err, 'gara');
  assert.equal(set(s, t, [a, b, c], { orders: [{ load: null, unload: null, drop: null }] }).err, 'drum');
  assert.equal(applyCommand(s, { type: 'setRoute', by: 1, trainId: t.id, route: [a, c] }).ok, false);
  assert.deepEqual(t.route, [a, b], 'ruta neschimbată după refuz');
});

test('setRoute: ruta nouă se aplică; în gară pornește spre prima din rută dacă gara de acum nu e în ea', () => {
  const { s, a, b, c } = world(), t = buy(s, 3, a, [a, b]);
  ok(set(s, t, [b, c]));
  assert.deepEqual(t.route, [b, c]);
  assert.equal(t.at, -1);
  run(s, 3000);
  assert.ok(t.route.includes(t.to), 'merge acum între B și C');
});

test('setRoute: trenul în mers termină drumul, apoi continuă în ruta nouă; marfa rămâne', () => {
  const { s, a, b, c } = world(), t = buy(s, 3, a, [a, c]);
  s.stations.find((q) => q.id === a).waiting.pass = 30; // pasageri care se urcă
  for (let i = 0; i < 4000 && t.state !== 1; i++) stepWorld(s);
  assert.equal(t.state, 1, 'e în mers');
  const to = t.to;
  ok(set(s, t, [a, b, c]));
  assert.equal(t.to, to, 'nu se întoarce din drum');
  assert.equal(t.at, t.route.indexOf(to));
  run(s, 6000);
  assert.ok(t.route.length === 3 && t.lost === 0);
});

test('setRoute: ordinele rămân la gările lor, gările noi sunt Automat; ordine date explicit se aplică', () => {
  const { s, a, b, c } = world(), t = buy(s, 3, a, [a, b]);
  const o = (drop) => ({ load: [2], unload: null, drop });
  ok(applyCommand(s, { type: 'setOrders', by: 0, trainId: t.id, orders: [o({ m: 'all' }), o({ m: 'none' })] }));
  ok(set(s, t, [b, c, a]));
  assert.equal(t.orders.length, 3);
  assert.deepEqual(t.orders[0].drop, { m: 'none' });
  assert.equal(t.orders[1].drop, null);
  assert.deepEqual(t.orders[2].drop, { m: 'all' });
  ok(set(s, t, [a, c], { orders: [o({ m: 'pct', v: 50 }), o({ m: 'all' })] }));
  assert.deepEqual(t.orders.map((x) => x.drop), [{ m: 'pct', v: 50 }, { m: 'all' }]);
});

test('setRoute: determinist (aceeași comandă → același hash), indiferent de drumul spre ea', () => {
  const run1 = () => {
    const { s, a, b, c } = world(), t = buy(s, 3, a, [a, b]);
    run(s, 500); ok(set(s, t, [b, c, a])); run(s, 3000);
    return hashState(s);
  };
  assert.equal(run1(), run1());
});

test('editorul de rută: precompletat din tren, comandă cu ordine doar dacă s-a ales descărcarea', () => {
  const { s, a, b, c } = world(), t = buy(s, 3, a, [a, b], [2, 2, 2]);
  let e = editState(t, 3);
  assert.deepEqual(e.stops.map((x) => x.id), [a, b]);
  assert.equal(routeCommand(e, t).orders, undefined, 'Automat rămâne Automat');
  e = assistReduce(e, { t: 'toggle', id: c });
  e = assistReduce(e, { t: 'drop', i: 1, drop: { m: 'cars', v: 2 } });
  const cmd = routeCommand(e, t);
  assert.deepEqual(cmd.route, [a, b, c]);
  assert.equal(cmd.orders.length, 3);
  assert.deepEqual(cmd.orders[1].drop, { m: 'cars', v: 2 });
  ok(applyCommand(s, { by: 0, ...cmd }));
  assert.equal(routeCommand(assistReduce(e, { t: 'clear' }), t), null);
});

test('sfatul pentru tren de marfă nu pomenește vagoane de pasageri și poștă', async () => {
  const { trainAdvice } = await import('../games/trenuri/src/sim/advice.js');
  const { s, a, b } = world(), t = buy(s, 3, a, [a, b], [2, 2, 2]);
  s.stations.find((q) => q.id === a).waiting.pass = 40;
  const txt = trainAdvice(s, t).join(' ');
  assert.ok(!/pasageri/.test(txt), txt);
});
