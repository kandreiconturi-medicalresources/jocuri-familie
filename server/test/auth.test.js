import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, ADMIN } from './helpers.js';

let s;
before(async () => { s = await startServer(); });
after(async () => { await s.close(); });

test('login reușit setează cookie-ul de sesiune cu atributele cerute', async () => {
  const r = await s.login(ADMIN.username, ADMIN.password);
  assert.equal(r.status, 200);
  assert.equal(r.json.user.username, 'admin');
  assert.equal(r.json.user.role, 'admin');
  assert.equal(r.json.user.pass, undefined);
  const set = [].concat(r.headers['set-cookie'])[0];
  assert.match(set, /^jf_sid=[A-Za-z0-9_-]{43};/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000']) assert.ok(set.includes(attr), attr);
  const me = await s.raw('GET', '/api/me', { cookie: r.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.username, 'admin');
  assert.equal(me.json.time.allowedNow, true);
});

test('numele de utilizator nu ține cont de majuscule', async () => {
  const r = await s.login('  ADMIN ', ADMIN.password);
  assert.equal(r.status, 200);
});

test('login eșuat: mesaj generic, fără cookie, identic pentru utilizator inexistent', async () => {
  const a = await s.login('admin', 'gresit-gresit');
  const b = await s.login('nimeni', 'gresit-gresit');
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(a.json, b.json);
  assert.equal(a.headers['set-cookie'], undefined);
});

test('login cu câmpuri greșite e refuzat', async () => {
  assert.equal((await s.raw('POST', '/api/auth/login', { body: { username: 'admin' } })).status, 400);
  assert.equal((await s.raw('POST', '/api/auth/login', { body: { username: 'admin', password: 1 } })).status, 400);
  assert.equal((await s.raw('POST', '/api/auth/login', { body: '[1]' })).status, 400);
  assert.equal((await s.raw('POST', '/api/auth/login', { body: '{nu e json' })).status, 400);
});

test('blocare după 5 eșecuri pe IP+utilizator, 15 minute; alt utilizator nu e afectat', async () => {
  const kid = await s.createChild('blocat');
  for (let i = 0; i < 5; i++) assert.equal((await s.login('blocat', 'gresit' + i)).status, 401);
  const blocked = await s.login('blocat', kid.password);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.cookie, null);
  assert.equal((await s.login(ADMIN.username, ADMIN.password)).status, 200);
  s.clock.t += 14 * 60 * 1000;
  assert.equal((await s.login('blocat', kid.password)).status, 429);
  s.clock.t += 2 * 60 * 1000;
  assert.equal((await s.login('blocat', kid.password)).status, 200);
});

test('logout invalidează sesiunea', async () => {
  const r = await s.login(ADMIN.username, ADMIN.password);
  assert.equal((await s.raw('POST', '/api/auth/logout', { cookie: r.cookie })).status, 200);
  assert.equal((await s.raw('GET', '/api/me', { cookie: r.cookie })).status, 401);
});

test('cont dezactivat: login refuzat', async () => {
  const kid = await s.createChild('oprit');
  const p = await s.raw('PATCH', `/api/admin/users/${kid.id}`, { body: { disabled: true }, cookie: s.adminCookie });
  assert.equal(p.status, 200);
  assert.equal((await s.login('oprit', kid.password)).status, 401);
  const me = await s.raw('GET', '/api/me', { cookie: kid.cookie });
  assert.equal(me.json.time.allowedNow, false);
  assert.equal(me.json.time.reason, 'disabled');
});

test('schimbarea parolei închide sesiunile copilului', async () => {
  const admin = (await s.login(ADMIN.username, ADMIN.password)).cookie;
  const kid = await s.createChild('parola');
  const p = await s.raw('PATCH', `/api/admin/users/${kid.id}`, { body: { password: 'noua-parola' }, cookie: admin });
  assert.equal(p.status, 200);
  assert.equal((await s.raw('GET', '/api/me', { cookie: kid.cookie })).status, 401);
  assert.equal((await s.raw('GET', '/api/me', { cookie: admin })).status, 200);
  assert.equal((await s.login('parola', 'noua-parola')).status, 200);
});

test('întârziere fixă la login (~300 ms)', async () => {
  const slow = await startServer({ loginDelayMs: 300 });
  try {
    const t = Date.now();
    await slow.login('nimeni', 'x');
    assert.ok(Date.now() - t >= 280);
  } finally { await slow.close(); }
});

// La final: avansează ceasul cu 31 de zile.
test('cookie falsificat sau expirat nu e acceptat', async () => {
  assert.equal((await s.raw('GET', '/api/me', { cookie: 'jf_sid=' + 'A'.repeat(43) })).status, 401);
  assert.equal((await s.raw('GET', '/api/me', { cookie: 'jf_sid=../../etc' })).status, 401);
  const r = await s.login(ADMIN.username, ADMIN.password);
  s.clock.t += 31 * 24 * 3600 * 1000;
  assert.equal((await s.raw('GET', '/api/me', { cookie: r.cookie })).status, 401);
});
