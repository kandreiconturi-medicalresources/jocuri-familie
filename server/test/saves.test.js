import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './helpers.js';

let s, a, b;
before(async () => { s = await startServer(); a = await s.createChild('ana'); b = await s.createChild('bob'); });
after(async () => { await s.close(); });

const b64 = (str) => Buffer.from(str).toString('base64');
const put = (c, game, slot, body) => s.raw('PUT', `/api/saves/${game}/${slot}`, { cookie: c, body });
const get = (c, game, slot) => s.raw('GET', `/api/saves/${game}/${slot}`, { cookie: c });
const list = (c, game) => s.raw('GET', `/api/saves/${game}`, { cookie: c });
const del = (c, game, slot) => s.raw('DELETE', `/api/saves/${game}/${slot}`, { cookie: c });

test('ciclul complet: listă goală, salvare, citire, suprascriere, ștergere', async () => {
  assert.deepEqual((await list(a.cookie, 'trenuri')).json, []);
  assert.equal((await get(a.cookie, 'trenuri', 1)).status, 404);
  const data = b64('{"oras":"Brasov","bani":1000}');
  const r = await put(a.cookie, 'trenuri', 1, { name: '  Prima hartă  ', data });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { slot: 1, name: 'Prima hartă', size: data.length, updatedAt: s.clock.t });
  assert.deepEqual((await get(a.cookie, 'trenuri', 1)).json, { slot: 1, name: 'Prima hartă', data, updatedAt: s.clock.t });
  s.clock.t += 1000;
  const d2 = b64('alt');
  assert.equal((await put(a.cookie, 'trenuri', 1, { name: 'Nou', data: d2 })).status, 200);
  assert.equal((await put(a.cookie, 'trenuri', 3, { name: 'Trei', data: d2 })).status, 200);
  assert.deepEqual((await list(a.cookie, 'trenuri')).json, [
    { slot: 1, name: 'Nou', size: d2.length, updatedAt: s.clock.t },
    { slot: 3, name: 'Trei', size: d2.length, updatedAt: s.clock.t },
  ]);
  assert.equal((await get(a.cookie, 'trenuri', 1)).json.data, d2);
  assert.equal((await del(a.cookie, 'trenuri', 1)).status, 200);
  assert.equal((await get(a.cookie, 'trenuri', 1)).status, 404);
  assert.equal((await del(a.cookie, 'trenuri', 1)).status, 404);
  assert.equal((await list(a.cookie, 'trenuri')).json.length, 1);
  assert.deepEqual((await list(a.cookie, 'curse')).json, [], 'jocurile sunt separate');
});

test('izolare: salvarea altcuiva arată exact ca una inexistentă (404)', async () => {
  const data = b64('secret-ana');
  assert.equal((await put(a.cookie, 'orasel', 2, { name: 'Ana', data })).status, 200);
  const foreign = await get(b.cookie, 'orasel', 2);
  const missing = await get(b.cookie, 'orasel', 3);
  assert.equal(foreign.status, 404);
  assert.deepEqual(foreign.json, missing.json);
  assert.ok(!foreign.text.includes('secret'));
  assert.deepEqual((await list(b.cookie, 'orasel')).json, []);
  assert.equal((await del(b.cookie, 'orasel', 2)).status, 404);
  // Bob scrie în același slot: are propria salvare, a Anei rămâne neatinsă.
  assert.equal((await put(b.cookie, 'orasel', 2, { name: 'Bob', data: b64('bob') })).status, 200);
  assert.equal((await get(a.cookie, 'orasel', 2)).json.data, data);
  assert.equal((await get(b.cookie, 'orasel', 2)).json.data, b64('bob'));
  // Fără sesiune: 401
  assert.equal((await s.raw('GET', '/api/saves/orasel/2')).status, 401);
  assert.equal((await s.raw('PUT', '/api/saves/orasel/2', { body: { name: 'x', data: b64('x') } })).status, 401);
});

