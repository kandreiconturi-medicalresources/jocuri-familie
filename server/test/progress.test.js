import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { mergeBobo } from '../src/routes/progress.js';

let s, k, other;
before(async () => { s = await startServer(); k = await s.createChild('prog'); other = await s.createChild('alt'); });
after(async () => { await s.close(); });

const put = (c, game, data) => s.raw('PUT', `/api/progress/${game}`, { cookie: c, body: { data } });
const get = (c, game) => s.raw('GET', `/api/progress/${game}`, { cookie: c });

test('progres gol, apoi salvat și citit; fiecare își vede doar progresul lui', async () => {
  assert.deepEqual((await get(k.cookie, 'curse')).json.data, null);
  assert.equal((await put(k.cookie, 'curse', { best: 42 })).status, 200);
  assert.deepEqual((await get(k.cookie, 'curse')).json.data, { best: 42 });
  assert.deepEqual((await get(other.cookie, 'curse')).json.data, null);
  assert.equal((await put(k.cookie, 'curse', { best: 10 })).json.data.best, 10, 'jocurile fără îmbinare suprascriu');
});

test('îmbinarea bobo: maximul pe nivel deblocat, steluțe și fructe', async () => {
  await put(k.cookie, 'bobo', { unlocked: 5, stars: { 0: 3, 1: 1, 4: 2 }, fruits: { 0: 10, 1: 4 }, twoPlayers: false });
  const r = await put(k.cookie, 'bobo', { unlocked: 3, stars: { 0: 1, 1: 3, 2: 2 }, fruits: { 0: 7, 2: 9 }, twoPlayers: true });
  assert.equal(r.status, 200);
  const want = { unlocked: 5, stars: { 0: 3, 1: 3, 2: 2, 4: 2 }, fruits: { 0: 10, 1: 4, 2: 9 }, twoPlayers: true };
  assert.deepEqual(r.json.data, want);
  assert.deepEqual((await get(k.cookie, 'bobo')).json.data, want);
});

test('îmbinarea bobo ignoră valori invalide și limitează steluțele la 3', () => {
  const m = mergeBobo({ unlocked: 2, stars: { 0: 2 } }, { unlocked: 'x', stars: { 0: 9, abc: 3, 1: -1, 2: 1.5 }, fruits: [1, 2] });
  assert.deepEqual(m, { unlocked: 2, stars: { 0: 3 }, fruits: {} });
  assert.deepEqual(mergeBobo(null, { unlocked: 1 }), { unlocked: 1, stars: {}, fruits: {} });
});

test('validare: joc, formă și mărime (≤ 64 KB)', async () => {
  assert.equal((await get(k.cookie, 'Bobo')).status, 404);
  assert.equal((await get(k.cookie, '..%2fx')).status, 404);
  assert.equal((await s.raw('PUT', '/api/progress/bobo', { cookie: k.cookie, body: { data: [1] } })).status, 400);
  assert.equal((await s.raw('PUT', '/api/progress/bobo', { cookie: k.cookie, body: { data: 1 } })).status, 400);
  assert.equal((await s.raw('PUT', '/api/progress/bobo', { cookie: k.cookie, body: { data: {}, x: 1 } })).status, 400);
  assert.equal((await put(k.cookie, 'mare', { s: 'x'.repeat(60 * 1024) })).status, 200);
  assert.equal((await put(k.cookie, 'mare', { s: 'x'.repeat(65 * 1024) })).status, 413);
});
