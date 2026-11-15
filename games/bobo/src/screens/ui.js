// Ajutoare pentru ecranele DOM (suprapuse peste canvas).
import { h, show } from '../../../../shared/ui/dom.js';

export const btn = (label, onclick, cls = '') => h('button', { class: 'big ' + cls, onclick }, label);

/** Creează un ecran (overlay + card) adăugat în #ui; întoarce { el, card, show(on) }. */
export function makeScreen(children = []) {
  const card = h('div', { class: 'card' }, children);
  const el = h('div', { class: 'ov hidden' }, card);
  document.getElementById('ui').appendChild(el);
  return { el, card, show: (on = true) => show(el, on) };
}

export const stars = (n, total = 3) => {
  const s = h('div', { class: 'bigstars' });
  for (let i = 0; i < total; i++) s.appendChild(h('span', { class: i < n ? '' : 'off' }, '★'));
  return s;
};
