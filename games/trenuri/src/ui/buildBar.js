// Bara de confirmare a construcției (7.8): titlu + preț, butoane mari „Construiește” și „Anulează” (Enter / Esc), opțional „Rotește”.
import { h } from '../../../../shared/ui/dom.js';

export function createBuildBar(root) {
  let el = null;
  const hide = () => { if (el) { el.remove(); el = null; } };
  /** { title, info, ok, label, onGo, onNo, onTurn? } — se poate chema din nou ca să se actualizeze. */
  function show(o) {
    hide();
    const go = h('button', { class: 'bb-go' + (o.ok ? '' : ' off'), type: 'button', disabled: o.ok ? null : 'disabled' }, o.label);
    go.addEventListener('click', (e) => { e.stopPropagation(); if (o.ok) o.onGo(); });
    const no = h('button', { class: 'bb-no', type: 'button' }, '❌ Anulează');
    no.addEventListener('click', (e) => { e.stopPropagation(); o.onNo(); });
    const turn = o.onTurn ? h('button', { class: 'bb-turn', type: 'button', title: 'Rotește (R)' }, '🔄') : null;
    if (turn) turn.addEventListener('click', (e) => { e.stopPropagation(); o.onTurn(); });
    el = h('div', { class: 'bb', role: 'dialog', 'aria-label': 'Confirmă construcția' },
      h('div', { class: 'bb-t' }, o.title, h('small', { class: o.ok ? '' : 'bad' }, o.info || '')),
      h('div', { class: 'bb-r' }, turn, go, no));
    root.append(el);
  }
  return { show, hide, isOpen: () => !!el };
}
