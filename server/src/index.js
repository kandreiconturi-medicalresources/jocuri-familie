// Serverul NAS: HTTP (API + fișiere statice, totul în spatele login-ului) și upgrade WebSocket pentru camere.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { bootstrapAdmin, BadRequest } from './auth.js';
import { createSessions } from './sessions.js';
import { createLoginLimiter } from './ratelimit.js';
import { createTime } from './time.js';
import { createRooms } from './rooms.js';
import { createStatic } from './static.js';
import {
  setSecurityHeaders, originOk, isJsonContentType, readJson, sendJson, redirect, clientIp, HttpError,
} from './security.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import adminRoutes from './routes/admin.js';
import timeRoutes from './routes/time.js';
import progressRoutes from './routes/progress.js';
import savesRoutes from './routes/saves.js';

// Fișiere publice: pagina de login și ce trebuie ca aplicația să poată fi „adăugată pe ecranul principal”
// (manifestul și iconițele sunt cerute de browser fără cookie-uri).
const LOGIN_FILES = new Set(['/login.css', '/login.js']);
const PUBLIC_DIST = /^\/(manifest\.webmanifest|icons\/[a-z0-9-]+\.png)$/;

/** Construiește aplicația (fără să asculte). Folosit și de teste. */
export async function createApp(overrides = {}) {
  const cfg = loadConfig(overrides);
  const db = openDb(cfg.dataDir);
  await bootstrapAdmin(db, cfg);
  const sessions = createSessions(db, cfg);
  const limiter = createLoginLimiter(cfg);
  const time = createTime(db, cfg);
  const ctx = { cfg, db, sessions, limiter, time };
  ctx.rooms = createRooms(ctx);
  const routes = [authRoutes, meRoutes, adminRoutes, timeRoutes, progressRoutes, savesRoutes].flatMap((r) => r(ctx));
  const dist = createStatic(cfg.distDir);
  const pub = createStatic(cfg.publicDir);

  async function api(req, res, pathname) {
    const matching = routes.filter((r) => r.path.test(pathname));
    if (!matching.length) return sendJson(res, 404, { error: 'not_found' });
    const route = matching.find((r) => r.method === req.method || (req.method === 'HEAD' && r.method === 'GET'));
    if (!route) return sendJson(res, 405, { error: 'method' }, { Allow: matching.map((r) => r.method).join(', ') });

    const mutating = req.method !== 'GET' && req.method !== 'HEAD';
    if (mutating && (!originOk(req, cfg) || !isJsonContentType(req))) return sendJson(res, 403, { error: 'csrf' });

    let auth = null;
    if (route.auth !== 'public') {
      auth = sessions.fromRequest(req);
      if (!auth) return sendJson(res, 401, { error: 'unauthorized' });
      if (auth.setCookie) res.setHeader('Set-Cookie', auth.setCookie);
      if (route.auth === 'admin' && (auth.user.role !== 'admin' || auth.user.disabled)) {
        return sendJson(res, 403, { error: 'forbidden' });
      }
    }
    const body = mutating ? await readJson(req, route.maxBody || cfg.maxBodyBytes) : {};
    const params = pathname.match(route.path).slice(1);
    const [status, obj, headers] = await route.handler({ req, res, params, body, auth, ip: clientIp(req, cfg) });
    sendJson(res, status, obj, headers);
  }

  async function handle(req, res) {
    setSecurityHeaders(res);
    let url;
    try { url = new URL(req.url, 'http://local'); } catch { return sendJson(res, 400, { error: 'bad_url' }); }
    const { pathname } = url;

    if (pathname === '/api/health') return sendJson(res, 200, { ok: true, app: 'jocuri-familie' });
    if (pathname.startsWith('/api/')) return api(req, res, pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method' }, { Allow: 'GET, HEAD' });

    if (pathname === '/login' || pathname === '/login.html') {
      if (sessions.fromRequest(req)) return redirect(res, '/');
      if (await pub.serve(req, res, '/login.html', { spa: false })) return;
      return sendJson(res, 404, { error: 'not_found' });
    }
    if (LOGIN_FILES.has(pathname)) {
      if (await pub.serve(req, res, pathname, { spa: false })) return;
      return sendJson(res, 404, { error: 'not_found' });
    }
    if (PUBLIC_DIST.test(pathname)) {
      if (await dist.serve(req, res, pathname, { spa: false })) return;
      return sendJson(res, 404, { error: 'not_found' });
    }

    const auth = sessions.fromRequest(req);
    if (!auth) {
      const accept = String(req.headers.accept || '');
      const last = pathname.split('/').pop();
      const wantsHtml = accept.includes('text/html') || !last.includes('.') || last.endsWith('.html');
      return wantsHtml ? redirect(res, '/login') : sendJson(res, 401, { error: 'unauthorized' });
    }
    if (auth.setCookie) res.setHeader('Set-Cookie', auth.setCookie);
    if (await dist.serve(req, res, pathname)) return;
    sendJson(res, 404, { error: 'not_found' });
  }

  const server = createServer({ maxHeaderSize: 16 * 1024 }, (req, res) => {
    handle(req, res).catch((err) => {
      if (err instanceof HttpError) return safeSend(res, err.status, { error: err.code });
      if (err instanceof BadRequest) return safeSend(res, 400, { error: err.code });
      cfg.log('eroare:', err && err.stack ? err.stack : err);
      safeSend(res, 500, { error: 'server' });
    });
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.on('upgrade', (req, socket, head) => {
    try { ctx.rooms.handleUpgrade(req, socket, head); } catch (e) { cfg.log('eroare ws:', e); socket.destroy(); }
  });
  server.on('clientError', (err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });

  const housekeeping = setInterval(() => { sessions.purge(); limiter.prune(); }, 3600_000);
  housekeeping.unref();

  return {
    cfg, db, server, ctx,
    listen: () => new Promise((res) => server.listen(cfg.port, cfg.host, () => res(server.address().port))),
    async close() {
      clearInterval(housekeeping);
      ctx.rooms.close();
      await new Promise((res) => { server.close(() => res()); server.closeAllConnections(); });
      db.close();
    },
  };
}

function safeSend(res, status, obj) {
  if (res.headersSent) { res.destroy(); return; }
  sendJson(res, status, obj);
}

// Pornire directă: `node server/src/index.js`
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const app = await createApp();
    const port = await app.listen();
    app.cfg.log(`Jocuri Familie ascultă pe ${app.cfg.host}:${port} (date: ${app.cfg.dataDir})`);
    const stop = async () => { await app.close(); process.exit(0); };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  } catch (e) {
    console.error('Nu am putut porni serverul:', e && e.message ? e.message : e);
    process.exit(1);
  }
}
