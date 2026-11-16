// Alegerea descărcării la o oprire: Tot · După cerere · X vagoane · X% · Nimic (și „Automat” = regula veche, în panoul trenului).
import { h } from '../../../../shared/ui/dom.js';
import { MAX_CARS } from '../sim/consts.js';
import { DROP_MODES, DROP_TEXT } from '../sim/drops.js';

const HELP = {
  demand: 'Lasă cât cere orașul (sau fabrica) și duce restul mai departe.', all: 'Descarcă tot și trenul rămâne gol.', none: 'Doar trece pe aici (poate încărca).',
  cars: 'Descarcă marfa din atâtea vagoane, restul merge mai departe.', pct: 'Descarcă partea asta din marfă, restul merge mai departe.', auto: 'Descarcă dacă gara cere marfa, altfel duce mai departe.',
};

/** d = { m, v? } curent (null = Automat), set(drop|null) îl schimbă, auto = arată și chip-ul „Automat”. */
export function dropControls(d, set, auto = false) {
  const m = d ? d.m : 'auto';
  const pick = (k) => set(k === 'auto' ? null : k === 'cars' ? { m: k, v: 1 } : k === 'pct' ? { m: k, v: 50 } : { m: k });
  const step = (dv) => { const lim = m === 'cars' ? [1, MAX_CARS] : [10, 100]; set({ m, v: Math.max(lim[0], Math.min(lim[1], d.v + dv)) }); };
  return h('div', { class: 'drop' },
    h('div', { class: 'chips' }, [...(auto ? ['auto'] : []), ...DROP_MODES].map((k) => h('button', { class: 'dchip' + (m === k ? ' on' : ''), onclick: () => pick(k) }, k === 'auto' ? 'Automat' : DROP_TEXT[k]))),
    m === 'cars' || m === 'pct' ? h('span', { class: 'stepper' }, h('button', { class: 'opt', onclick: () => step(m === 'cars' ? -1 : -10) }, '−'), h('b', null, m === 'cars' ? `${d.v} vagoane` : `${d.v}%`), h('button', { class: 'opt', onclick: () => step(m === 'cars' ? 1 : 10) }, '+')) : null,
    h('small', null, HELP[m]));
}
