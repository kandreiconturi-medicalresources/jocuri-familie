// Panoul „De făcut”: lista lucrurilor noi de rezolvat, fiecare cu buton „Mergi acolo”.
import { h } from '../../../../shared/ui/dom.js';

export function openTodo(card, items, go) {
  card.open(h('h3', null, '📌 De făcut'),
    items.length ? items.map((it) => h('button', { class: 'opt todo-row', onclick: () => go(it) }, h('span', { class: 'ci' }, it.icon), h('span', { class: 'cn' }, it.text, h('small', null, 'Atinge ca să mergi acolo')))) : h('div', null, '✅ Nimic urgent! Construiește o linie nouă sau cumpără un tren.'),
    h('div', { class: 'note' }, 'Marcajele animate de pe hartă arată aceleași lucruri: atinge unul ca să mergi direct acolo.'));
}
