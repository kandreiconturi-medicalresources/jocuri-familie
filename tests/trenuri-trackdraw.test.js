// Desenul liber al șinei: urmă → plăci → plan → comenzi (logica pură, fără DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand, COST, MAX_STEP } from '../games/trenuri/src/sim/index.js';
import { smoothTrace, extend, line, dirOf, turn, straight } from '../games/trenuri/src/sim/trace.js';
import { planTrace, K } from '../games/trenuri/src/sim/tracePlan.js';

function flat(extra = {}) {
  const s = createWorld({ seed: 4, size: 'S', year: 1950, ...extra });
  s.height.fill(8); s.water.fill(0); s.forest.fill(0); s.occ.fill(0); s.roads.fill(0);
  s.industries.length = 0; s.cities.length = 0;
  s.companies[0].cash = 1e7;
  return s;
}
const hline = (y, x0, x1) => { const o = []; for (let x = x0; x <= x1; x++) o.push([x, y]); return o; };
/** Aplică toate comenzile planului; întoarce banii cheltuiți. */
function build(s, plan) {
  const before = s.companies[0].cash;
  for (const c of plan.cmds) { const r = applyCommand(s, { by: 0, ...c }); assert.ok(r.ok, JSON.stringify(c).slice(0, 80) + ' → ' + r.err); }
  return before - s.companies[0].cash;
}

test('netezire: urma tremurată devine curbă fără zigzag, dubluri sau întoarceri', () => {
  const s = flat(), raw = [], idx = new Map();
  for (let x = 4; x < 40; x++) extend(raw, idx, s.w, [x, 20 + (x % 3 === 0 ? 1 : x % 3 === 1 ? -1 : 0)]); // tremur ±1
  extend(raw, idx, s.w, [38, 20]); extend(raw, idx, s.w, [30, 20]); // întoarcere: se taie
  const t = smoothTrace(raw, s.w), keys = new Set(t.map((q) => q.join()));
  assert.equal(keys.size, t.length, 'fără dubluri');
  let changes = 0, prev = -1;
  for (let k = 1; k < t.length; k++) {
    assert.ok(Math.max(Math.abs(t[k][0] - t[k - 1][0]), Math.abs(t[k][1] - t[k - 1][1])) === 1, 'plăci vecine');
    const d = dirOf(t[k - 1], t[k]);
    if (prev >= 0) { assert.ok(turn(prev, d) <= 1, 'curbe de cel mult 45°'); if (prev !== d) changes++; }
    prev = d;
  }
  let rawChanges = 0;
  for (let k = 2; k < raw.length; k++) if (dirOf(raw[k - 2], raw[k - 1]) !== dirOf(raw[k - 1], raw[k])) rawChanges++;
  assert.ok(changes < rawChanges / 2, `mai puține schimbări de direcție: ${changes} < ${rawChanges}`);
  // colț drept → două curbe de 45°
  const c = smoothTrace([[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6]], s.w);
  for (let k = 2; k < c.length; k++) assert.ok(turn(dirOf(c[k - 2], c[k - 1]), dirOf(c[k - 1], c[k])) <= 1);
  assert.deepEqual(straight([0, 0], [9, 3], true).slice(-1)[0], [9, 0], 'Ctrl: pe orizontală');
});

test('apa dă pod, iar costul din plan = banii cheltuiți de applyCommand', () => {
  const s = flat();
  for (let y = 0; y < s.h; y++) for (let x = 20; x <= 23; x++) { s.water[y * s.w + x] = 1; s.height[y * s.w + x] = 2; }
  for (let x = 30; x < 33; x++) s.forest[20 * s.w + x] = 1;
  const p = planTrace(s, hline(20, 8, 40));
  assert.ok(p.ok, p.err);
  assert.equal(p.kind.filter((k) => k === K.BRIDGE).length, 4);
  assert.equal(p.kind.filter((k) => k === K.CLEAR).length, 3);
  assert.equal(p.parts.bridge, 4 * COST.water);
  assert.equal(p.parts.clear, 3 * 30);
  assert.equal(p.cost, p.parts.rail + p.parts.bridge + p.parts.clear + p.parts.level + p.parts.tunnel);
  assert.equal(p.cmds.length, 1);
  assert.equal(build(s, p), p.cost, 'costul previzualizat = costul real');
  assert.ok(s.track[20 * s.w + 21] & 0x100, 'pod construit');
});

