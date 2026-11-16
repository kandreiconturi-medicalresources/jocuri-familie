// Explicații prietenoase pentru modul expert: butonul ⓘ are tooltip (mouse) și, la atingere, arată textul într-o notă de jos.
import { h } from '../../../../shared/ui/dom.js';

export function createTips() {
  const note = h('div', { class: 'exnote' }, '💡 Atinge ⓘ ca să afli ce înseamnă fiecare lucru.');
  const tip = (text) => h('button', { class: 'tip', title: text, 'aria-label': text, onclick: (e) => { e.stopPropagation(); note.textContent = '💡 ' + text; } }, 'ⓘ');
  return { note, tip };
}

/** Rând cu etichetă, ⓘ și valoare. */
export const trow = (tip, label, text, val) => h('div', { class: 'row' }, h('span', null, label, ' ', text ? tip(text) : null), h('b', null, val));
