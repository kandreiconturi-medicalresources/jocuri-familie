// Obiectivele scenariului: cardul de început și cardul de progres (cu timpul rămas) + textul scurt din bara de sus.
import { h } from '../../../../shared/ui/dom.js';
import { evaluate, MEDAL_ICONS } from '../sim/index.js';

const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tiers = (g) => g.t.map((v, i) => MEDAL_ICONS[i + 1] + num(v)).join('  ');

/** Timpul rămas: „2 ani și 3 luni”. */
export function timeLeft(s) {
  const m = Math.max(0, (s.scn.end - s.date.y) * 12 - (s.date.m - 1));
  const y = (m / 12) | 0, r = m % 12;
  return [y ? `${y} ${y === 1 ? 'an' : 'ani'}` : '', r ? `${r} ${r === 1 ? 'lună' : 'luni'}` : ''].filter(Boolean).join(' și ') || 'ultima lună';
}

/** Textul din bara de sus: primul obiectiv încă neîmplinit, cu următoarea țintă. */
export function goalChip(s, sc) {
  const ev = evaluate(s, sc), g = ev.goals.find((q) => q.tier < 3) || ev.goals[0];
  return `🎯 ${num(g.value)}/${num(g.goal.t[Math.min(2, g.tier)])}`;
}

export function createGoals(card) {
  const { open, row } = card;
  return {
    intro(sc, onGo) {
      open(h('h3', null, `${sc.icon} ${sc.name}`), h('div', null, sc.story),
        h('div', null, h('b', null, 'Ce ai de făcut')),
        sc.goals.map((g) => h('div', { class: 'news' }, g.text, h('br'), tiers(g))),
        row('Termen', `${sc.years} ani (${sc.year}–${sc.year + sc.years})`), h('div', null, '💡 ' + sc.tip),
        h('div', { class: 'btns' }, h('button', { class: 'opt go', onclick: () => { card.close(); if (onGo) onGo(); } }, '▶️ Să începem!')));
    },
    progress(s, sc) {
      const ev = evaluate(s, sc);
      open(h('h3', null, `🎯 ${sc.name}`), row('Medalia ta', ev.medal ? MEDAL_ICONS[ev.medal] : 'încă nu'), row('Timp rămas', timeLeft(s)),
        ev.goals.map((g) => h('div', { class: 'news' }, h('b', null, g.goal.text), h('br'), `Acum: ${num(g.value)} ${g.tier ? MEDAL_ICONS[g.tier] : ''}`, h('br'), tiers(g.goal))),
        h('div', null, '💡 ' + sc.tip));
    },
  };
}
