import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, rng } from '../shared/engine/rng.js';

test('hashSeed e stabil și uint32', () => {
  assert.equal(hashSeed('abc'), hashSeed('abc'));
  assert.notEqual(hashSeed('abc'), hashSeed('abd'));
  const h = hashSeed('bobo');
  assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32);
});

test('aceeași sămânță dă aceeași secvență', () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const sa = Array.from({ length: 10 }, () => a.next());
  const sb = Array.from({ length: 10 }, () => b.next());
  const sc = Array.from({ length: 10 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('seed text = seed hashSeed(text)', () => {
  assert.equal(rng('x').next(), rng(hashSeed('x')).next());
});

test('next în [0,1)', () => {
  const r = rng(1);
  for (let i = 0; i < 1000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
});

test('int include ambele capete', () => {
  const r = rng(7), seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = r.int(3, 6);
    assert.ok(v >= 3 && v <= 6 && Number.isInteger(v));
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
});

test('range, pick, chance', () => {
  const r = rng(9);
  for (let i = 0; i < 200; i++) {
    const v = r.range(-2, 2);
    assert.ok(v >= -2 && v < 2);
  }
  assert.ok(['a', 'b', 'c'].includes(r.pick(['a', 'b', 'c'])));
  assert.equal(r.chance(0), false);
  assert.equal(r.chance(1), true);
});
