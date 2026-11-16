// „🗺️ Insulele” (etapa 7.1): tabel insulă × resursă, ce îți lipsește și de unde îl aduci, porturile și clasamentul.
import { h } from '../../../../shared/ui/dom.js';
import { INDUSTRIES, GOODS, NG } from '../sim/goods.js';
import { PRIMARY } from '../sim/islandGen.js';
import { islandGoods, islandOfCo, portsOf } from '../sim/islands.js';
import { priceOf } from '../sim/market.js';
import { standings } from '../sim/value.js';
import { lei } from './hud.js';

const MEDAL = ['🥇', '🥈', '🥉'];
const center = (q) => [(q.x0 + q.x1) >> 1, (q.y0 + q.y1) >> 1];

/** ctx = { card, state(), me(), show(x,y), portTool(), shipWizard(), port(st) } */
export function openIslandsInfo(ctx) {
  const s = ctx.state(), me = ctx.me(), { open, row, chip } = ctx.card;
  if (!s || !s.islands) return;
  const mine = islandOfCo(s, me), can = s.islands.map((_, k) => islandGoods(s, k));
  const owner = (q) => (q.owner < 0 ? 'fără stăpân (poți construi)' : q.owner === me ? 'a ta' : s.companies[q.owner].name);
  const table = h('table', { class: 'isl' },
    h('tr', null, h('th', null, ''), PRIMARY.map((t) => h('th', { title: INDUSTRIES[t].name }, GOODS[INDUSTRIES[t].out].icon))),
    s.islands.map((q, k) => h('tr', { class: k === mine ? 'me' : '' },
      h('td', null, h('button', { class: 'lnk', onclick: () => ctx.show(...center(q)) }, '📍 ' + q.name.replace('Insula ', '')), h('small', null, ' ' + owner(q))),
      PRIMARY.map((t) => h('td', null, q.has.includes(t) ? '✅' : '—')))));
  const lack = [];
  if (mine >= 0) {
    for (let g = 2; g < NG; g++) {
      if (can[mine][g]) continue;
      const where = s.islands.map((q, k) => (k !== mine && can[k][g] ? { q, k } : null)).filter(Boolean);
      lack.push(h('div', { class: 'row' }, h('span', null, chip(g), ' ' + GOODS[g].name),
        where.length ? h('span', null, where.slice(0, 2).map((w) => h('button', { class: 'lnk', onclick: () => ctx.show(...center(w.q)) }, `📍 ${w.q.name.replace('Insula ', '')} · ${lei(priceOf(s, w.k, g))}/t`))) : h('small', null, 'nu se face nicăieri încă')));
    }
  }
  const ports = portsOf(s, me), others = s.stations.filter((q) => q.port && q.owner !== me);
  open(h('h3', null, '🗺️ Insulele'),
    h('div', { class: 'note' }, 'Fiecare insulă are doar o parte din resurse. Ce îți lipsește aduci cu vaporul 🚢 din porturile celorlalți; pe insula altuia nu poți construi.'),
    table,
    h('div', null, h('b', null, mine >= 0 ? 'Ce îți lipsește și de unde îl aduci' : 'Nu ai încă o insulă')), lack.length ? lack : null,
    h('div', null, h('b', null, `⚓ Porturile tale (${ports.length})`)),
    ports.length ? ports.map((p) => h('button', { class: 'opt', onclick: () => ctx.port(p) }, '⚓ ' + p.name)) : h('div', { class: 'news' }, 'Niciun port încă: primul nu cere materiale.'),
    h('div', { class: 'rowb' }, h('button', { class: 'opt go', onclick: () => ctx.portTool() }, '⚓ Construiește port'), ports.length ? h('button', { class: 'opt', onclick: () => ctx.shipWizard() }, '🚢 Vapor nou') : null),
    others.length ? [h('div', null, h('b', null, 'Porturi unde poți face comerț')), others.map((p) => h('button', { class: 'opt', onclick: () => ctx.port(p) }, `⚓ ${p.name} · ${s.companies[p.owner].name}`))] : null,
    s.companies.length > 1 ? [h('div', null, h('b', null, '🏆 Clasament (valoarea companiei)')),
      standings(s).map((c, i) => h('div', { class: 'row' + (c.id === me ? ' me' : '') }, h('span', null, (MEDAL[i] || i + 1 + '.') + ' ', h('i', { class: 'dot', style: { background: c.color } }), ' ' + c.name), h('b', null, lei(c.value))))] : null);
}
