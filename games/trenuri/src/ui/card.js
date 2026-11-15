// Cardul mare de informații (un singur card deschis) și rânduri cu marfă colorată.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';

export function createCard(root) {
  let el = null;
  const close = () => { if (el) { el.remove(); el = null; } };
  const open = (...kids) => {
    if (el) el.remove();
    el = h('div', { class: 'card' }, h('button', { class: 'rb x', onclick: close, 'aria-label': 'Închide' }, '✖'), ...kids);
    root.append(el);
    return el;
  };
  const row = (a, b) => h('div', { class: 'row' }, h('span', null, a), h('b', null, b));
  /** Rând pentru o marfă: pătrat colorat + iconiță + nume. */
  const goodRow = (g, val, extra) => h('div', { class: 'row' }, h('span', null, h('i', { class: 'dot', style: { background: GOODS[g].color } }), GOODS[g].icon + ' ' + GOODS[g].name + (extra || '')), h('b', null, val));
  const chip = (g) => h('span', { class: 'gchip', style: { background: GOODS[g].color }, title: GOODS[g].name }, GOODS[g].icon);
  return { open, close, row, goodRow, chip, isOpen: () => !!el };
}
