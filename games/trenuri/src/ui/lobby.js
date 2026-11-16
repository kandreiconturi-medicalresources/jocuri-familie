// „Joacă în rețea”: creează cameră (cod de 4 litere) sau intră cu cod; lista jucătorilor are culorile companiilor,
// gazda alege modul (cooperativ / competitiv), harta (mărime și an) sau un scenariu și pornește meciul.
import { h } from '../../../../shared/ui/dom.js';
import { connectRooms } from '../../../../shared/net/rooms.js';
import { createKeypad } from '../../../../shared/ui/keypad.js';
import { SCENARIOS } from '../sim/index.js';

const ERRORS = { not_found: 'Nu există nicio cameră cu codul ăsta.', full: 'Camera e plină (maxim 4 jucători).', bad: 'Codul nu e bun.', busy: 'Serverul e ocupat acum. Încearcă iar.' };
const BLOCKED = { time: 'limit', disabled: 'disabled' };
const PALETTE = ['#ff6b6b', '#4dabf7', '#ffd23f', '#51cf66', '#e599f7', '#ffa94d'];
const YEARS = [[1840, '1840'], [1900, '1900'], [1950, '1950']];
const SIZES = [['S', 'Mică'], ['M', 'Medie'], ['L', 'Mare']];

/** Culori diferite pentru fiecare jucător (două conturi pot avea aceeași culoare de profil). */
export function distinctColors(players) {
  const used = new Set();
  return players.slice(0, 4).map((p) => {
    let c = p.color && !used.has(p.color) ? p.color : PALETTE.find((q) => !used.has(q)) || '#999999';
    used.add(c);
    return { id: p.id, name: String(p.name || 'Jucător').slice(0, 14), color: c };
  });
}

