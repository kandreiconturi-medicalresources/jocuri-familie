// Trenuri defecte în lanț: remorca le ia pe rând, macaraua ridică trenul de pe linie (comandă și automat), determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, stepWorld, hashState, serialize, deserialize, DEPOT } from '../games/trenuri/src/sim/index.js';
import { ok, flat, station, track, lane, buy } from './trenuri-sig-helpers.js';

const cmd = (s, c) => applyCommand(s, { by: 0, ...c });
const SPUR = [[20, 20], [20, 21], [20, 22], [20, 23]];
const feed = (w) => { if (w.tick % 10 === 0) for (const st of w.stations) st.waiting.pass = 100; };
const go = (w) => { feed(w); stepWorld(w); };
const xOf = (s, t) => t.path[t.seg] % s.w;
function yard(depot = true) {
  const s = flat();
  const a = station(s, 8, 20), b = station(s, 34, 20);
  track(s, [8, 20], [34, 20]);
  if (depot) { lane(s, SPUR); ok(cmd(s, { type: 'buildDepot', x: 20, y: 23 })); }
  return { s, a, b };
}
/** Două trenuri defecte pe linia de la est de ramura depoului, în același sens: t1 mai departe, t2 între el și depou. */
function twoDead(s, a, b) {
  ok(cmd(s, { type: 'setAutoBlock', n: 3 }));
  const t1 = buy(s, 3, a, [a, b]);
  for (let k = 0; k < 4000 && !(t1.state === 1 && xOf(s, t1) >= 28); k++) go(s);
  t1.dead = -5000; t1.speed = 0; // defect, dar contorul abia pornește: remorca nu pleacă încă
  const t2 = buy(s, 3, a, [a, b]);
  for (let k = 0; k < 4000 && !(t2.state === 1 && xOf(s, t2) >= 21); k++) go(s);
  t2.dead = 1; t1.dead = 1; t2.speed = 0;
  return [t1, t2];
}

test('două trenuri defecte unul după altul: remorca le ia pe rând și linia se eliberează', () => {
  const { s, a, b } = yard();
  const [t1, t2] = twoDead(s, a, b);
  assert.ok(t1.state === 1 && t2.state === 1);
  let k = 0;
  while (k++ < 9000 && !(t1.state !== 1 && t2.state !== 1)) go(s);
  assert.ok(t1.state !== 1 && t2.state !== 1, 'nici un tren defect pe linie');
  for (let i = 0; i < 200; i++) go(s);
  assert.ok(!s.trains.some((q) => q.tow), 'nicio remorcă înțepenită');
  assert.ok(!s.trains.some((q) => q.dead && q.state === 1));
});

test('liftTrain: plătit, doar pe tren defect, duce trenul în depou și îl repară', () => {
  const { s, a, b } = yard();
  const [t1] = twoDead(s, a, b);
  const t3 = s.trains.find((q) => q !== t1 && !q.dead);
  assert.equal(cmd(s, { type: 'liftTrain', trainId: t3 ? t3.id : 999 }).err, t3 ? 'defect' : 'inexistent');
  const cash = s.companies[0].cash;
  ok(cmd(s, { type: 'liftTrain', trainId: t1.id }));
  assert.equal(cash - s.companies[0].cash, DEPOT.liftCost);
  assert.equal(t1.state, 3); assert.ok(t1.dq);
  assert.equal(cmd(s, { type: 'liftTrain', trainId: t1.id }).err, 'defect');
  for (let i = 0; i < 1500 && t1.state === 3; i++) go(s);
  assert.notEqual(t1.state, 3, 'reparat și iese');
  assert.ok(!t1.dead);
});

test('fără depou: ridicarea repară trenul pe loc, fără să ocupe linia, și revine', () => {
  const { s, a, b } = yard(false);
  const t = buy(s, 3, a, [a, b]);
  for (let k = 0; k < 4000 && !(t.state === 1 && xOf(s, t) >= 14); k++) go(s);
  t.dead = 1; t.speed = 0;
  ok(cmd(s, { type: 'liftTrain', trainId: t.id }));
  assert.equal(t.state, 3);
  assert.ok(s.resv.every((v) => v !== t.id + 1), 'linia nu mai e ținută');
  const m = t.money;
  for (let i = 0; i < 3000; i++) go(s);
  assert.ok(t.state !== 3 && !t.dead && t.money > m, 'a revenit în circulație');
});

test('automat: tren defect blocat peste ~10 zile e ridicat singur, cu mesaj în ziar', () => {
  const { s, a, b } = yard(false);
  const t = buy(s, 3, a, [a, b]);
  for (let k = 0; k < 4000 && !(t.state === 1 && xOf(s, t) >= 14); k++) go(s);
  t.dead = 1; t.speed = 0;
  for (let i = 0; i < DEPOT.liftAuto - 5; i++) go(s);
  assert.equal(t.state, 1, 'încă pe linie');
  for (let i = 0; i < 20; i++) go(s);
  assert.equal(t.state, 3);
  assert.ok(s.news.some((x) => x.text.includes('Macaraua a ridicat')));
});

test('determinism cu serializare la mijloc (remorcă + ridicare)', () => {
  const scen = (until) => {
    const { s, a, b } = yard();
    const [t1] = twoDead(s, a, b);
    for (let i = 0; i < until; i++) { if (i === 30) cmd(s, { type: 'liftTrain', trainId: t1.id }); go(s); }
    return s;
  };
  const w1 = scen(2500), half = scen(400);
  const s2 = deserialize(JSON.parse(JSON.stringify(serialize(half))));
  assert.equal(hashState(s2), hashState(half));
  for (let i = 400; i < 2500; i++) go(s2);
  assert.equal(hashState(s2), hashState(w1));
});
