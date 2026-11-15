// Ecranul de titlu: Continuă / Joc nou (hartă mică, medie, mare), peste harta care se rotește singură.
import { h } from '../../../../shared/ui/dom.js';

export function createMenu(root, { hasSave, onContinue, onNew, onHome }) {
  let year = 1840;
  const size = (k, t, sub) => h('button', { class: 'opt', onclick: () => onNew(k, year) }, t, h('small', null, sub));
  const yb = [[1840, 'Începuturile', 'locomotive cu abur'], [1900, 'Epoca aburului', 'abur rapid'], [1950, 'Epoca nouă', 'diesel și electrice']].map(([y, t, sub]) => h('button', { class: 'opt' + (y === year ? ' on' : ''), onclick: () => { year = y; yb.forEach((b, i) => b.classList.toggle('on', [1840, 1900, 1950][i] === y)); } }, y + ' · ' + t, h('small', null, sub)));
  const el = h('div', { class: 'menu' },
    h('h1', null, '🚂 Orașe pe Șine'),
    h('p', null, 'Leagă orașele cu trenuri și ajută-le să crească!'),
    hasSave ? h('div', { class: 'rowb' }, h('button', { class: 'opt go', onclick: onContinue }, '▶️ Continuă jocul')) : null,
    h('p', null, 'Joc nou: alege anul'),
    h('div', { class: 'rowb' }, yb),
    h('p', null, 'și harta:'),
    h('div', { class: 'rowb' }, size('S', 'Hartă mică', '6–8 orașe'), size('M', 'Hartă medie', '8–11 orașe'), size('L', 'Hartă mare', '10–14 orașe')),
    h('div', { class: 'rowb' }, h('button', { class: 'opt', onclick: onHome }, '🏠 La meniu')));
  root.append(el);
  return { close() { el.remove(); } };
}