/** hooks = { begin(cfg, { rooms, you, hostId, late, players }), setRoom(players), msgInGame(): bool, ended(), blocked(reason) }. */
export function createLobby(root, hooks) {
  let rooms = null, room = null, view = 'menu', el = null, inGame = false;
  const opt = { mode: 'coop', size: 'S', year: 1950, scn: -1 };
  const err = h('p', { class: 'err' });
  const keypad = createKeypad({ onChange: () => { err.textContent = ''; }, onSubmit: (c) => rooms.join(c) });
  addEventListener('keydown', (e) => { if (view === 'join' && el) keypad.onKey(e); });
  const say = (t) => { err.textContent = t || ''; };
  const list = () => (room ? room.players : []);
  const hostOf = () => list().find((p) => p.host);

  function ensure() {
    if (rooms) return;
    rooms = connectRooms();
    rooms.on('room', (m) => {
      room = m;
      if (inGame) hooks.setRoom(m.players);
      else if (view === 'room' || view === 'menu' || view === 'join') { view = 'room'; say(''); render(); }
    });
    rooms.on('msg', (m) => {
      const d = m.d, host = hostOf();
      if (!d || d.k !== 'start' || !host || host.id !== m.from || m.from === room.you || !d.cfg || !Array.isArray(d.cfg.players)) return;
      if (inGame && !d.late) return;
      if (d.late || d.cfg.players.some((p) => p.id === room.you)) begin(d.cfg, !!d.late);
    });
    rooms.on('closed', (m) => {
      room = null;
      if (inGame) { inGame = false; hooks.ended(); }
      if (BLOCKED[m.reason]) { hooks.blocked(BLOCKED[m.reason]); return; }
      view = 'menu'; if (el) render();
    });
    rooms.on('error', (m) => {
      if (m.code === 'rate' || m.code === 'not_in_room' || inGame || view === 'room') return;
      if (BLOCKED[m.code]) { hooks.blocked(BLOCKED[m.code]); return; }
      keypad.reset(); say(ERRORS[m.code] || 'Ceva n-a mers. Încearcă iar.'); render();
    });
  }

  function begin(cfg, late) {
    inGame = true;
    close();
    const host = hostOf();
    hooks.begin(cfg, { rooms, you: room.you, hostId: host ? host.id : room.you, late, players: list() });
  }

  function startAsHost() {
    const cfg = { mode: opt.mode, seed: (Math.random() * 4294967295) >>> 0, size: opt.size, year: opt.year, scn: opt.mode === 'coop' && opt.scn >= 0 ? SCENARIOS[opt.scn].id : null, players: distinctColors(list()) };
    rooms.send({ k: 'start', cfg });
    begin(cfg, false);
  }

  const btn = (label, fn, cls) => h('button', { class: 'opt ' + (cls || ''), onclick: fn }, label);
  const choice = (title, items, cur, set) => h('div', { class: 'optrow' }, h('span', null, title), h('div', { class: 'rowb' }, items.map(([v, t]) => btn(t, () => { set(v); render(); }, v === cur ? 'on' : ''))));

  function menuView() {
    return h('div', { class: 'lob' }, h('p', null, 'Joacă împreună cu familia, pe alte dispozitive. 2 până la 4 jucători.'),
      h('div', { class: 'rowb' }, btn('➕ Creează cameră', () => { say(''); rooms.create('trenuri'); }, 'go'), btn('🔑 Intră cu cod', () => { view = 'join'; keypad.reset(); render(); })),
      h('div', { class: 'rowb' }, btn('⬅️ Înapoi', leaveAll)));
  }
  function joinView() {
    return h('div', { class: 'lob' }, h('p', null, 'Scrie codul de 4 litere de pe celălalt dispozitiv.'), keypad.el, h('div', { class: 'rowb' }, btn('⬅️ Înapoi', () => { view = 'menu'; say(''); render(); })));
  }
  function roomView() {
    const pl = list(), me = pl.find((p) => p.id === room.you), host = !!(me && me.host), cols = distinctColors(pl);
    const roster = h('div', { class: 'plist' }, pl.map((p, i) => h('div', { class: 'pl' + (p.id === room.you ? ' me' : '') },
      h('i', { class: 'dot', style: { background: cols[i] ? cols[i].color : p.color } }), p.name || 'Jucător', p.host ? ' 👑' : '')));
    const sc = opt.scn >= 0 ? SCENARIOS[opt.scn] : null;
    const step = (d) => { opt.scn = (opt.scn + d + SCENARIOS.length) % SCENARIOS.length; render(); };
    const options = host ? h('div', { class: 'lob' },
      choice('Cum jucăm', [['coop', '🤝 Împreună'], ['comp', '🏆 Întrecere']], opt.mode, (v) => { opt.mode = v; if (v === 'comp') opt.scn = -1; }),
      opt.mode === 'coop' ? choice('Harta', [[-1, '🌍 Nouă'], [0, '🎯 Scenariu']], opt.scn >= 0 ? 0 : -1, (v) => { opt.scn = v < 0 ? -1 : Math.max(0, opt.scn); }) : null,
      sc ? h('div', { class: 'rowb' }, btn('◀', () => step(-1)), h('span', { class: 'val' }, `${sc.icon} ${sc.name}`), btn('▶', () => step(1))) : [
        choice('Mărime', SIZES, opt.size, (v) => { opt.size = v; }), choice('Anul', YEARS, opt.year, (v) => { opt.year = v; })])
      : h('p', null, 'Așteptăm gazda să aleagă și să pornească jocul…');
    const can = pl.length >= 1;
    return h('div', { class: 'lob' }, h('p', null, 'Codul camerei'),
      h('div', { class: 'code' }, [...room.code].map((ch) => h('span', { class: 'ch' }, ch))), roster, options,
      h('div', { class: 'rowb' }, host ? btn(pl.length > 1 ? '▶️ Pornește jocul' : '▶️ Pornește (singur)', startAsHost, can ? 'go' : '') : null,
        btn('🚪 Ieși din cameră', () => { rooms.leave(); room = null; view = 'menu'; say(''); render(); })));
  }

  function render() {
    if (!el) return;
    if (view === 'room' && !room) view = 'menu';
    const body = view === 'room' ? roomView() : view === 'join' ? joinView() : menuView();
    el.replaceChildren(h('div', { class: 'mp' }, h('h2', null, '🌐 Joacă în rețea'), err, body));
  }
  function close() { if (el) { el.remove(); el = null; } }
  function leaveAll() {
    if (rooms) { rooms.leave(); rooms.close(); rooms = null; }
    room = null; inGame = false; view = 'menu'; say(''); close(); hooks.ended(true);
  }

  return {
    open() { ensure(); say(''); view = room ? 'room' : 'menu'; el = h('div', { class: 'menu lobby' }); root.append(el); render(); },
    /** Din meci: părăsește camera și închide conexiunea. */
    leave() { if (rooms) { rooms.leave(); rooms.close(); rooms = null; } room = null; inGame = false; view = 'menu'; close(); },
    close,
  };
}
