// Panoul „Bursa” (modul expert): avere personală, prețuri, cumpărare/vânzare/răscumpărare, preluarea unui AI.
import { h } from '../../../../shared/ui/dom.js';
import { netWorth, stakePct, isMajor, SHARES } from '../sim/index.js';
import { lei } from './hud.js';
import { trow } from './exTip.js';

const N = 10; // câte acțiuni se mută la o atingere

export function stocksView(ctx) {
  const { s, co, tip, act } = ctx, me = co.id;
  const rows = s.companies.filter((c) => !c.dead).map((c) => {
    const mine = c.sh[me], old = c.vh.length > 1 ? c.vh[c.vh.length - 2] : 0, up = c.vh.length > 1 && c.vh[c.vh.length - 1] >= old;
    const self = c.id === me, ai = !!c.ai;
    return h('div', { class: 'stock' + (self ? ' me' : '') },
      h('div', { class: 'row' }, h('span', null, h('i', { class: 'dot', style: { background: c.color } }), c.name + (self ? ' (a ta)' : ai ? ' 🤖' : '')), h('b', null, `${lei(c.px)} ${up ? '📈' : '📉'}`)),
      h('div', { class: 'row sub' }, h('span', null, `Ai ${mine} (${stakePct(c, me)}%) · pe piață ${c.mk}`), h('span', null, `valoare ${lei(mine * c.px)}`)),
      h('div', { class: 'btns' },
        h('button', { class: 'opt', disabled: c.mk < N || co.pw < c.px * N, title: self ? 'Răscumperi acțiuni de la public: ai tot mai mult control.' : 'Cumperi acțiuni: primești dividend când compania câștigă.', onclick: () => act({ type: 'buyShares', co: c.id, n: N }) }, self ? '🔁 Răscumpără' : '➕ Cumpără', h('small', null, `${N} · ${lei(c.px * N)}`)),
        h('button', { class: 'opt', disabled: mine < N, title: 'Vinzi acțiuni și banii intră în averea ta personală.', onclick: () => act({ type: 'sellShares', co: c.id, n: N }) }, '➖ Vinde', h('small', null, `${N} · ${lei(c.px * N)}`)),
        ai && isMajor(c, me) ? h('button', { class: 'opt go', title: 'Ai peste jumătate din acțiuni: gările, trenurile și datoriile companiei trec la compania ta.', onclick: () => act({ type: 'takeover', co: c.id }) }, '🤝 Preia compania') : null));
  });
  return [
    trow(tip, '👤 Averea ta personală', 'Banii tăi de director sunt separați de banii companiei. Cu ei cumperi acțiuni. Primești dividende o dată pe an, în ianuarie.', lei(co.pw)),
    trow(tip, '🏆 Valoarea netă', 'Averea personală plus cât valorează acțiunile pe care le ai. Clasamentul se face după ea.', lei(netWorth(s, me))),
    h('div', null, h('b', null, 'Companii'), ' ', tip(`Fiecare companie are ${SHARES} de acțiuni. Prețul se recalculează în fiecare lună din profit, active, datorii și creștere. Peste 50% dintr-o companie AI poți s-o preiei.`)),
    rows,
  ];
}
