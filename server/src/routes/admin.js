// Rutele de admin: conturi, limite, bonus. Doar pentru role = 'admin' (verificat în dispecer).
import {
  hashPassword, checkUsername, checkPassword, checkDisplayName, checkAvatar, checkColor, checkLimits,
  onlyKeys, publicUser, limitsOf, BadRequest,
} from '../auth.js';
import { HttpError } from '../security.js';

const ROLE_ALIASES = { admin: 'admin', child: 'child', kid: 'child', user: 'child' };

export default function adminRoutes(ctx) {
  const { db, cfg, time, sessions, rooms } = ctx;

  const view = (u) => {
    const t = time.status(u);
    return { ...publicUser(u), disabled: !!u.disabled, limits: limitsOf(u), usedToday: t.usedToday, time: t };
  };
  const target = (params) => {
    const id = Number(params[0]);
    const u = Number.isSafeInteger(id) ? db.s.userById.get(id) : undefined;
    if (!u) throw new HttpError(404, 'not_found');
    return u;
  };
  const isLastActiveAdmin = (u) => u.role === 'admin' && !u.disabled && db.s.countAdmins.get().n <= 1;

  function list() {
    return [200, { users: db.s.users.all().map(view) }];
  }

  async function create({ body }) {
    onlyKeys(body, ['username', 'password', 'displayName', 'avatar', 'color', 'role', 'limits']);
    const role = body.role === undefined ? 'child' : ROLE_ALIASES[body.role];
    if (!role) throw new BadRequest('role');
    const username = checkUsername(body.username);
    const password = checkPassword(body.password, role);
    const displayName = checkDisplayName(body.displayName);
    const avatar = body.avatar === undefined ? 'bear' : checkAvatar(body.avatar);
    const color = body.color === undefined ? '#4cc9f0' : checkColor(body.color);
    const lim = body.limits === undefined ? { minutes_per_day: null, from_hm: null, to_hm: null } : checkLimits(body.limits);
    if (db.s.userByName.get(username)) throw new HttpError(409, 'username_taken');
    const pass = await hashPassword(password);
    let id;
    try {
      id = db.s.insertUser.run(username, pass, displayName, avatar, color, role, lim.minutes_per_day, lim.from_hm, lim.to_hm, cfg.now()).lastInsertRowid;
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'username_taken');
      throw e;
    }
    const u = db.s.userById.get(Number(id));
    cfg.log(`cont creat: ${u.username} (${u.role})`);
    return [201, { user: view(u) }];
  }

  async function patch({ params, body, auth }) {
    onlyKeys(body, ['displayName', 'password', 'avatar', 'color', 'limits', 'disabled']);
    const u = target(params);
    const f = {};
    if (body.displayName !== undefined) f.display_name = checkDisplayName(body.displayName);
    if (body.avatar !== undefined) f.avatar = checkAvatar(body.avatar);
    if (body.color !== undefined) f.color = checkColor(body.color);
    if (body.limits !== undefined) Object.assign(f, checkLimits(body.limits));
    if (body.disabled !== undefined) {
      if (typeof body.disabled !== 'boolean') throw new BadRequest('disabled');
      if (body.disabled && isLastActiveAdmin(u)) throw new HttpError(400, 'last_admin');
      f.disabled = body.disabled ? 1 : 0;
    }
    if (body.password !== undefined) f.pass = await hashPassword(checkPassword(body.password, u.role));
    db.updateUser(u.id, f);
    // Parolă nouă → toate celelalte sesiuni ale contului se închid (cea curentă rămâne dacă e a lui).
    if (f.pass) { sessions.destroyUser(u.id, auth.hash); rooms.dropUser(u.id, auth.hash); }
    if (f.disabled) rooms.kickUser(u.id, 'disabled');
    const fresh = db.s.userById.get(u.id);
    if (!time.status(fresh).allowedNow) rooms.kickUser(u.id, 'time');
    return [200, { user: view(fresh) }];
  }

  function remove({ params }) {
    const u = target(params);
    if (u.role === 'admin' && db.raw.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n <= 1) {
      throw new HttpError(400, 'last_admin');
    }
    if (isLastActiveAdmin(u)) throw new HttpError(400, 'last_admin');
    db.s.deleteUser.run(u.id); // sesiunile, timpul și progresul se șterg în cascadă
    rooms.dropUser(u.id);
    cfg.log(`cont șters: ${u.username}`);
    return [200, { ok: true }];
  }

  function bonus({ params, body }) {
    onlyKeys(body, ['minutes']);
    const m = body.minutes;
    if (!Number.isInteger(m) || m < -600 || m > 600 || m === 0) throw new BadRequest('minutes');
    const u = target(params);
    return [200, { time: time.addBonus(u, m), user: view(db.s.userById.get(u.id)) }];
  }

  const one = /^\/api\/admin\/users\/(\d{1,15})$/;
  return [
    { method: 'GET', path: /^\/api\/admin\/users$/, auth: 'admin', handler: list },
    { method: 'POST', path: /^\/api\/admin\/users$/, auth: 'admin', handler: create },
    { method: 'PATCH', path: one, auth: 'admin', handler: patch },
    { method: 'DELETE', path: one, auth: 'admin', handler: remove },
    { method: 'POST', path: /^\/api\/admin\/users\/(\d{1,15})\/bonus$/, auth: 'admin', handler: bonus },
  ];
}
