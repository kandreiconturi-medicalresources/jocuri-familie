// Lista tuturor trenurilor: stare, profit, vârstă, fiabilitate, pauză.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS } from '../sim/consts.js';
import { relOf, ageMonths } from '../sim/wear.js';
import { trainAdvice } from '../sim/advice.js';
import { viewer } from '../sim/viewer.js';
import { lei } from './hud.js';
import { trainKind } from './trainKind.js';
import { ageText } from './trainPanel.js';

export const stateOf = (t) => {
  if (t.paused) return t.state === 2 ? '⏸ În pauză' : '⏸ Se oprește la gară';
  if (t.route.length < 2) return '❗ Fără rută';
  if (t.lost) return '❗ Fără drum';
  if (t.broken > 0) return '🔧 Stricat';
  if (t.state === 2) return '🚉 În gară';
  return t.speed === 0 ? '🚦 Așteaptă' : '🚂 Merge';
};

export function openTrainList(card, s, ev) {
  const mine = s.trains.filter((t) => t.owner === viewer.co);
  const again = () => setTimeout(() => openTrainList(card, s, ev), 150);
  card.open(h('h3', null, '🚆 Trenurile mele'),
    mine.length ? mine.map((t) => {
      const rel = relOf(t), why = trainAdvice(s, t).filter((x) => !x.startsWith('⏸'));
      return h('div', { class: 'trow' },
        h('button', { class: 'tmain', onclick: () => ev.pick(t) },
          h('b', null, `${t.id} · ${trainKind(s, t).full}`), h('small', null, MODELS[t.model].name), h('span', null, stateOf(t)),
          h('small', null, `${t.money >= 0 ? '+' : ''}${lei(t.money)} · ${ageText(ageMonths(s, t))} · fiabilitate ${rel}%`, why.length ? ' · ' + why[0] : '')),
        h('button', { class: 'rb' + (t.paused ? ' on' : ''), 'aria-label': t.paused ? 'Continuă' : 'Pauză', onclick: () => { ev.pause(t.id, !t.paused); again(); } }, t.paused ? '▶' : '⏸'));
    }) : h('div', null, 'Nu ai niciun tren încă. Folosește 🚂 Tren ca să cumperi unul.'),
    h('div', { class: 'note' }, 'Depoul de apă umple locomotivele cu abur (merg mai repede). Atelierul repară trenurile.'));
}
