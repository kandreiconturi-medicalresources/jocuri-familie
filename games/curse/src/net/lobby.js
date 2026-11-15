// „În rețea”: creează cameră / intră cu cod de 4 litere, camera cu jucători, alegerile gazdei, pornirea cursei.
import { h } from '../../../../shared/ui/dom.js';
import { connectRooms } from '../../../../shared/net/rooms.js';
import { createKeypad } from '../../../../shared/ui/keypad.js';
import { TRACKS, CAR_COLORS } from '../tracks/tracks.js';
import { makeScreen, btn, optRow, carIcon } from '../screens/ui.js';

const ERRORS = {
  not_found: 'Nu există nicio cameră cu codul ăsta.', full: 'Camera e plină (maxim 4 jucători).', bad: 'Codul nu e bun.',
  busy: 'Serverul e ocupat acum. Încearcă iar.', not_in_room: '',
};
const BLOCKED = { time: 'limit', disabled: 'disabled' };
const BOT_NAMES = ['Fulger', 'Turbo', 'Roby', 'Sprint'];

export function createLobby(app) {
  let rooms = null, room = null, view = 'menu', inGame = false;
  const opt = { track: 0, laps: 3, bots: 0, level: 'mid' };
  const err = h('p', { class: 'err' }), body = h('div');
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
    if (!cfg || !Array.isArray(cfg.entries) || !cfg.entries.some((p) => p.id === room.you) || !TRACKS[cfg.track]) return;
    inGame = true;
    const hp = list().find((p) => p.host);
    app.startNet(cfg, { rooms, you: room.you, host: !!hp && hp.id === room.you });
  }

  function startAsHost() {
    const humans = list().slice(0, 4);
    if (humans.length + opt.bots < 2) return;
    const entries = humans.map((p, i) => ({ id: p.id, name: p.name, color: CAR_COLORS[i].id }));
    for (let i = 0; i < Math.min(opt.bots, 4 - humans.length); i++) {
      entries.push({ id: 'bot' + i, name: BOT_NAMES[i], color: CAR_COLORS[entries.length].id, bot: true, level: opt.level });
    }
    const cfg = { track: opt.track, laps: opt.laps, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, entries };
    rooms.send({ k: 'start', cfg });
    begin(cfg);
  }

  const menuView = () => h('div', null,
    h('p', { class: 'sub' }, 'Joacă împreună cu familia, pe alte dispozitive. 2 până la 4 jucători.'),
    h('div', { class: 'btns' }, btn('➕ Creează cameră', () => { say(''); rooms.create('curse'); }), btn('🔑 Intră cu cod', () => { view = 'join'; keypad.reset(); render(); }, 'alt')),
    h('div', { class: 'btns' }, btn('← Înapoi', () => leaveAll(), 'alt sm')));

  const joinView = () => h('div', null, h('p', { class: 'sub' }, 'Scrie codul de 4 litere de pe celălalt dispozitiv.'), keypad.el,
    h('div', { class: 'btns' }, btn('← Înapoi', () => { view = 'menu'; say(''); render(); }, 'alt sm')));

  function roomView() {
    const pl = list(), me = pl.find((p) => p.id === room.you), host = !!(me && me.host);
    opt.bots = Math.min(opt.bots, 4 - pl.length);
    const unlocked = app.save.get('unlocked', 1);
    const step = (d) => { opt.track = (opt.track + d + TRACKS.length) % TRACKS.length; render(); };
    const set = (k) => (v) => { opt[k] = v; render(); };
    const options = host ? h('div', null,
      h('div', { class: 'row' }, btn('◀', () => step(-1), 'alt sm'), h('span', { class: 'val' }, (opt.track + 1) + '. ' + TRACKS[opt.track].name + (opt.track >= unlocked ? ' 🔒' : '')), btn('▶', () => step(1), 'alt sm')),
      optRow('Ture', [1, 3, 5].map((n) => [n, String(n)]), opt.laps, set('laps')),
      optRow('Boți', [0, 1, 2].filter((n) => n <= 4 - pl.length).map((n) => [n, String(n)]), opt.bots, set('bots')),
      optRow('Boții sunt', [['easy', 'Ușori'], ['mid', 'Medii'], ['hard', 'Grei']], opt.level, set('level')))
      : h('p', { class: 'sub' }, 'Așteptăm gazda să pornească cursa…');
    const can = pl.length + opt.bots >= 2 && opt.track < unlocked;
    return h('div', null, h('p', { class: 'sub', style: { margin: 0 } }, 'Codul camerei'),
      h('div', { class: 'code' }, [...room.code].map((ch) => h('span', { class: 'ch' }, ch))),
      h('div', { class: 'plist' }, pl.map((p, i) => h('div', { class: 'pl' + (p.id === room.you ? ' me' : '') }, carIcon(CAR_COLORS[i % 4].id, 54), h('b', null, p.name), h('small', null, p.host ? '👑 gazdă' : '')))),
      options,
      h('div', { class: 'btns' },
        host ? btn(can ? '▶ Pornește cursa' : (opt.track >= unlocked ? '🔒 Pistă blocată' : 'Așteaptă prieteni…'), () => startAsHost(), can ? '' : 'off') : null,
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
  s.back = () => { inGame = false; view = room ? 'room' : 'menu'; render(); app.go('lobby'); };
  s.sendBack = () => { if (rooms) rooms.send({ k: 'back' }); };
  return s;
}
