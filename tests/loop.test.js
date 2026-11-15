import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepAccumulator } from '../shared/engine/loop.js';

const STEP = 1 / 60;

test('un cadru de 60 Hz = un pas', () => {
  const r = stepAccumulator(0, STEP, STEP);
  assert.equal(r.steps, 1);
  assert.ok(r.acc < STEP);
});

test('cadru mic: niciun pas, restul se păstrează', () => {
  const r = stepAccumulator(0, STEP / 2, STEP);
  assert.equal(r.steps, 0);
  assert.ok(Math.abs(r.alpha - 0.5) < 1e-9);
  const r2 = stepAccumulator(r.acc, STEP / 2, STEP);
  assert.equal(r2.steps, 1);
});

test('ecran 120 Hz: un pas la două cadre', () => {
  let acc = 0, total = 0;
  for (let i = 0; i < 120; i++) {
    const r = stepAccumulator(acc, 1 / 120, STEP);
    acc = r.acc; total += r.steps;
  }
  assert.ok(total === 60 || total === 59);
});

test('cadru de 30 Hz: doi pași', () => {
  assert.equal(stepAccumulator(0, 1 / 30, STEP).steps, 2);
});

test('plafon de 5 pași și restul se aruncă', () => {
  const r = stepAccumulator(0, 1, STEP, 5);
  assert.equal(r.steps, 5);
  assert.equal(r.acc, 0);
  assert.equal(r.alpha, 0);
});

test('alpha rămâne în [0,1)', () => {
  let acc = 0;
  for (let i = 0; i < 200; i++) {
    const r = stepAccumulator(acc, 0.013 + (i % 7) * 0.004, STEP);
    acc = r.acc;
    assert.ok(r.alpha >= 0 && r.alpha < 1);
  }
});
