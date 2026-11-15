import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, hashState, hashMap, serialize, deserialize, applyCommand, planTrack, stepWorld } from '../games/trenuri/src/sim/index.js';

const flat = (seed = 3) => { // lume plată fără apă, fără păduri, pentru teste de planificare
  const s = createWorld({ seed, size: 'S', year: 1950 });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  return s;
};
const ok = (r) => { assert.ok(r.ok, r.err); return r; };

/** Linie între primele două orașe: 2 gări + șină + tren cu rută. */
function setup(s) {
  for (let i = 0; i < s.cities.length; i++) for (let j = i + 1; j < s.cities.length; j++) {
    const a = s.cities[i], b = s.cities[j], p = planTrack(s, [a.x, a.y], [b.x, b.y], 0);
    if (!p || p.cost > 15000) continue;
    const g1 = ok(applyCommand(s, { type: 'buildStation', by: 0, x: a.x, y: a.y, size: 1 }));
    const g2 = ok(applyCommand(s, { type: 'buildStation', by: 0, x: b.x, y: b.y, size: 1 }));
    return { a, b, p, g1: g1.id, g2: g2.id };
  }
  assert.fail('niciun traseu între orașe');
}

test('același seed dă aceeași hartă', () => {
  assert.equal(hashMap(createWorld({ seed: 77, size: 'M' })), hashMap(createWorld({ seed: 77, size: 'M' })));
  assert.equal(hashState(createWorld({ seed: 'abc' })), hashState(createWorld({ seed: 'abc' })));
  assert.notEqual(hashMap(createWorld({ seed: 1 })), hashMap(createWorld({ seed: 2 })));
  const s = createWorld({ seed: 9, size: 'L' });
  assert.ok(s.cities.length >= 6 && s.cities.length <= 14);
});

function run(withSave) {
  let s = createWorld({ seed: 11, size: 'S', year: 1950 });
  const { p, g1, g2 } = setup(s);
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }));
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 3, stationId: g1 }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route: [g1, g2] }));
  for (let i = 0; i < 10000; i++) {
    if (withSave && i === 4321) s = deserialize(JSON.parse(JSON.stringify(serialize(s))));
    stepWorld(s);
  }
  return s;
}

test('aceleași comenzi dau același hashState după 10.000 de pași (și după serializare)', () => {
  const a = run(false), b = run(false), c = run(true);
  assert.equal(hashState(a), hashState(b));
  assert.equal(hashState(a), hashState(c));
  assert.ok(a.tick === 10000 && a.date.m >= 1 && a.companies[0].history.length > 5);
});

test('planTrack ocolește apa când ocolul e scurt', () => {
  const s = flat();
  for (let y = 0; y <= 3; y++) s.water[y * s.w + 10] = 1;
  const p = planTrack(s, [5, 2], [15, 2], 0);
  assert.ok(p && p.path.every(([x, y]) => !s.water[y * s.w + x]));
});

test('planTrack pune pod plătit când apa nu se ocolește', () => {
  const s = flat();
  for (let y = 0; y < s.h; y++) s.water[y * s.w + 10] = 1;
  const p = planTrack(s, [5, 30], [15, 30], 0);
  assert.ok(p);
  const wet = p.path.filter(([x, y]) => s.water[y * s.w + x]).length;
  assert.ok(wet >= 1 && p.cost >= 1000 * wet);
  const before = s.companies[0].cash;
  const r = ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }));
  assert.equal(before - s.companies[0].cash, r.cost);
});

test('applyCommand refuză fără bani sau pe teren interzis', () => {
  const s = flat();
  const p = planTrack(s, [5, 30], [20, 30], 0);
  s.companies[0].cash = 100;
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }).err, 'bani');
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: 6, y: 6, size: 2 }).err, 'bani');
  s.companies[0].cash = 1e6;
  s.water[30 * s.w + 5] = 1; // apă la capăt: nu poate începe un pod
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }).err, 'apa');
  s.water[30 * s.w + 5] = 0;
  s.occ[30 * s.w + 10] = 1;
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }).err, 'cladire');
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: 10, y: 30, size: 0 }).err, 'cladire');
  s.water[40 * s.w + 40] = 1;
  assert.equal(applyCommand(s, { type: 'buildStation', by: 0, x: 40, y: 40, size: 0 }).err, 'teren');
  s.height[20 * s.w + 20] = 14; // prea abrupt
  const h0 = hashState(s);
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: [[19, 20], [20, 20]] }).err, 'panta');
  assert.equal(hashState(s), h0, 'comenzile refuzate nu schimbă starea');
});

test('tren între două gări legate: ajunge, încarcă, livrează, compania câștigă', () => {
  const s = createWorld({ seed: 21, size: 'S', year: 1950 });
  const { p, g1, g2 } = setup(s);
  ok(applyCommand(s, { type: 'buildTrack', by: 0, path: p.path }));
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 2, stationId: g1 }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route: [g1, g2] }));
  const cash0 = s.companies[0].cash, tr = s.trains[0];
  let visited2 = false, loadedSome = false;
  for (let i = 0; i < 3000; i++) {
    stepWorld(s);
    if (tr.state === 2 && tr.to === g2) visited2 = true;
    if (tr.load.length) loadedSome = true;
  }
  assert.ok(visited2 && loadedSome, 'a ajuns și a încărcat');
  assert.ok(tr.money > 0 && s.companies[0].cash > cash0, 'a câștigat bani');
});

test('trenul nu pleacă dacă gările nu sunt legate', () => {
  const s = createWorld({ seed: 21, size: 'S', year: 1950 });
  const { g1, g2 } = setup(s);
  const t = ok(applyCommand(s, { type: 'buyTrain', by: 0, model: 0, stationId: g1 }));
  ok(applyCommand(s, { type: 'setRoute', by: 0, trainId: t.id, route: [g1, g2] }));
  for (let i = 0; i < 600; i++) stepWorld(s);
  const tr = s.trains[0];
  assert.equal(tr.state, 2); assert.equal(tr.speed, 0); assert.equal(tr.to, g1);
  assert.ok(s.news.some((n) => /nu găsește drum/.test(n.text)));
});
