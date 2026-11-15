// „Joacă în rețea”: meniu (creează / intră cu cod), camera cu jucători și pornirea nivelului pentru toți.
import './net.css';
import { h } from '../../../../shared/ui/dom.js';
import { connectRooms } from '../../../../shared/net/rooms.js';
import { drawAvatar } from '../../../../shared/engine/profiles.js';
import { makeScreen, btn } from '../screens/ui.js';
import { loadProgress } from '../progress.js';
import { getLevel, levelMeta, WORLDS, LEVELS_PER_WORLD } from '../levels/index.js';
import { WORLD_ICON } from '../render/themes.js';
import { HERO } from '../render/hero.js';
import { createKeypad } from '../../../../shared/ui/keypad.js';
import { createNet } from './sync.js';
import { amHost, startIds, levelHash } from './logic.js';

const ERRORS = {
  not_found: 'Nu există nicio cameră cu codul ăsta.', full: 'Camera e plină (maxim 4 jucători).', bad: 'Codul nu e bun.',
  busy: 'Serverul e ocupat acum. Încearcă iar.', not_in_room: '',
};
const BLOCKED = { time: 'limit', disabled: 'disabled' };

export function createLobby(app) {
  let rooms = null, room = null, net = null, view = 'menu', level = 0;
  const err = h('p', { class: 'err' });
  const body = h('div');
  const gata = h('button', { class: 'big netgata hidden', onclick: () => net && net.forceEnd() }, 'Gata ✔');
  document.body.appendChild(gata);
  const s = makeScreen([h('h2', null, '🌐 Joacă în rețea'), err, body]);
  const keypad = createKeypad({ onChange: () => { err.textContent = ''; }, onSubmit: (c) => rooms.join(c) });
  const onKey = (e) => { if (view === 'join' && !s.el.classList.contains('hidden')) keypad.onKey(e); };
  addEventListener('keydown', onKey);

  const say = (t) => { err.textContent = t || ''; };
  const players = () => (room ? room.players : []);

  function ensure() {
    if (rooms) return;
    rooms = connectRooms();
    rooms.on('room', onRoom);
    rooms.on('msg', onMsg);
    rooms.on('closed', (m) => {
      room = null; net = null; gata.classList.add('hidden');
      const why = BLOCKED[m.reason];
      if (why) app.block(why); else { view = 'menu'; app.go('lobby'); render(); }
    });
    rooms.on('error', (m) => {
      if (m.code === 'rate' || m.code === 'not_in_room') return;
      if (BLOCKED[m.code]) { app.block(BLOCKED[m.code]); return; }
      if (net || view === 'room') return;
      keypad.reset(); say(ERRORS[m.code] || 'Ceva n-a mers. Încearcă iar.'); render();
    });
  }

  function onRoom(m) {
    room = m;
    if (net) {
      if (!net.ids.includes(m.you)) { net = null; gata.classList.add('hidden'); view = 'room'; app.go('lobby'); say('Te-ai reconectat. Aștepți următorul nivel.'); } else { net.setRoom(m.players); return; }
    }
    if (app.state === 'lobby' || app.state === 'title') { view = 'room'; say(''); render(); }
  }

  function onMsg(m) {
    const d = m.d, ev = d && Array.isArray(d.ev) ? d.ev.find((e) => e && e.e === 'start') : null;
    if (ev && !net && room && amHost(players(), m.from) && m.from !== room.you) return begin(ev);
    if (net) net.handle(m);
  }

  /** Pornește nivelul `ev.level` cu personajele în ordinea `ev.ids` (de la gazdă). */
  function begin(ev) {
    const ids = Array.isArray(ev.ids) ? ev.ids.filter((x) => typeof x === 'string').slice(0, 4) : [];
    if (!Number.isInteger(ev.level) || ev.level < 0 || !ids.includes(room.you)) return;
    if (levelHash(getLevel(ev.level).grid) !== ev.h) { say('Gazda are altă versiune a jocului. Reîncarcă pagina.'); render(); return; }
    net = createNet({ rooms, you: room.you, ids, players: room.players, onArrived: (n, total, host) => gata.classList.toggle('hidden', !(host && n > 0 && n < total)) });
    app.startNetLevel(ev.level, ids.length, net);
  }

  function startAsHost() {
    const ids = startIds(players());
    if (ids.length < 2) return;
    const ev = { e: 'start', level, ids, h: levelHash(getLevel(level).grid) };
    rooms.send({ ev: [ev] });
    begin(ev);
  }

  // ---------- ecrane ----------
  function menuView() {
    return h('div', null,
      h('p', { class: 'sub' }, 'Joacă împreună cu familia, pe alte dispozitive. 2 până la 4 jucători.'),
      h('div', { class: 'btns' },
        btn('➕ Creează cameră', () => { say(''); rooms.create('bobo'); }),
        btn('🔑 Intră cu cod', () => { view = 'join'; keypad.reset(); render(); }, 'alt')),
      h('div', { class: 'btns', style: { marginBottom: 0 } }, btn('← Înapoi', () => leaveAll(), 'alt sm')));
  }

  function joinView() {
    return h('div', null, h('p', { class: 'sub' }, 'Scrie codul de 4 litere de pe celălalt dispozitiv.'), keypad.el,
      h('div', { class: 'btns', style: { margin: '8px 0 0' } }, btn('← Înapoi', () => { view = 'menu'; say(''); render(); }, 'alt sm')));
  }

  function playerCard(p, i) {
    const cv = h('canvas', { width: 112, height: 112, style: { width: '56px', height: '56px' } });
    drawAvatar(cv.getContext('2d'), p.avatar, 56, 56, 52, p.color);
    return h('div', { class: 'pl' + (p.id === room.you ? ' me' : ''), style: { borderColor: p.id === room.you ? '' : HERO[i].color } }, cv,
      h('b', null, p.name), h('small', null, (p.host ? '👑 ' : '') + 'e ' + HERO[i].name));
  }

  function roomView() {
    const list = players(), host = amHost(list, room.you), pr = loadProgress();
    level = Math.max(0, Math.min(level, pr.unlocked - 1));
    const m = levelMeta(level);
    const step = (d) => { level = Math.max(0, Math.min(pr.unlocked - 1, level + d)); render(); };
    const picker = h('div', { class: 'pick' },
      btn('⏪', () => step(-LEVELS_PER_WORLD), 'alt sm'), btn('◀', () => step(-1), 'alt sm'),
      h('span', { class: 'lvl' }, WORLD_ICON[m.world] + ' ' + WORLDS[m.world].name + ' · ' + m.num + (m.isBoss ? ' 👑' : '')),
      btn('▶', () => step(1), 'alt sm'), btn('⏩', () => step(LEVELS_PER_WORLD), 'alt sm'));
    return h('div', null,
      h('p', { class: 'sub', style: { margin: '0' } }, 'Codul camerei'),
      h('div', { class: 'code' }, [...room.code].map((ch) => h('span', { class: 'ch' }, ch))),
      h('div', { class: 'plist' }, list.map(playerCard)),
      host ? picker : h('p', { class: 'sub' }, 'Așteptăm gazda să aleagă nivelul…'),
      h('div', { class: 'btns', style: { marginBottom: 0 } },
        host ? btn(list.length < 2 ? 'Așteaptă prieteni…' : '▶ Pornește jocul', () => startAsHost(), list.length < 2 ? 'off' : '') : null,
        btn('🚪 Ieși din cameră', () => { rooms.leave(); room = null; view = 'menu'; say(''); render(); }, 'alt sm')));
  }

  function render() {
    if (view === 'room' && !room) view = 'menu';
    const v = view === 'room' ? roomView() : view === 'join' ? joinView() : menuView();
    body.replaceChildren(v);
    const off = body.querySelector('button.off');
    if (off) off.disabled = true;
  }

  function leaveAll() {
    if (rooms) { rooms.leave(); rooms.close(); rooms = null; }
    room = null; net = null; view = 'menu'; gata.classList.add('hidden'); say('');
    app.go('title');
  }

  s.open = () => { ensure(); say(''); if (!room) view = 'menu'; else view = 'room'; render(); app.go('lobby'); };
  /** După un nivel: înapoi în cameră (jucătorii rămân în ea). */
  s.back = () => { net = null; gata.classList.add('hidden'); view = room ? 'room' : 'menu'; render(); app.go('lobby'); };
  s.leave = leaveAll;
  s.hasNet = () => !!net;
  return s;
}
