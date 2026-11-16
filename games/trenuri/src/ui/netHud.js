// Cutiuța din meciul în rețea: jucătorii cu culorile companiilor (cooperativ) sau clasamentul după valoarea companiei (competitiv).
import { h } from '../../../../shared/ui/dom.js';
import { standings, teamPlayers } from '../sim/index.js';
import { lei } from './hud.js';

const MEDAL = ['🥇', '🥈', '🥉', '4️⃣'];

/** Pe echipe (7.5): sub fiecare echipă, membrii ca pastile; gazda atinge o pastilă ca să mute jucătorul în echipa următoare. */
function members(s, c, isHost, onAssign) {
  const humans = s.companies.filter((q) => !q.ai && !q.dead).map((q) => q.id);
  return h('div', { class: 'tmem' }, teamPlayers(s, c.id).map((pl) => {
    const name = (s.net.nm && s.net.nm[pl]) || 'Jucător';
    if (!isHost || humans.length < 2 || !onAssign) return h('span', { class: 'chip' }, name);
    const next = humans[(humans.indexOf(c.id) + 1) % humans.length];
    return h('button', { class: 'chip', title: 'Mută în ' + s.companies[next].name, onclick: () => onAssign(pl, next, name) }, name + ' ➡️');
  }));
}

export function createNetHud(root, onAssign) {
  const el = h('div', { class: 'nethud hidden' });
  root.append(el);
  let last = '';
  return {
    el,
    /** s = lumea, players = lista camerei, me = compania mea, sync = true cât se așteaptă starea de la gazdă. */
    update(s, players, me, sync, isHost) {
      const comp = !!s.islands || (s.net && s.net.mode === 'comp'); // în lumea cu insule clasamentul se vede mereu
      const rows = comp
        ? standings(s).map((c, i) => h('div', null, h('div', { class: 'nr' + (c.id === me ? ' me' : '') }, MEDAL[i] || '', h('i', { class: 'dot', style: { background: c.color } }), c.name + (s.companies[c.id].ai ? ' 🤖' : ''), h('b', null, lei(c.value))), c.mem && c.mem.length ? members(s, c, isHost, onAssign) : null))
        : players.map((p) => h('div', { class: 'nr' }, h('i', { class: 'dot', style: { background: p.color || '#999' } }), (p.name || 'Jucător') + (p.host ? ' 👑' : '')));
      const key = rows.map((r) => r.textContent).join('|') + sync + isHost + (s.net && s.net.team ? JSON.stringify(s.net.pl) : '');
      if (key === last) return;
      last = key;
      el.replaceChildren(h('div', { class: 'nt' }, comp ? (s.islands ? '🏆 Clasament (valoarea netă)' : '🏆 Clasament') : '🤝 Echipa', sync ? ' · ⏳ se sincronizează' : '', isHost ? '' : ' · gazda alege viteza'), rows);
      el.classList.remove('hidden');
    },
    hide() { el.classList.add('hidden'); last = ''; },
  };
}
