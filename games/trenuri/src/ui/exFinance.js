// Panoul „Finanțe” (modul expert): rating, împrumuturi pe tranșe, costuri lunare, avertisment de faliment.
import { h } from '../../../../shared/ui/dom.js';
import { ratingOf, interestOf, maintOf, RATINGS, LOAN_TR, BANKRUPT_MONTHS } from '../sim/index.js';
import { lei } from './hud.js';
import { trow } from './exTip.js';

export function financeView(ctx) {
  const { s, co, tip, act } = ctx, r = ratingOf(s, co.id), R = RATINGS[r], m = maintOf(s, co);
  const canTake = co.tr.length < R.max;
  return [
    h('div', { class: 'row big' }, h('span', null, '💰 Banii companiei'), h('b', { class: co.cash < 0 ? 'bad' : '' }, lei(co.cash))),
    co.cash < 0 ? h('div', { class: 'warnbox' }, `⚠️ Ești pe minus de ${co.neg} ${co.neg === 1 ? 'lună' : 'luni'}. Dacă ține ${BANKRUPT_MONTHS} luni la rând, jocul se oprește. Încasează, vinde un tren sau ia un împrumut!`) : null,
    trow(tip, '⭐ Rating', 'Banca se uită cât din ce ai e datorie. Cu cât datorezi mai puțin, cu atât ratingul e mai bun, dobânda mai mică și poți lua mai multe împrumuturi.', `${R.k} · ${R.name}`),
    trow(tip, '🏦 Datorii', 'Împrumuturile se iau în tranșe de 10.000 de lei. Fiecare tranșă își ține dobânda de când a fost luată.', lei(co.loan)),
    co.tr.map((t, i) => h('div', { class: 'row sub' }, h('span', null, `Tranșa ${i + 1}`), h('b', null, `${lei(t.p)} · ${(t.r / 10).toFixed(1).replace('.', ',')}% pe an`))),
    h('div', { class: 'btns' },
      h('button', { class: 'opt go', disabled: !canTake, title: 'Primești 10.000 de lei acum și plătești dobândă în fiecare lună.', onclick: () => act({ type: 'takeLoan' }) },
        '➕ Împrumut', h('small', null, canTake ? `${lei(LOAN_TR)} · ${(R.rate / 10).toFixed(1).replace('.', ',')}% pe an` : 'Banca spune: ajunge')),
      h('button', { class: 'opt', disabled: !co.tr.length, title: 'Plătești înapoi tranșa cu dobânda cea mai mare.', onclick: () => act({ type: 'repayLoan' }) },
        '↩️ Rambursează', h('small', null, co.tr.length ? 'tranșa cea mai scumpă' : 'nu ai datorii'))),
    h('div', null, h('b', null, 'Costuri pe lună'), ' ', tip('Întreținerea șinelor, gărilor și trenurilor, plus dobânda. Trenurile vechi costă mai mult: +2% pe lună, până la +150%. Vinde-le sau înlocuiește-le la timp!')),
    trow(tip, '🛤️ Șine', '', lei(m.tiles)), trow(tip, '🚉 Gări', '', lei(m.stations)), trow(tip, '🚂 Trenuri', 'Cresc cu vârsta trenului.', lei(m.trains)), trow(tip, '🏦 Dobândă', '', lei(interestOf(co))),
    h('div', { class: 'row' }, h('span', null, 'Total pe lună'), h('b', null, lei(m.total + interestOf(co)))),
  ];
}
