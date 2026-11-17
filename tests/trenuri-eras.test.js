import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, applyCommand, stepWorld, hashState, availableModels, MODELS, START_YEARS } from '../games/trenuri/src/sim/index.js';

test('epoci noi: 1980, 2000 și 2025 au locomotive', () => {
  assert.deepEqual(START_YEARS, [1840, 1900, 1950, 1980, 2000, 2025]);
  assert.equal(availableModels(1950).length, 4);
  assert.deepEqual(availableModels(1980).map((m) => m.key), ['mic', 'abur', 'rapid', 'diesel', 'electric', 'glont']);
  assert.deepEqual(availableModels(2000).slice(6).map((m) => m.key), ['intercity', 'tgv']);
  assert.deepEqual(availableModels(2025).slice(8).map((m) => m.key), ['regio', 'hidrogen']);
});

test('modelele noi sunt la sfârșit, cu id-uri consecutive și progres de viteză, preț și întreținere', () => {
  MODELS.forEach((m, i) => assert.equal(m.id, i));
  assert.deepEqual(MODELS.slice(0, 6).map((m) => m.key), ['mic', 'abur', 'rapid', 'diesel', 'electric', 'glont']);
  for (let i = 1; i < MODELS.length; i++) {
    assert.ok(MODELS[i].year > MODELS[i - 1].year, 'anii cresc');
    assert.ok(MODELS[i].price > MODELS[i - 1].price && MODELS[i].maint > MODELS[i - 1].maint, 'prețul și întreținerea cresc');
    assert.ok(MODELS[i].rel >= MODELS[i - 1].rel);
  }
  assert.ok(MODELS.slice(5).every((m) => m.vmax > 60 && m.vmax < 256), 'viteza sub o placă pe pas');
  assert.ok(MODELS.every((m) => m.glb), 'glb de rezervă');
});

test('în 2025 se cumpără trenul pe hidrogen, în 1980 nu', () => {
  const buy = (year, model) => {
    const s = createWorld({ seed: 2, size: 'S', year });
    const c = s.cities[0], st = applyCommand(s, { type: 'buildStation', by: 0, x: c.x, y: c.y, size: 0 });
    assert.ok(st.ok, st.err);
    return [s, applyCommand(s, { type: 'buyTrain', by: 0, model, stationId: st.id })];
  };
  const hy = MODELS.findIndex((m) => m.key === 'hidrogen');
  assert.equal(buy(1980, hy)[1].err, 'epoca');
  const [s, r] = buy(2025, hy);
  assert.ok(r.ok, r.err);
  const h = hashState(s);
  for (let i = 0; i < 50; i++) stepWorld(s);
  assert.notEqual(hashState(s), h);
});
