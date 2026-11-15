// „În rețea”: creează cameră / intră cu cod, camera cu jucători, alegerile gazdei și pornirea meciului.
import { h } from '../../../../shared/ui/dom.js';
import { connectRooms } from '../../../../shared/net/rooms.js';
import { createKeypad } from '../../../../shared/ui/keypad.js';
import { ARENAS } from '../logic/arenas.js';
import { makeScreen, btn, optRow, playerCard } from '../screens/ui.js';
import { addBots } from '../setup.js';

const ERRORS = {
  not_found: 'Nu există nicio cameră cu codul ăsta.', full: 'Camera e plină (maxim 4 jucători).', bad: 'Codul nu e bun.',
  busy: 'Serverul e ocupat acum. Încearcă iar.', not_in_room: '',
};
const BLOCKED = { time: 'limit', disabled: 'disabled' };

export function createLobby(app) {
  let rooms = null, room = null, view = 'menu', inGame = false;
  const opt = { bots: 0, level: 'easy', arena: 0, rounds: 3, gentle: true };
  const err = h('p', { class: 'err' });
  const body = h('div');
  const s = makeScreen([h('h2', null, '🌐 Joacă în rețea'), err, body]);
  const keypad = createKeypad({ onChange: () => { err.textContent = ''; }, onSubmit: (c) => rooms.join(c) });
  addEventListener('keydown', (e) => { if (view === 'join' && !s.el.classList.contains('hidden')) keypad.onKey(e); });
  const say = (t) => { err.textContent = t || ''; };
  const list = () => (room ? room.players : []);

  function ensure() {
    if (rooms) return;
    rooms = connectRooms();
    rooms.on('room', (m) => {
      room = m;
      if (inGame) app.net.setRoom(m.players);
      else if (view === 'room' || view === 'menu' || view === 'join') { view = 'room'; say(''); render(); }
    });
    rooms.on('msg', onMsg);
    rooms.on('closed', (m) => {
      room = null;
      if (BLOCKED[m.reason]) { app.block(BLOCKED[m.reason]); return; }
      if (inGame) { inGame = false; app.endNet(); }
      view = 'menu'; app.go('lobby'); render();
    });
    rooms.on('error', (m) => {
      if (m.code === 'rate' || m.code === 'not_in_room') return;
      if (BLOCKED[m.code]) { app.block(BLOCKED[m.code]); return; }
      if (inGame || view === 'room') return;
      keypad.reset(); say(ERRORS[m.code] || 'Ceva n-a mers. Încearcă iar.'); render();
    });
  }

  function onMsg(m) {
    const d = m.d;
    if (!d) return;
    const host = list().find((p) => p.host);
    if (d.k === 'start' && !inGame && host && host.id === m.from && m.from !== room.you) begin(d.cfg);
    else if (d.k === 'back' && inGame && host && host.id === m.from) { inGame = false; app.endNet(); view = 'room'; render(); app.go('lobby'); }
    else if (inGame) app.net.onMsg(m);
  }

  function begin(cfg) {
    if (!cfg || !Array.isArray(cfg.players) || !cfg.players.some((p) => p.id === room.you)) return;
    inGame = true;
    const hp = list().find((p) => p.host);
    app.startNet(cfg, { rooms, you: room.you, host: !!hp && hp.id === room.you });
  }

  function startAsHost() {
    const humans = list().slice(0, 4).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color }));
    if (humans.length + opt.bots < 2) return;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const cfg = { arenaId: opt.arena, players: addBots(humans, Math.min(opt.bots, 4 - humans.length), opt.level, seed), seed, rules: { rounds: opt.rounds, gentle: opt.gentle } };
    rooms.send({ k: 'start', cfg });
    begin(cfg);
  }

  function menuView() {
    return h('div', null, h('p', { class: 'sub' }, 'Joacă împreună cu familia, pe alte dispozitive. 2 până la 4 jucători.'),
      h('div', { class: 'btns' }, btn('➕ Creează cameră', () => { say(''); rooms.create('bombe'); }), btn('🔑 Intră cu cod', () => { view = 'join'; keypad.reset(); render(); }, 'alt')),
      h('div', { class: 'btns', style: { marginBottom: 0 } }, btn('← Înapoi', () => leaveAll(), 'alt sm')));
  }

  function joinView() {
    return h('div', null, h('p', { class: 'sub' }, 'Scrie codul de 4 litere de pe celălalt dispozitiv.'), keypad.el,
      h('div', { class: 'btns', style: { margin: '8px 0 0' } }, btn('← Înapoi', () => { view = 'menu'; say(''); render(); }, 'alt sm')));
  }

  function roomView() {
    const pl = list(), me = pl.find((p) => p.id === room.you), host = !!(me && me.host);
    opt.bots = Math.min(opt.bots, 4 - pl.length);
    const a = ARENAS[opt.arena], step = (d) => { opt.arena = (opt.arena + d + ARENAS.length) % ARENAS.length; render(); };
    const set = (k) => (v) => { opt[k] = v; render(); };
    const options = host ? h('div', null,
      optRow('Boți', [0, 1, 2, 3].filter((n) => n <= 4 - pl.length).map((n) => [n, String(n)]), opt.bots, set('bots')),
      optRow('Boți sunt', [['easy', 'Ușori'], ['mid', 'Medii'], ['hard', 'Grei']], opt.level, set('level')),
      h('div', { class: 'row' }, btn('◀', () => step(-1), 'alt sm'), h('span', { class: 'val' }, a.name), btn('▶', () => step(1), 'alt sm')),
      optRow('Runde', [[1, '1'], [3, '3'], [5, '5']], opt.rounds, set('rounds')),
      optRow('Mod blând', [[true, 'Pornit'], [false, 'Oprit']], opt.gentle, set('gentle')))
      : h('p', { class: 'sub' }, 'Așteptăm gazda să pornească jocul…');
    const can = pl.length + opt.bots >= 2;
    return h('div', null, h('p', { class: 'sub', style: { margin: 0 } }, 'Codul camerei'),
      h('div', { class: 'code' }, [...room.code].map((ch) => h('span', { class: 'ch' }, ch))),
      h('div', { class: 'plist' }, pl.map((p) => playerCard(p, p.id === room.you ? 'me' : '', h('small', null, p.host ? '👑 gazdă' : '')))),
      options,
      h('div', { class: 'btns', style: { marginBottom: 0 } },
        host ? btn(can ? '▶ Pornește jocul' : 'Așteaptă prieteni…', () => startAsHost(), can ? '' : 'off') : null,
        btn('🚪 Ieși din cameră', () => { rooms.leave(); room = null; view = 'menu'; say(''); render(); }, 'alt sm')));
  }

  function render() {
    if (view === 'room' && !room) view = 'menu';
    body.replaceChildren(view === 'room' ? roomView() : view === 'join' ? joinView() : menuView());
    const off = body.querySelector('button.off');
    if (off) off.disabled = true;
  }

  function leaveAll() {
    if (rooms) { rooms.leave(); rooms.close(); rooms = null; }
    room = null; inGame = false; view = 'menu'; say('');
    app.go('title');
  }

  s.open = () => { ensure(); say(''); view = room ? 'room' : 'menu'; render(); app.go('lobby'); };
  s.leave = leaveAll;
  /** După meci: înapoi în cameră (rămânem în ea). */
  s.back = () => { inGame = false; view = room ? 'room' : 'menu'; render(); app.go('lobby'); };
  s.sendBack = () => { if (rooms) rooms.send({ k: 'back' }); };
  return s;
}