test('panta dă nivelare, costul e corect', () => {
  const s = flat();
  for (let y = 0; y < s.h; y++) for (let x = 24; x < s.w; x++) s.height[y * s.w + x] = 8 + MAX_STEP + 3; // treaptă prea mare
  const p = planTrace(s, hline(20, 10, 40));
  assert.ok(p.ok, p.err);
  assert.ok(p.kind.includes(K.LEVEL), 'tile de nivelare');
  assert.ok(p.parts.level > 0);
  assert.equal(p.cmds[0].level.length > 0, true);
  assert.equal(build(s, p), p.cost);
});

test('dealul scurt dă tunel (linie dreaptă), cost corect', () => {
  const s = flat();
  for (let y = 0; y < s.h; y++) for (let x = 30; x <= 33; x++) s.height[y * s.w + x] = 14; // deal de 4 plăci
  const p = planTrace(s, hline(20, 10, 55));
  assert.ok(p.ok, p.err);
  assert.ok(p.kind.filter((k) => k === K.TUNNEL).length >= 4, 'plăci de tunel');
  assert.ok(p.cmds.some((c) => c.type === 'buildTunnel'));
  assert.equal(p.parts.level, 0);
  assert.equal(build(s, p), p.cost);
});

test('orașul (obstacol) dă ocolire locală', () => {
  const s = flat();
  for (let y = 15; y <= 25; y++) for (let x = 28; x <= 32; x++) s.occ[y * s.w + x] = 1;
  const p = planTrace(s, hline(20, 10, 50));
  assert.ok(p.ok, p.err);
  assert.ok(p.kind.includes(K.DETOUR));
  for (const [x, y] of p.tiles) assert.ok(!s.occ[y * s.w + x], 'nu trece prin clădiri');
  assert.equal(p.tiles[0].join(), '10,20'); assert.equal(p.tiles[p.tiles.length - 1].join(), '50,20');
  assert.equal(build(s, p), p.cost);
  // fără ocolire posibilă: planul e marcat ca nereușit
  const z = flat();
  for (let y = 0; y < z.h; y++) for (let x = 28; x <= 32; x++) z.occ[y * z.w + x] = 1;
  const q = planTrace(z, hline(20, 10, 50));
  assert.ok(!q.ok); assert.ok(q.kind.includes(K.BAD));
});

test('capetele pe apă sau în clădire sunt tăiate; planul gol nu are comenzi', () => {
  const s = flat();
  for (let x = 5; x < 12; x++) s.water[20 * s.w + x] = 1;
  const p = planTrace(s, hline(20, 8, 30));
  assert.ok(p.ok); assert.equal(p.tiles[0][0], 12);
  const e = planTrace(s, [[3, 3]]);
  assert.ok(!e.ok); assert.equal(e.cmds.length, 0);
});

import { startDecision, anchorNear, HOLD_MS } from '../games/trenuri/src/input/touchGate.js';
test('touch: desen sau cameră după start, durată, degete și comutator', () => {
  const T = { touch: true, fingers: 1, mode: 'pan', anchor: false };
  assert.equal(startDecision({ ...T, touch: false }), 'draw', 'mouse desenează');
  assert.equal(startDecision({ ...T }), 'wait');
  assert.equal(startDecision({ ...T, holdMs: HOLD_MS - 1 }), 'wait');
  assert.equal(startDecision({ ...T, holdMs: HOLD_MS }), 'draw', 'apăsare lungă');
  assert.equal(startDecision({ ...T, moved: true, holdMs: 100 }), 'camera', 'a mișcat înainte de 300 ms');
  assert.equal(startDecision({ ...T, anchor: true, moved: true }), 'draw', 'de pe ancoră');
  assert.equal(startDecision({ ...T, mode: 'draw' }), 'draw', 'comutator Desenez');
  assert.equal(startDecision({ ...T, fingers: 2, anchor: true, mode: 'draw' }), 'camera', 'două degete = cameră');
  const s = flat();
  s.occ[30 * s.w + 30] = 1;
  assert.ok(anchorNear(s, 31.4 + 0.5, 30.5), 'în toleranță');
  assert.ok(!anchorNear(s, 34, 30.5), 'prea departe');
  applyCommand(s, { type: 'buildStation', by: 0, x: 10, y: 10, size: 1 });
  assert.ok(anchorNear(s, 11.2, 10.5), 'gară');
});
