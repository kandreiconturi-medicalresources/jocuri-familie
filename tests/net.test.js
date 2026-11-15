import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, sameData, debounce, baseFrom, wsUrl, beatOutcome, fmtMinutes } from '../shared/net/util.js';

test('mergeData: maximul pe numere, recursiv pe obiecte', () => {
  const local = { unlocked: 3, stars: { 0: 3, 1: 1 }, twoPlayers: true };
  const remote = { unlocked: 5, stars: { 0: 2, 2: 3 }, fruits: { 0: 9 } };
  assert.deepEqual(mergeData(local, remote), { unlocked: 5, stars: { 0: 3, 1: 1, 2: 3 }, fruits: { 0: 9 }, twoPlayers: true });
  assert.equal(mergeData(undefined, 4), 4);
  assert.equal(mergeData(true, false), true);
  assert.ok(sameData({ a: 1 }, { a: 1 }));
});

test('debounce: o singură execuție, flush imediat', () => {
  let now = 0, id = 0, fired = 0;
  const jobs = new Map();
  const timers = { set: (fn, ms) => { jobs.set(++id, [fn, now + ms]); return id; }, clear: (i) => jobs.delete(i) };
  const tick = (ms) => { now += ms; for (const [i, [fn, at]] of [...jobs]) if (at <= now) { jobs.delete(i); fn(); } };
  const d = debounce(() => fired++, 2000, timers);
  d(); tick(1500); d(); tick(1500);
  assert.equal(fired, 0);
  tick(600);
  assert.equal(fired, 1);
  d(); assert.ok(d.pending());
  assert.ok(d.flush()); assert.equal(fired, 2);
  assert.equal(d.flush(), false);
});

test('baseFrom și wsUrl', () => {
  assert.equal(baseFrom('https://x.ts.net/assets/api-abc.js'), 'https://x.ts.net/');
  assert.equal(baseFrom('https://x.ts.net/sub/assets/api.js'), 'https://x.ts.net/sub/');
  assert.equal(baseFrom('http://localhost:5173/shared/net/api.js'), 'http://localhost:5173/');
  assert.equal(wsUrl('https://x.ts.net/'), 'wss://x.ts.net/ws');
  assert.equal(wsUrl('http://localhost:5173/'), 'ws://localhost:5173/ws');
});

test('beatOutcome: blocare la 2 bătăi ratate sau allowedNow fals', () => {
  assert.deepEqual(beatOutcome(0, null), { missed: 1, blocked: null });
  assert.deepEqual(beatOutcome(1, null), { missed: 2, blocked: 'offline' });
  assert.deepEqual(beatOutcome(1, { time: { allowedNow: true } }), { missed: 0, blocked: null });
  assert.deepEqual(beatOutcome(0, { time: { allowedNow: false, reason: 'hours' } }), { missed: 0, blocked: 'hours' });
  assert.equal(beatOutcome(0, { time: { allowedNow: false } }).blocked, 'limit');
});

test('fmtMinutes', () => {
  assert.equal(fmtMinutes(0), '0 min');
  assert.equal(fmtMinutes(125 * 60), '2 h 5 min');
  assert.equal(fmtMinutes(3600), '1 h');
});
