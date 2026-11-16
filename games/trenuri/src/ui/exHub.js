// Cardul „💼 Mod expert”: file Finanțe, Bursă, Raport anual, Clasament. Se redesenează după fiecare comandă.
import { h } from '../../../../shared/ui/dom.js';
import { standings, netWorth } from '../sim/index.js';
import { createTips } from './exTip.js';
import { financeView } from './exFinance.js';
import { stocksView } from './exStocks.js';
import { reportView } from './exReport.js';
import { lei } from './hud.js';

const TABS = [['fin', '💰 Finanțe'], ['bursa', '📈 Bursă'], ['raport', '📊 Raport'], ['top', '🏆 Clasament']];
const MEDAL = ['🥇', '🥈', '🥉'];

/** o = { card, state(), me(), exec(cmd) -> rezultat }. */
export function createExpertUi(o) {
  let tab = 'fin', year = 0, open = false;
  const { tip, note } = createTips();

  function ranking(s, me) {
    return standings(s).map((c, i) => h('div', { class: 'row' + (c.id === me ? ' mine' : '') }, h('span', null, `${MEDAL[i] || i + 1 + '.'} `, h('i', { class: 'dot', style: { background: c.color } }), c.name + (s.companies[c.id].ai ? ' 🤖' : '')), h('b', null, lei(c.value))));
  }
  function render() {
    const s = o.state(), co = s.companies[o.me()] || s.companies[0];
    const act = (cmd) => { const r = o.exec(cmd); setTimeout(render, 0); setTimeout(() => { if (open && o.card.isOpen()) render(); }, 600); return r; }; // în rețea răspunsul vine după ce gazda aplică comanda
    const ctx = { s, co, tip, act };
    const body = tab === 'fin' ? financeView(ctx) : tab === 'bursa' ? stocksView(ctx) : tab === 'raport' ? reportView(ctx, year, (y) => { year = y; render(); })
      : [h('div', null, 'Clasamentul e după valoarea netă: averea personală plus acțiunile.', ' ', tip('Valoare netă = banii tăi personali + cât valorează toate acțiunile pe care le ai, la toate companiile.')), ranking(s, co.id), h('div', { class: 'row' }, h('span', null, 'Averea ta'), h('b', null, lei(netWorth(s, co.id))))];
    const el = o.card.open(h('h3', null, '💼 Mod expert'),
      h('div', { class: 'tabs' }, TABS.map(([k, t]) => h('button', { class: 'opt' + (k === tab ? ' on' : ''), onclick: () => { tab = k; render(); } }, t))), body, note);
    el.classList.add('ex');
    open = true;
  }
  return { show(t) { if (t) tab = t; render(); }, refresh() { if (open && o.card.isOpen()) render(); else open = false; } };
}
