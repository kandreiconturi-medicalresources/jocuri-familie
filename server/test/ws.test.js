import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let s;
const open = [];
before(async () => { s = await startServer(); });
after(async () => { for (const w of open) w.terminate(); await s.close(); });

async function connect(cookie, opts) {
  const w = s.ws(cookie, opts);
  open.push(w);
  await w.opened;
  return w;
}
const isRoom = (m) => m.t === 'room';

test('fără sesiune, cu sesiune falsă sau cu Origin greșit: upgrade refuzat', async () => {
  await assert.rejects(connect(null), (e) => e.status === 401);
  await assert.rejects(connect('jf_sid=' + 'B'.repeat(43)), (e) => e.status === 401);
  const k = await s.createChild('wsorigin');
  await assert.rejects(connect(k.cookie, { origin: 'https://rau.example' }), (e) => e.status === 403);
  await assert.rejects(connect(k.cookie, { origin: null }), (e) => e.status === 403);
});

test('camere: creare, intrare, relay, mesaj privat, gazdă nouă, cameră plină', async () => {
  const a = await s.createChild('wsa'), b = await s.createChild('wsb');
  const c = await s.createChild('wsc'), d = await s.createChild('wsd'), e = await s.createChild('wse');
  const wa = await connect(a.cookie), wb = await connect(b.cookie);

  wa.json({ t: 'create', game: 'bombe' });
  const r1 = await wa.next(isRoom);
  assert.match(r1.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  assert.equal(r1.players.length, 1);
  assert.equal(r1.players[0].host, true);
  assert.equal(r1.players[0].name, 'WSA');
  assert.equal(r1.players[0].avatar, 'fox');
  assert.equal(r1.you, r1.players[0].id);

  wb.json({ t: 'join', code: r1.code.toLowerCase() });
  const rb = await wb.next(isRoom);
  const ra = await wa.next(isRoom);
  assert.equal(rb.players.length, 2);
  assert.equal(ra.players.length, 2);
  assert.equal(rb.players[1].id, rb.you);
  assert.equal(rb.players[1].host, false);

  wa.json({ t: 'msg', d: { x: 1, y: [2, 3] } });
  const m = await wb.next((x) => x.t === 'msg');
  assert.deepEqual(m, { t: 'msg', from: r1.you, d: { x: 1, y: [2, 3] } });

  wb.json({ t: 'to', id: r1.you, d: 'salut' });
  const p = await wa.next((x) => x.t === 'msg');
  assert.deepEqual(p, { t: 'msg', from: rb.you, d: 'salut' });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(wa.inbox.filter((x) => x.t === 'msg').length, 0, 'expeditorul nu-și primește mesajul');
  assert.equal(wb.inbox.filter((x) => x.t === 'msg').length, 0);

  const wc = await connect(c.cookie), wd = await connect(d.cookie), we = await connect(e.cookie);
  wc.json({ t: 'join', code: r1.code }); await wc.next(isRoom);
  wd.json({ t: 'join', code: r1.code }); await wd.next(isRoom);
  we.json({ t: 'join', code: r1.code });
  assert.deepEqual(await we.next((x) => x.t === 'error'), { t: 'error', code: 'full' });
  we.json({ t: 'join', code: 'ZZZZ' });
  assert.equal((await we.next((x) => x.t === 'error')).code, 'not_found');

  wa.json({ t: 'leave' });
  const after = await wb.next((x) => isRoom(x) && !x.players.some((p) => p.id === r1.you));
  assert.equal(after.players[0].id, rb.you);
  assert.equal(after.players[0].host, true, 'gazda devine următorul');
});

test('mesaje invalide, prea mari sau prea dese', async () => {
  const k = await s.createChild('wsbad');
  const w = await connect(k.cookie);
  w.send('nu e json');
  assert.equal((await w.next((x) => x.t === 'error')).code, 'bad');
  w.json({ t: 'hack' });
  assert.equal((await w.next((x) => x.t === 'error')).code, 'bad');
  w.json({ t: '__proto__' });
  assert.equal((await w.next((x) => x.t === 'error')).code, 'bad');
  w.json({ t: 'msg', d: 1 });
  assert.equal((await w.next((x) => x.t === 'error')).code, 'not_in_room');
  for (let i = 0; i < 40; i++) w.json({ t: 'leave' });
  assert.equal((await w.next((x) => x.t === 'error')).code, 'rate');

  const big = await connect(k.cookie);
  const closed = new Promise((r) => big.once('close', (code) => r(code)));
  big.send(JSON.stringify({ t: 'msg', d: 'x'.repeat(5000) }));
  assert.equal(await closed, 1009);
});

test('fără timp rămas: camerele sunt refuzate', async () => {
  const k = await s.createChild('wszero', { limits: { minutesPerDay: 0, from: null, to: null } });
  const w = await connect(k.cookie);
  w.json({ t: 'create', game: 'bombe' });
  assert.deepEqual(await w.next((x) => x.t === 'error'), { t: 'error', code: 'time' });
  w.json({ t: 'join', code: 'ABCD' });
  assert.deepEqual(await w.next((x) => x.t === 'error'), { t: 'error', code: 'time' });
});

test('când se termină timpul, camera se închide cu motivul time', async () => {
  const k = await s.createChild('wsend', { limits: { minutesPerDay: 1, from: null, to: null } });
  const friend = await s.createChild('wsfriend');
  const w = await connect(k.cookie), wf = await connect(friend.cookie);
  w.json({ t: 'create', game: 'curse' });
  const room = await w.next(isRoom);
  wf.json({ t: 'join', code: room.code });
  await wf.next((x) => isRoom(x) && x.players.length === 2);
  const beat = () => s.raw('POST', '/api/time/heartbeat', { cookie: k.cookie, body: { game: 'curse' } });
  await beat(); s.clock.t += 30_000; await beat(); s.clock.t += 30_000;
  const t = (await beat()).json.time;
  assert.equal(t.allowedNow, false);
  assert.deepEqual(await w.next((x) => x.t === 'closed'), { t: 'closed', reason: 'time' });
  const left = await wf.next((x) => isRoom(x) && x.players.length === 1);
  assert.equal(left.players[0].host, true);
});

test('dezactivarea contului îl scoate din cameră; logout închide conexiunea', async () => {
  const k = await s.createChild('wsoff');
  const w = await connect(k.cookie);
  w.json({ t: 'create', game: 'orasel' });
  await w.next(isRoom);
  await s.raw('PATCH', `/api/admin/users/${k.id}`, { cookie: s.adminCookie, body: { disabled: true } });
  assert.deepEqual(await w.next((x) => x.t === 'closed'), { t: 'closed', reason: 'disabled' });

  const k2 = await s.createChild('wsout');
  const w2 = await connect(k2.cookie);
  const closed = new Promise((r) => w2.once('close', (code) => r(code)));
  await s.raw('POST', '/api/auth/logout', { cookie: k2.cookie });
  assert.equal(await closed, 4001);
});
