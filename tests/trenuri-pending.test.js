import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand } from '../games/trenuri/src/sim/index.js';
import { reduce, quote, decorate, isTwoPoint, oneCmd } from '../games/trenuri/src/input/pendingBuild.js';

const world = () => createWorld({ seed: 3, size: 'S', year: 1950 });
const dry = (s, x, y) => !s.water[y * s.w + x] && s.height[y * s.w + x] > 1 && !s.occ[y * s.w + x] && !(s.track[y * s.w + x] & 0x4000);
function freeTile(s) { for (let y = 2; y < s.h - 8; y++) for (let x = 2; x < s.w - 8; x++) if (dry(s, x, y)) return { x, y, fx: x + 0.5, fz: y + 0.5 }; return null; }

test('mașina de stări: start, hover, tap, cancel', () => {
  const a = { x: 3, y: 4 }, b = { x: 9, y: 4 }, c = { x: 9, y: 8 };
  let st = reduce(null, { type: 'start', kind: 'track', a });
  assert.deepEqual(st, { kind: 'track', a, b: null, locked: false });
  st = reduce(st, { type: 'hover', b });
  assert.deepEqual(st.b, b); assert.equal(st.locked, false);
  st = reduce(st, { type: 'tap', b: c });
  assert.deepEqual(st.b, c); assert.equal(st.locked, true);
  assert.deepEqual(reduce(st, { type: 'hover', b }).b, c, 'după atingere, mouse-ul nu mai mută capătul');
  assert.deepEqual(reduce(st, { type: 'tap', b }).b, b, 'o nouă atingere mută capătul');
  assert.equal(reduce(st, { type: 'cancel' }), null);
});

test('construcțiile cu un loc ignoră capătul; tipuri necunoscute nu pornesc nimic', () => {
  const st = reduce(null, { type: 'start', kind: 'station', a: { x: 1, y: 1 } });
  assert.equal(reduce(st, { type: 'tap', b: { x: 5, y: 5 } }), st);
  assert.equal(reduce(null, { type: 'start', kind: 'zbor', a: { x: 1, y: 1 } }), null);
  assert.equal(reduce(null, { type: 'start', kind: 'station' }), null);
  assert.ok(isTwoPoint('bridge') && !isTwoPoint('depot'));
});

test('quote: gară și terminal pe teren liber, fără să schimbe lumea', () => {
  const s = world(), t = freeTile(s), cash = s.companies[0].cash, nSt = s.stations.length;
  const q = quote(s, 0, { kind: 'station', a: t }, { size: 1 });
  assert.ok(q.ok && q.cost > 0);
  assert.equal(s.companies[0].cash, cash); assert.equal(s.stations.length, nSt);
  assert.equal(applyCommand(s, { by: 0, ...q.cmd }).cost, q.cost, 'prețul din previzualizare = prețul real');
  const tq = quote(s, 0, { kind: 'terminal', a: t }, { tdir: -1 });
  assert.ok(tq.ok === true || typeof tq.text === 'string');
});

test('quote: motiv când nu se poate (depou fără capăt de linie, bani puțini)', () => {
  const s = world(), t = freeTile(s);
  const d = quote(s, 0, { kind: 'depot', a: t });
  assert.equal(d.ok, false); assert.ok(d.text);
  s.companies[0].cash = 10;
  const q = quote(s, 0, { kind: 'station', a: t }, { size: 1 });
  assert.equal(q.ok, false); assert.equal(q.err, 'bani');
});

test('quote: șina cere capătul, apoi dă cost și comandă; nu merge fără bani', () => {
  const s = world(), t = freeTile(s), b = { x: t.x + 5, y: t.y };
  assert.equal(quote(s, 0, { kind: 'track', a: t, b: null }).wait, true);
  const q = quote(s, 0, { kind: 'track', a: t, b });
  if (q.ok) {
    assert.equal(q.cmd.type, 'buildTrack'); assert.ok(q.path.length >= 2);
    const r = applyCommand(s, { by: 0, ...q.cmd });
    assert.ok(r.ok);
  } else assert.ok(q.text);
  const s2 = world(); s2.companies[0].cash = 0;
  const q2 = quote(s2, 0, { kind: 'track', a: t, b });
  if (q2.cost > 0) assert.equal(q2.err, 'bani');
});

test('quote: nivelare și pod', () => {
  const s = world(), t = freeTile(s);
  const l = quote(s, 0, { kind: 'level', a: t, b: { x: t.x + 2, y: t.y + 2 } });
  assert.ok(l.ok ? l.cmd.type === 'levelTerrain' : !!l.text);
  const p = quote(s, 0, { kind: 'bridge', a: t, b: { x: t.x + 1, y: t.y } });
  assert.equal(p.ok, false);
});

test('decorate: prețul la opțiunile posibile, motivul la cele imposibile', () => {
  const s = world(), t = freeTile(s);
  const out = decorate(s, 0, t, [{ id: 'station', label: 'G' }, { id: 'depot', label: 'D' }, { id: 'track', label: 'S' }], (c) => 'lei ' + c);
  assert.match(out[0].sub, /^lei \d+/);
  assert.ok(out[1].off);
  assert.deepEqual(out[2], { id: 'track', label: 'S' });
  assert.equal(oneCmd(s, 'port', t).type, 'buildPort');
});
