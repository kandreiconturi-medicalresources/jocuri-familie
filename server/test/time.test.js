import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { localClock, hoursWindow } from '../src/time.js';

let s;
before(async () => { s = await startServer(); });
after(async () => { await s.close(); });

const beat = async (c, game = 'bobo') => (await s.raw('POST', '/api/time/heartbeat', { cookie: c, body: { game } })).json.time;
const patch = (id, body) => s.raw('PATCH', `/api/admin/users/${id}`, { cookie: s.adminCookie, body });

test('ziua și ora se calculează în fusul Europe/Bucharest (inclusiv ora de vară)', () => {
  assert.deepEqual(localClock(Date.parse('2026-03-10T22:30:00Z'), 'Europe/Bucharest'), { day: '2026-03-11', sec: 30 * 60 });
  assert.deepEqual(localClock(Date.parse('2026-07-01T21:15:00Z'), 'Europe/Bucharest'), { day: '2026-07-02', sec: 15 * 60 });
  assert.deepEqual(localClock(Date.parse('2026-03-29T00:30:00Z'), 'Europe/Bucharest'), { day: '2026-03-29', sec: 2.5 * 3600 });
});

test('intervalul orar, inclusiv peste miezul nopții', () => {
  const at = (h, m = 0) => h * 3600 + m * 60;
  assert.deepEqual(hoursWindow(null, null, at(3)), { allowed: true, secLeft: null });
  assert.deepEqual(hoursWindow('08:00', '20:00', at(12)), { allowed: true, secLeft: at(8) });
  assert.equal(hoursWindow('08:00', '20:00', at(20)).allowed, false);
  assert.equal(hoursWindow('08:00', '20:00', at(7, 59)).allowed, false);
  assert.deepEqual(hoursWindow('22:00', '02:00', at(23)), { allowed: true, secLeft: at(3) });
  assert.deepEqual(hoursWindow('22:00', '02:00', at(1)), { allowed: true, secLeft: at(1) });
  assert.equal(hoursWindow('22:00', '02:00', at(12)).allowed, false);
  assert.equal(hoursWindow('16:00', null, at(15)).allowed, false);
  assert.deepEqual(hoursWindow(null, '19:30', at(19)), { allowed: true, secLeft: 30 * 60 });
});

test('contorizare: cel mult 35 s pe bătaie, prima bătaie nu adaugă nimic', async () => {
  const k = await s.createChild('tim', { limits: { minutesPerDay: 10, from: null, to: null } });
  let t = await beat(k.cookie);
  assert.equal(t.usedToday, 0);
  assert.equal(t.minutesPerDay, 10);
  assert.equal(t.remainingSec, 600);
  s.clock.t += 30_000;
  t = await beat(k.cookie);
  assert.equal(t.usedToday, 30);
  s.clock.t += 60_000; // bătaie ratată
  t = await beat(k.cookie);
  assert.equal(t.usedToday, 65);
  s.clock.t += 10 * 60_000; // pauză lungă: sesiune nouă
  t = await beat(k.cookie);
  assert.equal(t.usedToday, 65);
  assert.equal(t.remainingSec, 535);
  assert.equal(t.allowedNow, true);
  assert.equal(t.reason, null);
  const me = await s.raw('GET', '/api/me', { cookie: k.cookie });
  assert.equal(me.json.time.usedToday, 65);
});

test('două dispozitive nu dublează timpul', async () => {
  const k = await s.createChild('doi', { limits: { minutesPerDay: 60, from: null, to: null } });
  const second = (await s.login('doi', k.password)).cookie;
  await beat(k.cookie);
  for (let i = 0; i < 10; i++) {
    s.clock.t += 15_000;
    await beat(i % 2 ? k.cookie : second);
  }
  const t = await beat(k.cookie);
  assert.equal(t.usedToday, 150); // 10 × 15 s, nu 2 × 150
});

test('limita: se oprește la zero, bonusul adaugă minute doar azi, ziua nouă resetează', async () => {
  const k = await s.createChild('lim', { limits: { minutesPerDay: 1, from: null, to: null } });
  await beat(k.cookie);
  s.clock.t += 30_000; await beat(k.cookie);
  s.clock.t += 30_000;
  let t = await beat(k.cookie);
  assert.equal(t.usedToday, 60);
  assert.equal(t.allowedNow, false);
  assert.equal(t.reason, 'limit');
  assert.equal(t.remainingSec, 0);
  s.clock.t += 30_000;
  t = await beat(k.cookie);
  assert.equal(t.usedToday, 60, 'nu mai numără după limită');

  const b = await s.raw('POST', `/api/admin/users/${k.id}/bonus`, { cookie: s.adminCookie, body: { minutes: 5 } });
  assert.equal(b.status, 200);
  assert.equal(b.json.time.bonusToday, 5);
  assert.equal(b.json.time.allowedNow, true);
  assert.equal(b.json.time.remainingSec, 300);
  assert.equal((await s.raw('POST', `/api/admin/users/${k.id}/bonus`, { cookie: s.adminCookie, body: { minutes: 1.5 } })).status, 400);

  s.clock.t += 24 * 3600_000;
  t = await beat(k.cookie);
  assert.equal(t.usedToday, 0);
  assert.equal(t.bonusToday, 0);
  assert.equal(t.allowedNow, true);
});

test('intervalul orar: în afara lui nu se joacă și nu se numără', async () => {
  const k = await s.createChild('ore', { limits: { minutesPerDay: null, from: '08:00', to: '09:00' } });
  // ora curentă a ceasului de test e în afara intervalului 08–09 dacă nu e între 08 și 09
  const { sec } = localClock(s.clock.t, 'Europe/Bucharest');
  const inside = sec >= 8 * 3600 && sec < 9 * 3600;
  let t = await beat(k.cookie);
  assert.equal(t.allowedNow, inside);
  if (!inside) assert.equal(t.reason, 'hours');
  await patch(k.id, { limits: { minutesPerDay: null, from: null, to: null } });
  t = await beat(k.cookie);
  assert.equal(t.allowedNow, true);
  assert.equal(t.minutesPerDay, null);
  assert.equal(t.remainingSec, null);
  // interval care se închide în 20 de minute: remainingSec arată asta
  const toHm = new Date(s.clock.t + 20 * 60_000).toLocaleTimeString('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fromHm = new Date(s.clock.t - 60 * 60_000).toLocaleTimeString('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  await patch(k.id, { limits: { minutesPerDay: 120, from: fromHm, to: toHm } });
  t = await beat(k.cookie);
  assert.equal(t.allowedNow, true);
  assert.ok(t.remainingSec <= 20 * 60 && t.remainingSec > 18 * 60, String(t.remainingSec));
  s.clock.t += 21 * 60_000;
  t = await beat(k.cookie);
  assert.equal(t.allowedNow, false);
  assert.equal(t.reason, 'hours');
});

test('adminul nu are limite', async () => {
  const t = (await s.raw('GET', '/api/me', { cookie: s.adminCookie })).json.time;
  assert.equal(t.allowedNow, true);
  assert.equal(t.minutesPerDay, null);
});

test('heartbeat validează jocul', async () => {
  const k = await s.createChild('val');
  for (const body of [{}, { game: '' }, { game: '../x' }, { game: 'bobo', extra: 1 }, { game: 5 }]) {
    assert.equal((await s.raw('POST', '/api/time/heartbeat', { cookie: k.cookie, body })).status, 400, JSON.stringify(body));
  }
});
