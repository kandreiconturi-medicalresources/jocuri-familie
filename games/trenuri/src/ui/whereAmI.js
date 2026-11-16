// „Unde am rămas”: se deschide când atingi conductorul. Obiectivul curent (scenariu) sau un scop liber, progres, ultimii pași
// (ținuți aici, în UI, nu în simulare), ce să faci acum (sfaturi după cererile orașelor și industriilor) și butoane „Arată-mi”.
import { h } from '../../../../shared/ui/dom.js';
import { evaluate, scenarioById, MEDAL_ICONS, computeTodos } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { timeLeft } from './goalsPanel.js';

const LOG = [], MAX = 8;
const WHAT = {
  buildTrack: '🛤️ Ai pus șină', buildStation: '🚉 Ai construit o gară', buyTrain: '🚂 Ai cumpărat un tren', buildUpgrade: '🔧 Ai făcut o îmbunătățire',
  sellTrain: '💸 Ai vândut un tren', setRoute: '🧭 Ai schimbat ruta unui tren', removeStation: '🧹 Ai demolat o gară', removeTrack: '🧹 Ai demolat șină',
  placeSignal: '🚦 Ai pus un semnal', buildDepot: '🏭 Ai construit un depou', levelTerrain: '⛰️ Ai nivelat terenul', upgradeStation: '🚉 Ai mărit o gară',
};

/** Notează un pas reușit (apelat din game.js după fiecare comandă ok). Pașii la fel, unul după altul, se adună: „×3”. */
export function logStep(cmd, date) {
  const text = WHAT[cmd && cmd.type];
  if (!text) return;
  const last = LOG[0];
  if (last && last.text === text) { last.n++; return; }
  LOG.unshift({ text, n: 1, d: date ? `${date.m}/${date.y}` : '' });
  if (LOG.length > MAX) LOG.pop();
}
export const clearSteps = () => { LOG.length = 0; };

const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Pași de început, când nu cere nimic altceva: [{ icon, text, go?, action? }]. */
function basics(s) {
  const mine = s.stations.filter((q) => q.owner === viewer.co), out = [];
  const big = s.cities.slice().sort((a, b) => b.pop - a.pop);
  if (!mine.length) out.push({ icon: '🚉', text: 'Pune o gară lângă un oraș mare.', go: big[0] });
  else if (mine.length === 1) out.push({ icon: '🚉', text: 'Pune a doua gară, într-un alt oraș.', go: big.find((c) => Math.max(Math.abs(c.x - mine[0].x), Math.abs(c.y - mine[0].y)) > 6) || big[1] });
  else if (!s.track.some((v) => v)) out.push({ icon: '🛤️', text: 'Leagă gările cu șină: trage cu degetul de la una la alta.', go: mine[0] });
  else if (!s.trains.some((t) => t.owner === viewer.co)) out.push({ icon: '🚂', text: 'Cumpără un tren și alege-i gările.', action: 'buy' });
  return out;
}

export function openWhereAmI(card, s, ev) {
  const { open, row } = card, sc = s.scn ? scenarioById(s.scn.id) : null, ev2 = sc ? evaluate(s, sc) : null;
  const todos = computeTodos(s, viewer.co).slice(0, 5);
  const showBtn = (it) => h('button', { class: 'opt', onclick: () => { card.close(); ev.show(it.x, it.y); } }, '📍 Arată-mi');
  const head = sc
    ? [h('h3', null, '🧭 Unde am rămas'), h('div', { class: 'wh-goal' }, `${sc.icon} ${sc.name}`), row('Medalia ta', ev2.medal ? MEDAL_ICONS[ev2.medal] : 'încă nu'), row('Timp rămas', timeLeft(s)),
      ev2.goals.map((g) => h('div', { class: 'news' }, h('b', null, g.goal.text), h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (100 * g.value) / g.goal.t[Math.min(2, g.tier)]) + '%' } })), `${num(g.value)} din ${num(g.goal.t[Math.min(2, g.tier)])} ${g.tier ? MEDAL_ICONS[g.tier] : ''}`))]
    : [h('h3', null, '🧭 Unde am rămas'), h('div', { class: 'wh-goal' }, s.sandbox ? '🏗️ Construiești liber' : '🎯 Scopul tău: câștigă bani și fă orașele să crească'), row('Trenuri', s.trains.length), row('Gări', s.stations.length)];
  const todo = [...basics(s).map((b) => ({ icon: b.icon, text: b.text, x: b.go ? b.go.x : 0, y: b.go ? b.go.y : 0, go: !!b.go, action: b.action })),
    ...todos.map((t) => ({ icon: t.icon, text: t.text, x: t.x, y: t.y, go: true }))];
  open(...head,
    ev.plan ? h('button', { class: 'opt go', onclick: () => { card.close(); ev.plan(); } }, '🧭 Ajută-mă să fac o rută bună') : null,
    h('div', null, h('b', null, 'Ce să faci acum')),
    todo.length ? todo.map((t) => h('div', { class: 'news wh-do' }, h('span', null, t.icon + ' ' + t.text), t.go ? showBtn(t) : null,
      t.action === 'buy' ? h('button', { class: 'opt go', onclick: () => { card.close(); ev.buy(); } }, '🚂 Cumpără tren') : null))
      : h('div', { class: 'news' }, '👍 Totul merge bine. Încearcă o marfă nouă sau o gară mai mare!'),
    h('div', null, h('b', null, 'Ultimii pași')),
    LOG.length ? LOG.map((l) => h('div', { class: 'row' }, h('span', null, l.text + (l.n > 1 ? ' ×' + l.n : '')), h('small', null, l.d))) : h('div', { class: 'news' }, 'Încă nimic. Să începem!'),
    ev.last ? h('div', { class: 'news' }, '💬 Ultimul sfat: ' + ev.last) : null);
}