test('validare: joc, slot, nume, data, câmpuri', async () => {
  const ok = { name: 'ok', data: b64('x') };
  for (const p of ['/api/saves/A/1', '/api/saves/x/1', '/api/saves/abcdefghijklmnopq/1', '/api/saves/tr3nuri/1',
    '/api/saves/trenuri/0', '/api/saves/trenuri/4', '/api/saves/trenuri/1.0', '/api/saves/trenuri/01',
    '/api/saves/trenuri/-1', '/api/saves/..%2ftrenuri/1', '/api/saves/trenuri/1/']) {
    assert.equal((await s.raw('PUT', p, { cookie: a.cookie, body: ok })).status, 404, p);
    assert.equal((await s.raw('GET', p, { cookie: a.cookie })).status, 404, p);
  }
  assert.equal((await s.raw('PUT', '/api/saves/trenuri', { cookie: a.cookie, body: ok })).status, 405);
  const bad = [
    {}, { name: 'x' }, { data: b64('x') }, { ...ok, extra: 1 },
    { name: '', data: ok.data }, { name: '   ', data: ok.data }, { name: 'x'.repeat(41), data: ok.data },
    { name: 'a\nb', data: ok.data }, { name: 'a\u0000b', data: ok.data }, { name: 'a\u0085b', data: ok.data },
    { name: 'a\u2028b', data: ok.data }, { name: 5, data: ok.data }, { name: ['x'], data: ok.data },
    { name: 'x', data: '' }, { name: 'x', data: 'abc' }, { name: 'x', data: 'ab!=' }, { name: 'x', data: 'QR==' },
    { name: 'x', data: 'Q===' }, { name: 'x', data: 'QQ==QQ==' }, { name: 'x', data: 'QQ\n==' },
    { name: 'x', data: 'a-_b' }, { name: 'x', data: 123 }, { name: 'x', data: { a: 1 } },
  ];
  for (const body of bad) assert.equal((await put(a.cookie, 'bombe', 1, body)).status, 400, JSON.stringify(body));
  assert.equal((await put(a.cookie, 'bombe', 1, { name: 'x'.repeat(40), data: 'QQ==' })).status, 200);
  assert.equal((await put(a.cookie, 'bombe', 1, { name: 'Salvare 🚂', data: 'QUI=' })).status, 200);
  assert.equal((await put(a.cookie, 'bombe', 1, { name: 'x', data: 'A'.repeat(1024 * 1024) })).status, 200, 'exact 1 MB e permis');
  assert.equal((await put(a.cookie, 'bombe', 1, { name: 'x', data: 'A'.repeat(1024 * 1024 + 4) })).status, 413);
  assert.equal((await get(a.cookie, 'bombe', 1)).json.data.length, 1024 * 1024);
  await del(a.cookie, 'bombe', 1);
});

/** PUT cu corp trimis în bucăți (fără Content-Length): serverul trebuie să taie fluxul. */
function streamPut(path, cookie, total) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      host: '127.0.0.1', port: s.port, method: 'PUT', path,
      headers: { Origin: s.base, Cookie: cookie, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString(), sent }));
    });
    r.on('error', (e) => (e.code === 'ECONNRESET' || e.code === 'EPIPE' ? null : reject(e)));
    let sent = 0;
    const chunk = Buffer.alloc(64 * 1024, 'A');
    r.write('{"name":"x","data":"');
    const pump = () => {
      while (sent < total) {
        sent += chunk.length;
        if (!r.write(chunk)) return r.once('drain', pump);
      }
      r.end('"}');
    };
    pump();
  });
}

test('413: corp peste 1,5 MB pe PUT saves (declarat și în flux); restul rutelor păstrează limitele', async () => {
  const big = JSON.stringify({ name: 'x', data: 'A'.repeat(1600 * 1024) });
  assert.equal((await s.raw('PUT', '/api/saves/curse/1', { cookie: a.cookie, body: big })).status, 413);
  const r = await streamPut('/api/saves/curse/1', a.cookie, 8 * 1024 * 1024);
  assert.equal(r.status, 413);
  assert.equal((await get(a.cookie, 'curse', 1)).status, 404);
  // Celelalte rute nu primesc limita mare.
  const mid = { data: { s: 'x'.repeat(100 * 1024) } };
  assert.equal((await s.raw('PUT', '/api/progress/curse', { cookie: a.cookie, body: mid })).status, 413);
  assert.equal((await s.raw('POST', '/api/time/heartbeat', { cookie: a.cookie, body: { game: 'x'.repeat(20 * 1024) } })).status, 413);
  assert.equal((await s.raw('DELETE', '/api/saves/curse/1', { cookie: a.cookie, body: { pad: 'x'.repeat(20 * 1024) } })).status, 413);
  // Serverul încă răspunde normal.
  assert.equal((await put(a.cookie, 'curse', 1, { name: 'ok', data: b64('ok') })).status, 200);
});

