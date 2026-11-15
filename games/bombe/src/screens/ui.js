// Ajutoare pentru ecranele DOM (suprapuse peste canvas).
import { h, show } from '../../../../shared/ui/dom.js';
import { drawAvatar } from '../../../../shared/engine/profiles.js';

export const btn = (label, onclick, cls = '') => h('button', { class: 'big ' + cls, onclick }, label);

/** Ecran (overlay + card) adăugat în #ui; întoarce { el, card, show(on) }. */
export function makeScreen(children = []) {
  const card = h('div', { class: 'card' }, children);
  const el = h('div', { class: 'ov hidden' }, card);
  document.getElementById('ui').appendChild(el);
  return { el, card, show: (on = true) => show(el, on) };
}

/** Un rând de opțiuni: eticheta + butoane; `cur` = valoarea aleasă. */
export function optRow(label, options, cur, onPick) {
  return h('div', { class: 'row' }, h('span', { class: 'lab' }, label),
    options.map(([v, text]) => btn(text, () => onPick(v), 'opt sm' + (v === cur ? ' on' : ''))));
}

/** Card cu avatarul și numele unui jucător. */
export function playerCard(p, cls = '', extra = null) {
  const cv = h('canvas', { width: 112, height: 112, style: { width: '56px', height: '56px' } });
  drawAvatar(cv.getContext('2d'), p.avatar, 56, 56, 52, p.color);
  return h('div', { class: 'pl ' + cls }, cv, h('b', null, p.name), extra);
}
