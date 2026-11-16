// Interfața de joc: bara de sus (bani, dată, viteză), bara de unelte, opțiuni, mesaj scurt.
import { h } from '../../../../shared/ui/dom.js';
import { BIG_COST } from '../sim/terminal.js';
import { STATION_NAMES, STATION_COST, availableModels, CAR_PRICE } from '../sim/consts.js';
import { CAR_SETS, CAR_TYPES } from '../sim/goods.js';

export const TOOLS = [
  { id: 'track', e: '🛤️', t: 'Șină', hint: 'Trage cu degetul de la un oraș la altul ca să desenezi șina.' },
  { id: 'station', e: '🚉', t: 'Gară', hint: 'Atinge un loc lângă un oraș ca să pui o gară.' },
  { id: 'train', e: '🚂', t: 'Tren', hint: 'Alege un tren, apoi atinge gara de plecare și gara de sosire.' },
  { id: 'demolish', e: '🧹', t: 'Demolare', hint: 'Atinge o șină sau o gară ca să o ștergi.' },
  { id: 'info', e: 'ℹ️', t: 'Info', hint: 'Atinge un oraș, o gară sau un tren ca să afli mai multe.' },
];
/** Unelte fără buton în bară: se aleg din catalog sau din opțiunile uneltei Șină. */
const EXTRA = [
  { id: 'parallel', hint: 'Atinge începutul și sfârșitul unei șine: o dublez cu o a doua șină, la o placă distanță.' },
  { id: 'upgrade', hint: 'Alege o îmbunătățire, apoi atinge gara care o primește.' },
];
/** Butoane care deschid panouri (nu sunt unelte). */
const PANELS = [{ id: 'planner', e: '🧭', t: 'Planificator' }, { id: 'catalog', e: '📋', t: 'Catalog' }, { id: 'trains', e: '🚆', t: 'Trenuri' }];
const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const lei = (n) => (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' lei';

export function createHud(root, ev) {
  const money = h('div'), date = h('div'), info = h('div', { class: 'chip two' }, money, date);
  const goal = h('button', { class: 'chip goal hidden', 'aria-label': 'Obiective', onclick: () => ev.goals() });
  const speeds = [[0, '⏸'], [1, '1×'], [2, '2×'], [4, '4×']].map(([v, t]) => h('button', { class: 'rb', 'aria-label': 'Viteză ' + t, onclick: () => ev.speed(v) }, t));
  const layerBtn = h('button', { class: 'rb', title: 'Mărfuri', 'aria-label': 'Mărfuri', onclick: () => ev.layer() }, '📦');
  const islBtn = h('button', { class: 'rb hidden', title: 'Insulele: resurse, porturi, clasament', 'aria-label': 'Insulele', onclick: () => ev.islands() }, '🗺️');
  const bankBtn = h('button', { class: 'rb hidden', title: 'Banca: împrumut și rambursare automată', 'aria-label': 'Banca', onclick: () => ev.bank() }, '🏦');
  const exBtn = h('button', { class: 'rb hidden', title: 'Mod expert: finanțe, bursă, raport', 'aria-label': 'Mod expert', onclick: () => ev.expert() }, '💼');
  const todoBtn = h('button', { class: 'rb todo', title: 'De făcut', 'aria-label': 'De făcut', onclick: () => ev.todo() }, '📌');
  const menuBtn = h('button', { class: 'rb', title: 'Meniu', 'aria-label': 'Meniu', onclick: () => ev.menu() }, '☰');
  const bar = h('div', { class: 'tbar' }, info, goal, h('div', { class: 'sp' }), speeds,
    layerBtn, islBtn, bankBtn, exBtn, todoBtn,
    h('button', { class: 'rb', title: 'Ziarul', 'aria-label': 'Ziarul', onclick: () => ev.news() }, '📰'),
    menuBtn);
  const hint = h('div', { class: 'hint hidden' });
  const sub = h('div', { class: 'sub' });
  const tools = TOOLS.map((t) => h('button', { class: 'tool', 'aria-label': t.t, onclick: () => ev.tool(t.id) }, h('span', { class: 'e' }, t.e), t.t));
  const panelBtns = PANELS.map((t) => h('button', { class: 'tool', 'aria-label': t.t, onclick: () => ev[t.id]() }, h('span', { class: 'e' }, t.e), t.t));
  const toolbar = h('div', { class: 'toolbar' }, tools, panelBtns);
  root.append(bar, hint, sub, toolbar);

  let hintTimer = 0, lastMoney = null;
  const api = {
    el: [bar, hint, sub, toolbar],
    /** Elemente pe care tutorialul le evidențiază. */
    btn: { track: tools[0], station: tools[1], train: tools[2], money: info, menu: menuBtn, todo: todoBtn },
    /** Numărul de lucruri de făcut, pe butonul 📌. */
    setTodo(n) { todoBtn.dataset.n = n ? String(n) : ''; todoBtn.classList.toggle('has', n > 0); },
    /** Chip de obiectiv (doar în scenarii): text sau null. */
    setGoal(text) { goal.classList.toggle('hidden', !text); if (text) goal.textContent = text; },
    setMoney(c, sandbox) {
      if (c === lastMoney) return;
      lastMoney = c;
      money.textContent = '💰 ' + (sandbox ? '∞' : lei(c));
      money.classList.toggle('bad', c < 0);
    },
    setExpert(on) { exBtn.classList.toggle('hidden', !on); },
    setIslands(on) { islBtn.classList.toggle('hidden', !on); bankBtn.classList.toggle('hidden', !on); },
    setLayer(on) { layerBtn.classList.toggle('on', on); },
    setDate(d) { date.textContent = `📅 ${MONTHS[d.m - 1]} ${d.y}`; },
    setSpeed(v) { speeds.forEach((b, i) => b.classList.toggle('on', [0, 1, 2, 4][i] === v)); },
    setTool(id) {
      tools.forEach((b, i) => b.classList.toggle('on', TOOLS[i].id === id));
      api.hint([...TOOLS, ...EXTRA].find((t) => t.id === id).hint, false, 6000);
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
    stationOpts(size, onPick, onTurn) {
      const opts = STATION_NAMES.map((n, i) => ({ label: i === 2 ? 'Terminal mare' : n, small: lei(i === 2 ? BIG_COST : STATION_COST[i]), on: size === i, fn: () => onPick(i) }));
      if (size === 2 && onTurn) opts.push({ label: '🔄 Rotește', small: 'curtea (R)', fn: onTurn });
      api.setSub(opts);
    },
    trainOpts(model, cars, year, onModel, onCars) {
      const price = (m, set) => m.price + (set < 0 ? 4 : CAR_SETS[set].length) * CAR_PRICE;
      const ms = availableModels(year).map((m) => ({ label: m.name, small: lei(price(m, cars)), on: model === m.id, fn: () => onModel(m.id) }));
      const cs = [{ label: '🤖 Vagoane potrivite', small: 'după marfa gărilor', cls: 'car', on: cars < 0, fn: () => onCars(-1) }, ...CAR_SETS.map((set, i) => ({ label: i ? CAR_TYPES[set[0]].icon + ' ' + CAR_TYPES[set[0]].name : '👥✉️ Pasageri', cls: 'car', on: cars === i, fn: () => onCars(i) }))];
      api.setSub([...ms, ...cs]);
    },
  };
  return api;
}
