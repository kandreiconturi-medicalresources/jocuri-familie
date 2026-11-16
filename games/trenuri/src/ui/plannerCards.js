// „Ce cere orașul”: un card mare pe marfă (iconiță, cerere pe lună, cât primește acum, bară) cu butonul „De unde aduc?”.
// Folosit și în panoul orașului, și în pasul 1 al planificatorului.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';
import { cityRequests } from '../sim/planner.js';

const round = (n) => (n >= 10 ? Math.round(n / 5) * 5 : n); // cifre rotunde pentru ochi neobișnuiți cu jocuri

/** Cardurile unui oraș: onPick(g) pornește planificatorul pentru marfa g. */
export function cityCards(s, c, onPick) {
  return cityRequests(s, c).map((r) => {
    const done = r.got >= r.want;
    return h('div', { class: 'pl-card' + (done ? ' ok' : '') },
      h('span', { class: 'pl-big' }, GOODS[r.g].icon),
      h('div', { class: 'pl-txt' },
        h('b', null, GOODS[r.g].name),
        h('span', null, `vrea ~${round(r.want)} t/lună`),
        h('span', null, `primește acum ${r.got} t` + (done ? ' ✅' : '')),
        h('div', { class: 'bar' }, h('i', { style: { width: r.pct + '%' } }))),
      onPick ? h('button', { class: 'opt go', onclick: () => onPick(r.g) }, '🧭 De unde aduc?') : null);
  });
}
