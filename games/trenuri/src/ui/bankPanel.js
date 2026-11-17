// „🏦 Banca” (etapa 7.4): credit, dobândă, rating și rambursare automată, cu explicații simple. Merge în lumea cu insule, și în modul simplu.
import { h } from '../../../../shared/ui/dom.js';
import { ratingOf, interestOf, RATINGS, LOAN_TR } from '../sim/index.js';
import { lei } from './hud.js';

const PCT = [0, 10, 25, 50];
const pc = (r) => (r / 10).toFixed(1).replace('.', ',') + '% pe an';

/** ctx = { card, state(), me(), exec(cmd) }. Se redesenează după fiecare comandă (în rețea răspunsul vine puțin mai târziu). */
export function openBankPanel(ctx) {
  const s = ctx.state(), co = s && s.companies[ctx.me()];
  if (!s || !co || !co.tr) return;
  const again = () => { setTimeout(() => openBankPanel(ctx), 0); setTimeout(() => { if (ctx.card.isOpen()) openBankPanel(ctx); }, 600); };
  const act = (cmd) => { ctx.exec(cmd); again(); };
  const r = ratingOf(s, co.id), R = RATINGS[r], canTake = co.tr.length < R.max, ar = co.ar | 0;
  const last = co.history.length ? co.history[co.history.length - 1] : 0;
  const el = ctx.card.open(h('h3', null, '🏦 Banca'),
    h('div', { class: 'note' }, 'Banca îți dă bani cu împrumut, în tranșe de 10.000 de lei. În fiecare lună plătești o dobândă, adică un mic preț pentru banii primiți. Cu cât datorezi mai puțin față de cât valorează compania, cu atât ratingul e mai bun, dobânda mai mică și poți lua mai multe tranșe.'),
    h('div', { class: 'row big' }, h('span', null, '💰 Banii companiei'), h('b', { class: co.cash < 0 ? 'bad' : '' }, lei(co.cash))),
    h('div', { class: 'row' }, h('span', null, '⭐ Rating'), h('b', null, `${R.k} · ${R.name}`)),
    h('div', { class: 'row' }, h('span', null, '🏦 Datorie'), h('b', null, lei(co.loan))),
    co.tr.map((t, i) => h('div', { class: 'row sub' }, h('span', null, `Tranșa ${i + 1}`), h('b', null, `${lei(t.p)} · ${pc(t.r)}`))),
    h('div', { class: 'row' }, h('span', null, '📆 Dobânda pe luna asta'), h('b', null, lei(interestOf(co)))),
    h('div', { class: 'btns' },
      h('button', { class: 'opt go', disabled: !canTake, onclick: () => act({ type: 'takeLoan' }) }, '➕ Împrumut', h('small', null, canTake ? `${lei(LOAN_TR)} · ${pc(R.rate)}` : 'Banca spune: ajunge')),
      h('button', { class: 'opt', disabled: !co.tr.length, onclick: () => act({ type: 'repayLoan' }) }, '↩️ Rambursează', h('small', null, co.tr.length ? 'tranșa cea mai scumpă' : 'nu ai datorii'))),
    h('div', null, h('b', null, '🔁 Rambursare automată')),
    h('div', { class: 'note' }, 'Când luna se termină cu câștig, banca ia singură câțiva la sută din câștig și îți micșorează datoria, începând cu tranșa cea mai scumpă. Așa plătești dobândă mai puțină, fără să mai ții minte. Dacă luna e pe pierdere, nu ia nimic.'),
    h('div', { class: 'btns' }, PCT.map((p) => h('button', { class: 'opt' + (ar === p ? ' on' : ''), onclick: () => act({ type: 'setAutoRepay', pct: p }) }, p ? p + '%' : 'Oprit', h('small', null, p ? `din ${last > 0 ? lei(last) : 'câștigul lunii'}` : 'nimic automat')))),
    ar && last > 0 ? h('div', { class: 'note' }, `Luna trecută ai câștigat ${lei(last)}, deci ${ar}% înseamnă ${lei(Math.floor((last * ar) / 100))} rambursați singuri.`) : null);
  el.classList.add('wide');
}