test('CSRF: PUT/DELETE cer Origin corect și Content-Type JSON', async () => {
  const body = { name: 'x', data: b64('x') };
  const opts = { cookie: a.cookie, body };
  assert.equal((await s.raw('PUT', '/api/saves/bobo/1', { ...opts, origin: null })).status, 403);
  assert.equal((await s.raw('PUT', '/api/saves/bobo/1', { ...opts, origin: 'http://evil.example' })).status, 403);
  assert.equal((await s.raw('PUT', '/api/saves/bobo/1', { ...opts, ct: 'text/plain' })).status, 403);
  assert.equal((await s.raw('PUT', '/api/saves/bobo/1', { ...opts, ct: 'application/x-www-form-urlencoded' })).status, 403);
  assert.equal((await get(a.cookie, 'bobo', 1)).status, 404);
  assert.equal((await put(a.cookie, 'bobo', 1, body)).status, 200);
  assert.equal((await s.raw('DELETE', '/api/saves/bobo/1', { cookie: a.cookie, origin: null })).status, 403);
  assert.equal((await s.raw('DELETE', '/api/saves/bobo/1', { cookie: a.cookie, ct: 'text/plain' })).status, 403);
  assert.equal((await get(a.cookie, 'bobo', 1)).status, 200);
});

test('ștergerea utilizatorului îi șterge și salvările', async () => {
  const c = await s.createChild('cara');
  await put(c.cookie, 'trenuri', 1, { name: 'x', data: b64('x') });
  await put(c.cookie, 'bobo', 2, { name: 'y', data: b64('y') });
  const count = () => s.app.db.raw.prepare('SELECT COUNT(*) AS n FROM saves WHERE user_id = ?').get(c.id).n;
  assert.equal(count(), 2);
  const r = await s.raw('DELETE', `/api/admin/users/${c.id}`, { cookie: s.adminCookie });
  assert.equal(r.status, 200);
  assert.equal(count(), 0);
  assert.equal((await get(c.cookie, 'trenuri', 1)).status, 401);
});

test('limite: sloturi per utilizator și limita globală → 507', async () => {
  const t = await startServer({ maxSavesPerUser: 3, maxSavesTotalBytes: 40 });
  try {
    const u = await t.createChild('dan');
    const v = await t.createChild('eva');
    const p = (c, g, slot, data) => t.raw('PUT', `/api/saves/${g}/${slot}`, { cookie: c, body: { name: 'n', data } });
    const d8 = 'AAAAAAAA'; // 8 octeți
    assert.equal((await p(u.cookie, 'aa', 1, d8)).status, 200);
    assert.equal((await p(u.cookie, 'aa', 2, d8)).status, 200);
    assert.equal((await p(u.cookie, 'bb', 1, d8)).status, 200);
    const full = await p(u.cookie, 'bb', 2, 'AAAA');
    assert.equal(full.status, 507);
    assert.equal(full.json.error, 'too_many_saves');
    assert.equal((await p(u.cookie, 'aa', 1, 'AAAA')).status, 200, 'suprascrierea unui slot existent nu e un slot nou');
    // total: 4 + 8 + 8 = 20; Eva mai are loc de 20
    assert.equal((await p(v.cookie, 'aa', 1, 'A'.repeat(20))).status, 200);
    const g = await p(v.cookie, 'aa', 2, 'AAAA');
    assert.equal(g.status, 507);
    assert.equal(g.json.error, 'storage_full');
    assert.equal((await t.raw('GET', '/api/saves/aa/2', { cookie: v.cookie })).status, 404, 'nimic scris la 507');
    // Suprascrierea care micșorează e permisă; cea care crește peste limită nu.
    assert.equal((await p(v.cookie, 'aa', 1, 'A'.repeat(24))).status, 507);
    assert.equal((await p(v.cookie, 'aa', 1, 'A'.repeat(16))).status, 200);
    assert.equal((await p(v.cookie, 'aa', 2, 'AAAA')).status, 200);
    // După ștergere se eliberează loc.
    assert.equal((await t.raw('DELETE', '/api/saves/bb/1', { cookie: u.cookie })).status, 200);
    assert.equal((await p(u.cookie, 'bb', 2, 'AAAA')).status, 200);
  } finally {
    await t.close();
  }
});
