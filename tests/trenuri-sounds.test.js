import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, weightOf, pickLoud, createLimiter, inView, zoomGain } from '../games/trenuri/src/audio/trainMix.js';
import { MODELS } from '../games/trenuri/src/sim/consts.js';

test('tipul sunetului după câmpurile modelului', () => {
  assert.equal(kindOf({ smoke: true, vmax: 20 }), 'steam');
  assert.equal(kindOf({ key: 'diesel', vmax: 40 }), 'diesel');
  assert.equal(kindOf({ key: 'x', vmax: 48 }), 'electric');
  assert.equal(kindOf({ key: 'y', vmax: 90 }), 'fast');
  assert.deepEqual(MODELS.slice(0, 6).map((m) => kindOf(m)), ['steam', 'steam', 'steam', 'diesel', 'electric', 'fast']);
});

test('ponderea scade cu distanța și cu zoom-ul larg', () => {
  const cam = { x: 10, z: 10, dist: 20 };
  assert.ok(weightOf(10, 10, cam) > weightOf(14, 10, cam));
  assert.equal(weightOf(60, 10, cam), 0);
  assert.ok(zoomGain(15) > zoomGain(60));
  assert.equal(weightOf(10, 10, { x: 10, z: 10, dist: 200 }), 0);
});

test('selecția păstrează cele mai apropiate trenuri', () => {
  const cam = { x: 0, z: 0, dist: 20 };
  const items = [1, 2, 3, 4, 5].map((i) => ({ id: i, x: i * 2, z: 0 }));
  assert.deepEqual(pickLoud(items, cam, 3).map((o) => o.id), [1, 2, 3]);
  assert.equal(pickLoud([{ id: 9, x: 500, z: 0 }], cam, 3).length, 0);
});

test('limitatorul lasă un corn la câteva secunde', () => {
  const l = createLimiter(4);
  assert.ok(l.allow(0)); assert.ok(!l.allow(3.9)); assert.ok(l.allow(4)); l.reset(); assert.ok(l.allow(4.1));
});

test('doar trenurile din cadru sună', () => {
  assert.ok(inView(1, 1, { x: 0, z: 0, dist: 30 }));
  assert.ok(!inView(100, 0, { x: 0, z: 0, dist: 30 }));
  assert.ok(!inView(0, 0, { x: 0, z: 0, dist: 120 }));
});
