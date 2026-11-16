// Cutiuța din meciul în rețea: jucătorii cu culorile companiilor (cooperativ) sau clasamentul după valoarea companiei (competitiv).
import { h } from '../../../../shared/ui/dom.js';
import { standings } from '../sim/index.js';
import { lei } from './hud.js';

const MEDAL = ['🥇', '🥈', '🥉', '4️⃣'];

export function createNetHud(root) {
  const el = h('div', { class: 'nethud hidden' });
  root.append(el);
  let last = '';
  return {
    el,
    /** s = lumea, players = lista camerei, me = compania mea, sync = true cât se așteaptă starea de la gazdă. */
    update(s, players, me, sync, isHost) {
      const comp = s.net && s.net.mode === 'comp';
      const rows = comp
        ? standings(s).map((c, i) => h('div', { class: 'nr' + (c.id === me ? ' me' : '') }, MEDAL[i] || '', h('i', { class: 'dot', style: { background: c.color } }), c.name, h('b', null, lei(c.value))))
        : players.map((p) => h('div', { class: 'nr' }, h('i', { class: 'dot', style: { background: p.color || '#999' } }), (p.name || 'Jucător') + (p.host ? ' 👑' : '')));
      const key = rows.map((r) => r.textContent).join('|') + sync + isHost;
      if (key === last) return;
      last = key;
      el.replaceChildren(h('div', { class: 'nt' }, comp ? '🏆 Clasament' : '🤝 Echipa', sync ? ' · ⏳ se sincronizează' : '', isHost ? '' : ' · gazda alege viteza'), rows);
      el.classList.remove('hidden');
    },
    hide() { el.classList.add('hidden'); last = ''; },
  };
}
