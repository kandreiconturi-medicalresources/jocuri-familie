import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { CSP } from '../src/security.js';

let s, kid;
before(async () => { s = await startServer(); kid = await s.createChild('ana'); });
after(async () => { await s.close(); });

test('public: health, login și fișierele ei', async () => {
  const h = await s.raw('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.deepEqual(h.json, { ok: true, app: 'jocuri-familie' });
  const l = await s.raw('GET', '/login');
  assert.equal(l.status, 200);
  assert.match(l.headers['content-type'], /text\/html/);
  assert.equal((await s.raw('GET', '/login.css')).status, 200);
  assert.equal((await s.raw('GET', '/login.js')).status, 200);
  assert.equal((await s.raw('GET', '/manifest.webmanifest')).status, 200);
  assert.equal((await s.raw('GET', '/icons/icon-192.png')).status, 200);
});

test('fără sesiune: HTML → 302 la /login, restul → 401 JSON', async () => {
  for (const p of ['/', '/games/bobo/', '/games/bobo/index.html', '/admin']) {
    const r = await s.raw('GET', p, { headers: { Accept: 'text/html' } });
    assert.equal(r.status, 302, p);
    assert.equal(r.headers.location, '/login');
  }
  assert.equal((await s.raw('GET', '/')).status, 302);
  for (const p of ['/assets/app-123.js', '/sw.js']) {
    const r = await s.raw('GET', p, { headers: { Accept: '*/*' } });
    assert.equal(r.status, 401, p);
    assert.equal(r.json.error, 'unauthorized');
  }
  for (const [m, p] of [['GET', '/api/me'], ['GET', '/api/admin/users'], ['GET', '/api/progress/bobo'],
    ['POST', '/api/time/heartbeat'], ['PUT', '/api/progress/bobo'], ['POST', '/api/auth/logout']]) {
    const r = await s.raw(m, p, m === 'GET' ? {} : { body: {} });
    assert.equal(r.status, 401, `${m} ${p}`);
  }
});

test('cu sesiune: fișierele statice și fallback SPA doar fără extensie', async () => {
  assert.equal((await s.raw('GET', '/', { cookie: kid.cookie })).text.includes('HUB'), true);
  assert.equal((await s.raw('GET', '/games/bobo/', { cookie: kid.cookie })).text.includes('BOBO'), true);
  const dir = await s.raw('GET', '/games/bobo', { cookie: kid.cookie });
  assert.equal(dir.status, 301);
  assert.equal(dir.headers.location, '/games/bobo/');
  assert.equal((await s.raw('GET', '/ceva/ruta', { cookie: kid.cookie })).text.includes('HUB'), true);
  assert.equal((await s.raw('GET', '/lipsa.js', { cookie: kid.cookie })).status, 404);
  const a = await s.raw('GET', '/assets/app-123.js', { cookie: kid.cookie });
  assert.equal(a.status, 200);
  assert.match(a.headers['content-type'], /javascript/);
  assert.match(a.headers['cache-control'], /immutable/);
  assert.equal((await s.raw('GET', '/login', { cookie: kid.cookie })).status, 302);
});

test('path traversal: nimic din afara dist/', async () => {
  const tries = ['/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt',
    '/assets/..%2f..%2fsecret.txt', '/assets/..%5c..%5csecret.txt', '/%00/secret.txt', '/.%2e/secret.txt',
    '/games/../../secret.txt', '/%c0%ae%c0%ae/secret.txt', '//secret.txt', '/.env'];
  for (const p of tries) {
    const r = await s.raw('GET', p, { cookie: kid.cookie });
    assert.ok(!r.text.includes('SECRET-OUTSIDE-DIST'), p);
    assert.notEqual(r.status, 500, p);
  }
});

test('doar adminul are acces la rutele de admin', async () => {
  assert.equal((await s.raw('GET', '/api/admin/users', { cookie: kid.cookie })).status, 403);
  const c = await s.raw('POST', '/api/admin/users', { cookie: kid.cookie, body: { username: 'x1', password: 'xxxx', displayName: 'X' } });
  assert.equal(c.status, 403);
  assert.equal((await s.raw('PATCH', `/api/admin/users/${kid.id}`, { cookie: kid.cookie, body: { limits: { minutesPerDay: null } } })).status, 403);
  assert.equal((await s.raw('DELETE', `/api/admin/users/${kid.id}`, { cookie: kid.cookie })).status, 403);
  assert.equal((await s.raw('POST', `/api/admin/users/${kid.id}/bonus`, { cookie: kid.cookie, body: { minutes: 30 } })).status, 403);
  const list = await s.raw('GET', '/api/admin/users', { cookie: s.adminCookie });
  assert.equal(list.status, 200);
  assert.ok(list.json.users.some((u) => u.username === 'ana' && typeof u.usedToday === 'number'));
  assert.ok(list.json.users.every((u) => u.pass === undefined));
});

test('admin: validare strictă, nume unic, nu se șterge ultimul admin', async () => {
  const bad = [
    { username: 'A B', password: 'xxxx', displayName: 'X' },
    { username: 'ok1', password: 'xyz', displayName: 'X' },
    { username: 'ok1', password: 'xxxx', displayName: '' },
    { username: 'ok1', password: 'xxxx', displayName: 'X', avatar: 'dragon' },
    { username: 'ok1', password: 'xxxx', displayName: 'X', color: 'red' },
    { username: 'ok1', password: 'xxxx', displayName: 'X', limits: { minutesPerDay: 601 } },
    { username: 'ok1', password: 'xxxx', displayName: 'X', limits: { from: '25:00' } },
    { username: 'ok1', password: 'xxxx', displayName: 'X', role: 'root' },
    { username: 'ok1', password: 'scurta', displayName: 'X', role: 'admin' },
    { username: 'ok1', password: 'xxxx', displayName: 'X', isAdmin: true },
  ];
  for (const body of bad) {
    const r = await s.raw('POST', '/api/admin/users', { cookie: s.adminCookie, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const dup = await s.raw('POST', '/api/admin/users', { cookie: s.adminCookie, body: { username: 'ANA', password: 'xxxx', displayName: 'X' } });
  assert.equal(dup.status, 409);
  const admins = (await s.raw('GET', '/api/admin/users', { cookie: s.adminCookie })).json.users.filter((u) => u.role === 'admin');
  assert.equal(admins.length, 1);
  assert.equal((await s.raw('DELETE', `/api/admin/users/${admins[0].id}`, { cookie: s.adminCookie })).status, 400);
  assert.equal((await s.raw('PATCH', `/api/admin/users/${admins[0].id}`, { cookie: s.adminCookie, body: { disabled: true } })).status, 400);
  assert.equal((await s.raw('PATCH', '/api/admin/users/99999', { cookie: s.adminCookie, body: { disabled: true } })).status, 404);
});

test('admin: ștergerea unui cont îi închide sesiunile', async () => {
  const k = await s.createChild('temporar');
  assert.equal((await s.raw('DELETE', `/api/admin/users/${k.id}`, { cookie: s.adminCookie })).status, 200);
  assert.equal((await s.raw('GET', '/api/me', { cookie: k.cookie })).status, 401);
});

test('CSRF: cererile care modifică cer Origin egal cu host-ul și JSON', async () => {
  const body = { game: 'bobo' };
  const ok = await s.raw('POST', '/api/time/heartbeat', { cookie: kid.cookie, body });
  assert.equal(ok.status, 200);
  for (const opts of [
    { origin: null },
    { origin: 'https://rau.example' },
    { origin: 'null' },
    { origin: `http://127.0.0.1:${s.port + 1}` },
    { ct: 'text/plain' },
    { ct: 'application/x-www-form-urlencoded' },
    { ct: null },
  ]) {
    const r = await s.raw('POST', '/api/time/heartbeat', { cookie: kid.cookie, body, ...opts });
    assert.equal(r.status, 403, JSON.stringify(opts));
  }
  const login = await s.raw('POST', '/api/auth/login', { origin: 'https://rau.example', body: { username: 'ana', password: kid.password } });
  assert.equal(login.status, 403);
});

test('corp prea mare → 413', async () => {
  const big = { game: 'x'.repeat(17 * 1024) };
  assert.equal((await s.raw('POST', '/api/time/heartbeat', { cookie: kid.cookie, body: big })).status, 413);
});

test('antete de securitate pe toate răspunsurile', async () => {
  for (const r of [await s.raw('GET', '/login'), await s.raw('GET', '/api/me'), await s.raw('GET', '/'),
    await s.raw('GET', '/assets/app-123.js', { cookie: kid.cookie })]) {
    assert.equal(r.headers['content-security-policy'], CSP);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.equal(r.headers['cross-origin-opener-policy'], 'same-origin');
    assert.ok(r.headers['permissions-policy']);
  }
});

test('metode nepermise', async () => {
  assert.equal((await s.raw('DELETE', '/', { cookie: kid.cookie })).status, 405);
  assert.equal((await s.raw('GET', '/api/time/heartbeat', { cookie: kid.cookie })).status, 405);
  assert.equal((await s.raw('GET', '/api/nimic', { cookie: kid.cookie })).status, 404);
});
