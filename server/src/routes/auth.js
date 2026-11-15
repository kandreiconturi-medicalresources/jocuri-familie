// POST /api/auth/login, POST /api/auth/logout
import { verifyPassword, normUsername, publicUser, BadRequest } from '../auth.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function authRoutes(ctx) {
  const { db, cfg, sessions, limiter, rooms } = ctx;

  async function login({ body, ip }) {
    const started = Date.now();
    // Întârziere fixă: orice răspuns de login durează cel puțin loginDelayMs.
    const finish = async (out) => { await sleep(Math.max(0, cfg.loginDelayMs - (Date.now() - started))); return out; };

    const keys = Object.keys(body);
    if (keys.some((k) => k !== 'username' && k !== 'password')) throw new BadRequest('fields');
    const { username, password } = body;
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 128) {
      return finish([400, { error: 'invalid' }]);
    }
    const name = normUsername(username);
    if (limiter.isBlocked(ip, name)) return finish([429, { error: 'blocked' }]);

    const user = name ? db.s.userByName.get(name) : undefined;
    const ok = await verifyPassword(password, user ? user.pass : null);
    if (!ok || !user || user.disabled) {
      limiter.fail(ip, name);
      cfg.log(`login eșuat pentru "${name.slice(0, 32)}" de la ${ip}`);
      return finish([401, { error: 'invalid' }]);
    }
    limiter.success(ip, name);
    const setCookie = sessions.create(user.id);
    return finish([200, { user: publicUser(user) }, { 'Set-Cookie': setCookie }]);
  }

  function logout({ auth }) {
    sessions.destroy(auth.hash);
    rooms.dropSession(auth.hash);
    return [200, { ok: true }, { 'Set-Cookie': sessions.clearCookie() }];
  }

  return [
    { method: 'POST', path: /^\/api\/auth\/login$/, auth: 'public', handler: login },
    { method: 'POST', path: /^\/api\/auth\/logout$/, auth: 'user', handler: logout },
  ];
}
