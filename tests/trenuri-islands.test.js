import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createNetWorld, hashMap, hashState, applyCommand, stepWorld, islandAt, islandGoods, PRIMARY, INDUSTRIES, wantOf, generateIslands, NG } from '../games/trenuri/src/sim/index.js';

const world = (seed, ai = [1], size = 'S') => createWorld({ seed, size, map: 'islands', year: 1950, ai });
const typesOn = (s, k) => s.industries.filter((o) => islandAt(s, o.x, o.y) === k).map((o) => o.type);

test('insule: același seed dă aceeași hartă, alt seed altă hartă; o insulă per companie', () => {
  const a = world(7, [1, 2]), b = world(7, [1, 2]), c = world(8, [1, 2]);
  assert.equal(hashMap(a), hashMap(b));
  assert.equal(hashState(a), hashState(b));
  assert.deepEqual(a.islands, b.islands);
  assert.notEqual(hashMap(a), hashMap(c));
  assert.equal(a.islands.length, 3);
  assert.deepEqual(a.islands.map((q) => q.owner), [0, 1, 2]);
  for (const q of a.islands) assert.ok(a.cities.some((ct) => islandAt(a, ct.x, ct.y) === q.id), 'fiecare insulă are oraș');
  const solo = world(3, []);
  assert.equal(solo.islands.length, 2, 'singur: insula ta + una fără stăpân');
  assert.equal(solo.islands[1].owner, -1);
});

test('insule: resursele primare sunt împărțite (≥ 2 insule fiecare de la 3 insule, nicio insulă completă)', () => {
  for (let n = 2; n <= 8; n++) for (const seed of [1, 5, 9]) {
    const g = generateIslands(seed, 'S', n);
    assert.equal(g.islands.length, n);
    for (let k = 0; k < n; k++) assert.ok(g.islands[k].has.length < PRIMARY.length, `insula ${k} are tot (n=${n})`);
    for (const t of PRIMARY) {
      const on = g.islands.filter((q) => q.has.includes(t)).length;
      assert.ok(on >= (n >= 3 ? 2 : 1), `resursa ${INDUSTRIES[t].key} pe ${on} insule (n=${n}, seed=${seed})`);
    }
  }
  const s = world(11, [1, 1, 1]);
  s.islands.forEach((q, k) => {
    const prim = [...new Set(typesOn(s, k).filter((t) => PRIMARY.includes(t)))].sort((x, y) => x - y);
    assert.deepEqual(prim, q.has, '`has` = industriile primare reale');
    const can = islandGoods(s, k), mine = s.cities.filter((c) => islandAt(s, c.x, c.y) === k);
    const lacks = mine.some((c) => { for (let gg = 2; gg < NG; gg++) if (wantOf(c, gg) > 0 && !can[gg]) return true; return false; });
    assert.ok(lacks, `orașele de pe ${q.name} cer și ce nu se face acolo`);
  });
});

test('insule: construcția pe insula altuia e refuzată, pe a ta și pe cea fără stăpân merge', () => {
  const s = world(4, [1]);
  const spot = (k) => { const q = s.islands[k], c = s.cities.find((ct) => islandAt(s, ct.x, ct.y) === k); for (let d = 4; d < 12; d++) for (const [x, y] of [[c.x + d, c.y], [c.x - d, c.y], [c.x, c.y + d], [c.x, c.y - d]]) { const i = y * s.w + x; if (x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1 && !s.water[i] && !s.occ[i] && !s.roads[i] && !s.track[i]) return { x, y }; } return null; };
  const foreign = spot(1), own = spot(0);
  const r = applyCommand(s, { type: 'buildStation', by: 0, x: foreign.x, y: foreign.y, size: 0 });
  assert.equal(r.ok, false); assert.equal(r.err, 'insula');
  assert.equal(applyCommand(s, { type: 'buildTrack', by: 0, path: [[foreign.x, foreign.y], [foreign.x + 1, foreign.y]] }).err, 'insula');
  assert.equal(applyCommand(s, { type: 'clearArea', by: 0, x0: foreign.x - 1, y0: foreign.y - 1, x1: foreign.x + 1, y1: foreign.y + 1 }).err, 'insula');
  assert.ok(applyCommand(s, { type: 'buildStation', by: 0, x: own.x, y: own.y, size: 0 }).ok);
  assert.equal(applyCommand(s, { type: 'buildStation', by: 1, x: own.x + 1, y: own.y, size: 0 }).err, 'insula', 'nici AI-ul nu construiește la tine');
  const solo = world(3, []), q = solo.islands[1], c = solo.cities.find((ct) => islandAt(solo, ct.x, ct.y) === 1);
  let ok = false;
  for (let d = 4; d < 10 && !ok; d++) if (c.x + d < q.x1) ok = applyCommand(solo, { type: 'buildStation', by: 0, x: c.x + d, y: c.y, size: 0 }).ok;
  assert.ok(ok, 'pe insula fără stăpân se poate construi');
});

test('insule: AI-urile construiesc doar pe insula lor, joc fără sfârșit determinist', () => {
  const a = world(21, [2, 2]), b = world(21, [2, 2]);
  for (let i = 0; i < 6000; i++) { stepWorld(a); stepWorld(b); }
  assert.equal(hashState(a), hashState(b));
  assert.ok(a.stations.length > 2, 'AI-urile au construit');
  for (const st of a.stations) { const k = islandAt(a, st.x, st.y); assert.ok(k < 0 || a.islands[k].owner === st.owner, `${st.name} e pe insula altuia`); }
  assert.equal(a.scn, undefined); assert.equal(a.over, undefined);
});

test('insule în rețea: createNetWorld cu map islands dă o insulă fiecărui jucător', () => {
  const PL = [{ id: 'a', name: 'Ana', color: '#ff6b6b' }, { id: 'b', name: 'Bob', color: '#4dabf7' }, { id: 'c', name: 'Cip', color: '#ffd23f' }];
  const s = createNetWorld({ mode: 'comp', seed: 5, size: 'S', year: 1950, map: 'islands', ai: [1], players: PL });
  assert.equal(s.islands.length, 4);
  assert.deepEqual(s.islands.map((q) => q.owner), [0, 1, 2, 3]);
  assert.ok(s.companies[3].ai, 'al patrulea e AI');
  const t = createNetWorld({ mode: 'comp', seed: 5, size: 'S', year: 1950, map: 'islands', ai: [1], players: PL });
  assert.equal(hashState(s), hashState(t));
});
