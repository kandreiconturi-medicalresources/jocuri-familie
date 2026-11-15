// Pornește serverul pe un port aleator, cu bază de date și dist/ temporare și ceas controlabil.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import WebSocket from 'ws';
import { createApp } from '../src/index.js';

export const ADMIN = { username: 'admin', password: 'admin-pass-123' };
// 10 martie 2026, 12:00 la București (UTC+2)
export const T0 = Date.parse('2026-03-10T10:00:00Z');

function makeDist(dir) {
  const dist = join(dir, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  mkdirSync(join(dist, 'games', 'bobo'), { recursive: true });
  mkdirSync(join(dist, 'icons'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>hub</title>HUB');
  writeFileSync(join(dist, 'games', 'bobo', 'index.html'), '<!doctype html><title>bobo</title>BOBO');
  writeFileSync(join(dist, 'assets', 'app-123.js'), 'console.log(1)');
  writeFileSync(join(dist, 'manifest.webmanifest'), '{"name":"Jocuri"}');
  writeFileSync(join(dist, 'icons', 'icon-192.png'), 'PNG');
  writeFileSync(join(dir, 'secret.txt'), 'SECRET-OUTSIDE-DIST');
  return dist;
}

export async function startServer(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'jf-test-'));
  const clock = { t: T0 };
  const app = await createApp({
    host: '127.0.0.1', port: 0, dataDir: join(dir, 'data'), distDir: makeDist(dir),
    adminUser: ADMIN.username, adminPassword: ADMIN.password,
    now: () => clock.t, log: () => {}, loginDelayMs: 0, ...overrides,
  });
  const port = await app.listen();
  const base = `http://127.0.0.1:${port}`;

  /** Cerere HTTP brută (calea trimisă exact cum e dată, fără normalizare). */
  function raw(method, path, { body, cookie, origin = base, ct = 'application/json', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const h = { ...headers };
      if (origin) h.Origin = origin;
      if (cookie) h.Cookie = cookie;
      let data;
      if (body !== undefined) {
        data = typeof body === 'string' ? body : JSON.stringify(body);
        if (ct) h['Content-Type'] = ct;
        h['Content-Length'] = Buffer.byteLength(data);
      } else if (method !== 'GET' && method !== 'HEAD' && ct) h['Content-Type'] = ct;
      const r = http.request({ host: '127.0.0.1', port, method, path, headers: h }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* nu e JSON */ }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      r.on('error', reject);
      if (data !== undefined) r.write(data);
      r.end();
    });
  }

  async function login(username, password) {
    const r = await raw('POST', '/api/auth/login', { body: { username, password } });
    if (r.status !== 200) return { ...r, cookie: null };
    const set = [].concat(r.headers['set-cookie'] || [])[0] || '';
    return { ...r, cookie: set.split(';')[0] };
  }

  const adminCookie = (await login(ADMIN.username, ADMIN.password)).cookie;

  async function createChild(username, extra = {}) {
    const body = { username, password: 'pass' + username, displayName: username.toUpperCase(), avatar: 'fox', color: '#ff6b6b', ...extra };
    const r = await raw('POST', '/api/admin/users', { body, cookie: adminCookie });
    if (r.status !== 201) throw new Error('createChild ' + r.status + ' ' + r.text);
    const l = await login(username, body.password);
    return { id: r.json.user.id, cookie: l.cookie, password: body.password };
  }

  function ws(cookie, { origin = base } = {}) {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    const sock = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    const inbox = [];
    const waiters = [];
    sock.on('message', (d) => {
      const m = JSON.parse(d.toString());
      const w = waiters.findIndex((x) => x.pred(m));
      if (w >= 0) waiters.splice(w, 1)[0].resolve(m); else inbox.push(m);
    });
    sock.next = (pred = () => true, ms = 2000) => {
      const i = inbox.findIndex(pred);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting for ws message')), ms);
        waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
      });
    };
    sock.inbox = inbox;
    sock.json = (o) => sock.send(JSON.stringify(o));
    sock.opened = new Promise((resolve, reject) => {
      sock.once('open', resolve);
      sock.once('unexpected-response', (req, res) => reject(Object.assign(new Error('rejected'), { status: res.statusCode })));
      sock.once('error', reject);
    });
    return sock;
  }

  return {
    app, base, port, clock, raw, login, adminCookie, createChild, ws,
    async close() { await app.close(); rmSync(dir, { recursive: true, force: true }); },
  };
}
