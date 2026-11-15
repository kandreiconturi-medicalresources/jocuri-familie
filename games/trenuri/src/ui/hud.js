// Interfața de joc: bara de sus (bani, dată, viteză), bara de unelte, opțiuni, mesaj scurt.
import { h } from '../../../../shared/ui/dom.js';
import { STATION_NAMES, STATION_COST, availableModels, CAR_PRICE } from '../sim/consts.js';
import { CAR_SETS, CAR_TYPES } from '../sim/goods.js';

export const TOOLS = [
  { id: 'track', e: '🛤️', t: 'Șină', hint: 'Trage cu degetul de la un oraș la altul ca să desenezi șina.' },
  { id: 'station', e: '🚉', t: 'Gară', hint: 'Atinge un loc lângă un oraș ca să pui o gară.' },
  { id: 'train', e: '🚂', t: 'Tren', hint: 'Alege un tren, apoi atinge gara de plecare și gara de sosire.' },
  { id: 'demolish', e: '🧹', t: 'Demolare', hint: 'Atinge o șină sau o gară ca să o ștergi.' },
  { id: 'info', e: 'ℹ️', t: 'Info', hint: 'Atinge un oraș, o gară sau un tren ca să afli mai multe.' },
];
const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const lei = (n) => (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' lei';

export function createHud(root, ev) {
  const money = h('div'), date = h('div'), info = h('div', { class: 'chip two' }, money, date);
  const goal = h('button', { class: 'chip goal hidden', 'aria-label': 'Obiective', onclick: () => ev.goals() });
  const speeds = [[0, '⏸'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, t]) => h('button', { class: 'rb', 'aria-label': 'Viteză ' + t, onclick: () => ev.speed(v) }, t));
  const layerBtn = h('button', { class: 'rb', title: 'Mărfuri', 'aria-label': 'Mărfuri', onclick: () => ev.layer() }, '📦');
  const menuBtn = h('button', { class: 'rb', title: 'Meniu', 'aria-label': 'Meniu', onclick: () => ev.menu() }, '☰');
  const bar = h('div', { class: 'tbar' }, info, goal, h('div', { class: 'sp' }), speeds,
    layerBtn,
    h('button', { class: 'rb', title: 'Ziarul', 'aria-label': 'Ziarul', onclick: () => ev.news() }, '📰'),
    menuBtn);
  const hint = h('div', { class: 'hint hidden' });
  const sub = h('div', { class: 'sub' });
  const tools = TOOLS.map((t) => h('button', { class: 'tool', 'aria-label': t.t, onclick: () => ev.tool(t.id) }, h('span', { class: 'e' }, t.e), t.t));
  const toolbar = h('div', { class: 'toolbar' }, tools);
  root.append(bar, hint, sub, toolbar);

  let hintTimer = 0, lastMoney = null;
  const api = {
    el: [bar, hint, sub, toolbar],
    /** Elemente pe care tutorialul le evidențiază. */
    btn: { track: tools[0], station: tools[1], train: tools[2], money: info, menu: menuBtn },
    /** Chip de obiectiv (doar în scenarii): text sau null. */
    setGoal(text) { goal.classList.toggle('hidden', !text); if (text) goal.textContent = text; },
    setMoney(c, sandbox) {
      if (c === lastMoney) return;
      lastMoney = c;
      money.textContent = '💰 ' + (sandbox ? '∞' : lei(c));
      money.classList.toggle('bad', c < 0);
    },
    setLayer(on) { layerBtn.classList.toggle('on', on); },
    setDate(d) { date.textContent = `📅 ${MONTHS[d.m - 1]} ${d.y}`; },
    setSpeed(v) { speeds.forEach((b, i) => b.classList.toggle('on', [0, 1, 2, 4][i] === v)); },
    setTool(id) {
      tools.forEach((b, i) => b.classList.toggle('on', TOOLS[i].id === id));
      api.hint(TOOLS.find((t) => t.id === id).hint, false, 6000);
    },
    hint(text, warn = false, ms = 3500) {
      hint.textContent = text; hint.classList.remove('hidden'); hint.classList.toggle('warn', !!warn);
      clearTimeout(hintTimer);
      if (ms) hintTimer = setTimeout(() => hint.classList.add('hidden'), ms);
    },
    /** Opțiuni sub unealtă: [{ label, small, on, cls, fn }] */
    setSub(items) {
      sub.replaceChildren(...items.map((o) => h('button', { class: 'opt ' + (o.on ? 'on ' : '') + (o.cls || ''), onclick: o.fn }, o.label, o.small ? h('small', null, o.small) : null)));
    },
    stationOpts(size, onPick) {
      api.setSub(STATION_NAMES.map((n, i) => ({ label: n, small: lei(STATION_COST[i]), on: size === i, fn: () => onPick(i) })));
    },
    trainOpts(model, cars, year, onModel, onCars) {
      const price = (m, set) => m.price + CAR_SETS[set].length * CAR_PRICE;
      const ms = availableModels(year).map((m) => ({ label: m.name, small: lei(price(m, cars)), on: model === m.id, fn: () => onModel(m.id) }));
      const cs = CAR_SETS.map((set, i) => ({ label: i ? CAR_TYPES[set[0]].icon + ' ' + CAR_TYPES[set[0]].name : '👥✉️ Pasageri', cls: 'car', on: cars === i, fn: () => onCars(i) }));
      api.setSub([...ms, ...cs]);
    },
  };
  return api;
}
