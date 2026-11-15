// Camere WebSocket (/ws): doar cu sesiune validă, Origin corect și timp de joc rămas. Relay de mesaje JSON.
import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';
import { originOk } from './security.js';
import { GAME_RE } from './routes/time.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // fără I, L, O
const MAX_PLAYERS = 4;
const MAX_MSG_BYTES = 4096;
const MAX_MSG_PER_SEC = 30;
const MAX_ROOMS = 500;
const MAX_CONN_PER_USER = 8;
const SWEEP_MS = 30_000;

function rejectUpgrade(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export function createRooms(ctx) {
  const { db, cfg, sessions, time } = ctx;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG_BYTES, perMessageDeflate: false, clientTracking: false });
  const conns = new Set();
  const rooms = new Map(); // code → { code, game, players: [conn] }
  let nextId = 1;

  const send = (c, obj) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(obj)); };
  const userOf = (c) => db.s.userById.get(c.userId);

  function roomState(room, c) {
    return {
      t: 'room', code: room.code, game: room.game, you: c.id,
      players: room.players.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, host: i === 0 })),
    };
  }
  const broadcastRoom = (room) => room.players.forEach((p) => send(p, roomState(room, p)));

  function leave(c) {
    const room = c.room;
    if (!room) return;
    c.room = null;
    room.players = room.players.filter((p) => p !== c); // gazda devine următorul jucător
    if (room.players.length) broadcastRoom(room); else rooms.delete(room.code);
  }

  function newCode() {
    for (let i = 0; i < 50; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  /** null dacă utilizatorul poate intra în camere, altfel codul de eroare. */
  function blockedReason(c) {
    const u = userOf(c);
    if (!u) return 'unauthorized';
    const t = time.status(u);
    return t.allowedNow ? null : (t.reason === 'disabled' ? 'disabled' : 'time');
  }

  function enter(c, room) {
    const u = userOf(c);
    c.name = u.display_name; c.avatar = u.avatar; c.color = u.color;
    room.players.push(c);
    c.room = room;
    broadcastRoom(room);
  }

  const handlers = {
    create(c, m) {
      if (typeof m.game !== 'string' || !GAME_RE.test(m.game)) return send(c, { t: 'error', code: 'bad' });
      const why = blockedReason(c);
      if (why) return send(c, { t: 'error', code: why });
      if (rooms.size >= MAX_ROOMS) return send(c, { t: 'error', code: 'busy' });
      const code = newCode();
      if (!code) return send(c, { t: 'error', code: 'busy' });
      leave(c);
      const room = { code, game: m.game, players: [] };
      rooms.set(code, room);
      enter(c, room);
    },
    join(c, m) {
      const code = typeof m.code === 'string' ? m.code.toUpperCase() : '';
      if (!/^[A-Z]{4}$/.test(code)) return send(c, { t: 'error', code: 'bad' });
      const why = blockedReason(c);
      if (why) return send(c, { t: 'error', code: why });
      const room = rooms.get(code);
      if (!room) return send(c, { t: 'error', code: 'not_found' });
      if (c.room === room) return send(c, roomState(room, c));
      if (room.players.length >= MAX_PLAYERS) return send(c, { t: 'error', code: 'full' });
      leave(c);
      enter(c, room);
    },
    leave(c) { leave(c); },
    msg(c, m) {
      if (!c.room) return send(c, { t: 'error', code: 'not_in_room' });
      for (const p of c.room.players) if (p !== c) send(p, { t: 'msg', from: c.id, d: m.d });
    },
    to(c, m) {
      if (!c.room) return send(c, { t: 'error', code: 'not_in_room' });
      const p = c.room.players.find((x) => x.id === m.id);
      if (!p) return send(c, { t: 'error', code: 'no_player' });
      send(p, { t: 'msg', from: c.id, d: m.d });
    },
  };

  function onMessage(c, data, isBinary) {
    const now = Date.now();
    if (now - c.winStart >= 1000) { c.winStart = now; c.winCount = 0; }
    c.winCount++;
    if (c.winCount > MAX_MSG_PER_SEC * 3) return c.ws.terminate();
    if (c.winCount > MAX_MSG_PER_SEC) { if (c.winCount === MAX_MSG_PER_SEC + 1) send(c, { t: 'error', code: 'rate' }); return; }
    if (isBinary) return send(c, { t: 'error', code: 'bad' });
    let m;
    try { m = JSON.parse(data.toString('utf8')); } catch { return send(c, { t: 'error', code: 'bad' }); }
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string' || !Object.hasOwn(handlers, m.t)) {
      return send(c, { t: 'error', code: 'bad' });
    }
    handlers[m.t](c, m);
  }

  /** Apelat de serverul HTTP la `upgrade`. */
  function handleUpgrade(req, socket, head) {
    socket.on('error', () => socket.destroy());
    const path = (req.url || '').split('?')[0];
    if (path !== '/ws') return rejectUpgrade(socket, 404, 'Not Found');
    if (!originOk(req, cfg)) return rejectUpgrade(socket, 403, 'Forbidden');
    const auth = sessions.fromRequest(req);
    if (!auth) return rejectUpgrade(socket, 401, 'Unauthorized');
    let mine = 0;
    for (const c of conns) if (c.userId === auth.user.id) mine++;
    if (mine >= MAX_CONN_PER_USER) return rejectUpgrade(socket, 429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c = { id: 'p' + nextId++, ws, userId: auth.user.id, hash: auth.hash, room: null, alive: true, winStart: 0, winCount: 0 };
      conns.add(c);
      ws.on('message', (data, isBinary) => onMessage(c, data, isBinary));
      ws.on('pong', () => { c.alive = true; });
      ws.on('close', () => { leave(c); conns.delete(c); });
      ws.on('error', () => ws.terminate());
    });
  }

  /** Scoate utilizatorul din camere (rămâne conectat) cu motivul dat: 'time' sau 'disabled'. */
  function kickUser(userId, reason) {
    for (const c of conns) {
      if (c.userId === userId && c.room) { leave(c); send(c, { t: 'closed', reason }); }
    }
  }
  function closeWhere(pred, code) {
    for (const c of conns) if (pred(c)) { leave(c); try { c.ws.close(code, 'session'); } catch { c.ws.terminate(); } }
  }

  // Verificare periodică: conexiuni moarte, sesiuni închise, timp expirat, interval orar încheiat.
  const sweep = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { leave(c); c.ws.terminate(); continue; }
      c.alive = false;
      try { c.ws.ping(); } catch { /* ignorat */ }
      if (!sessions.stillValid(c.hash) || !userOf(c)) { closeWhere((x) => x === c, 4001); continue; }
      if (c.room) {
        const why = blockedReason(c);
        if (why) { leave(c); send(c, { t: 'closed', reason: why }); }
      }
    }
  }, SWEEP_MS);
  sweep.unref();

  return {
    handleUpgrade,
    kickUser,
    dropSession: (hash) => closeWhere((c) => c.hash === hash, 4001),
    dropUser: (userId, exceptHash = '') => closeWhere((c) => c.userId === userId && c.hash !== exceptHash, 4001),
    stats: () => ({ rooms: rooms.size, conns: conns.size }),
    close() {
      clearInterval(sweep);
      for (const c of conns) c.ws.terminate();
      conns.clear();
      rooms.clear();
    },
  };
}
