// Panoul trenului: de ce stă gol, pauză, fiabilitate și atelier, încărcătură, mod Automat/Manual.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS, WORKSHOP } from '../sim/consts.js';
import { GOODS, CAR_TYPES, CAR_OF, NG } from '../sim/goods.js';
import { capacity, carried } from '../sim/cargo.js';
import { trainAdvice } from '../sim/advice.js';
import { waitReason } from '../sim/smartRoute.js';
import { relOf, ageMonths } from '../sim/wear.js';
import { lei } from './hud.js';
import { trainKind } from './trainKind.js';
import { dropControls } from './dropRow.js';
import { carsEditor } from './carsEditor.js';

/** Mărfurile pe care le poate duce un tren (după vagoanele lui). */
export const carriable = (t) => GOODS.map((_, g) => g).filter((g) => t.kinds.includes(CAR_OF[g]));
export const ageText = (m) => (m < 12 ? `${m} luni` : `${(m / 12) | 0} ani${m % 12 ? ` și ${m % 12} luni` : ''}`);

export function createTrainPanel(card, ev) {
  const { open, close, row, goodRow } = card;

  function orderRows(s, t, again) {
    if (!t.orders) return h('button', { class: 'opt', onclick: () => { ev.orders(t.id, t.route.map(() => ({ load: carriable(t), unload: null }))); again(); } }, '🤖 Mod: Automat', h('small', null, 'Atinge ca să alegi tu ce încarcă'));
    return [
      h('button', { class: 'opt on', onclick: () => { ev.orders(t.id, null); again(); } }, '🛠️ Mod: Manual', h('small', null, 'Atinge ca să revii la Automat')),
      ...t.route.map((id, i) => h('div', { class: 'stop' }, h('div', null, `${i + 1}. ` + (s.stations.find((q) => q.id === id) || { name: '?' }).name + ' — încarcă:'),
        h('div', { class: 'chips' }, carriable(t).map((g) => {
          const on = t.orders[i] && t.orders[i].load && t.orders[i].load.includes(g);
          return h('button', { class: 'gchip btn' + (on ? ' on' : ''), style: { background: GOODS[g].color }, title: GOODS[g].name, onclick: () => {
            const o = t.orders.map((x) => ({ load: x.load ? x.load.slice() : [], unload: x.unload, drop: x.drop })), l = o[i].load, k = l.indexOf(g);
            if (k >= 0) l.splice(k, 1); else l.push(g);
            ev.orders(t.id, o); again();
          } }, GOODS[g].icon);
        })),
        t.kinds.some((k) => k >= 2) ? [h('div', null, 'Descarcă:'), dropControls(t.orders[i] ? t.orders[i].drop : null, (drop) => {
          ev.orders(t.id, t.orders.map((x, k) => ({ load: x.load, unload: x.unload, drop: k === i ? drop : x.drop }))); again();
        }, true)] : null)),
    ];
  }

  /** Butonul „trece pe la atelier”: pune în rută gara cu atelier cea mai apropiată (sau o scoate). */
  function shopRow(s, t, again) {
    const shops = s.stations.filter((st) => st.owner === t.owner && st.up[WORKSHOP]);
    if (!shops.length) return h('div', { class: 'note' }, '🔧 Atelierul repară trenurile. Construiește-l la o gară: 📋 Catalog → Îmbunătățiri.');
    const inRoute = shops.find((st) => t.route.includes(st.id));
    if (inRoute) return h('button', { class: 'opt', onclick: () => { ev.route(t.id, t.route.filter((id) => id !== inRoute.id)); again(); } }, `🔧 Trece pe la ${inRoute.name} ✅`, h('small', null, 'Atinge ca să-l scoți din rută'));
    const here = s.stations.find((q) => q.id === t.to) || s.stations.find((q) => q.id === t.route[0]);
    const best = shops.slice().sort((a, b) => Math.max(Math.abs(a.x - here.x), Math.abs(a.y - here.y)) - Math.max(Math.abs(b.x - here.x), Math.abs(b.y - here.y)))[0];
    return h('button', { class: 'opt', disabled: t.route.length >= 8, onclick: () => { const r = t.route.slice(); r.splice(Math.max(0, t.at) + 1, 0, best.id); ev.route(t.id, r); again(); } }, `🔧 Trece pe la atelier (${best.name})`, h('small', null, 'Trenul oprește acolo și e reparat'));
  }

  /** Depou: „Trimite remorcă” la un tren defect, „Trimite la depou” la reparat. */
  function depotRows(s, t, again) {
    if (t.tow || t.state === 3) return null;
    if (t.dead) return h('div', null,
      s.depots.some((d) => d.owner === t.owner) ? h('button', { class: 'opt go', disabled: !!t.resc, onclick: () => { ev.rescue(t.id); again(); } }, t.resc ? '🚑 Remorca vine' : '🚑 Trimite remorcă', h('small', null, 'Pleacă de la cel mai apropiat depou')) : null,
      h('button', { class: 'opt', onclick: () => { ev.lift(t.id); again(); } }, '🏗️ Ridică de pe linie', h('small', null, 'Macaraua îl scoate pe loc (1500 lei): la depou, sau repară pe loc în câteva zile')));
    if (!s.depots.some((d) => d.owner === t.owner)) return h('div', { class: 'note' }, '🏭 Depoul repară trenurile uzate. Construiește-l la capătul unei linii: 🧰 Mai mult → Depou.');
    return h('button', { class: 'opt', disabled: !!t.toDepot, onclick: () => { ev.depot(t.id); again(); } }, t.toDepot ? '🏭 Merge la depou' : '🏭 Trimite la depou', h('small', null, 'Se repară, apoi își reia ruta'));
  }

  return function train(s, t) {
    const m = MODELS[t.model], cap = capacity(t), again = () => setTimeout(() => train(s, t), 120);
    const names = t.route.map((id) => (s.stations.find((q) => q.id === id) || { name: '?' }).name).join(' ⇄ ');
    const dest = s.stations.find((q) => q.id === t.to), why = trainAdvice(s, t), rel = relOf(t);
    const loadRows = [];
    for (let g = 0; g < NG; g++) if (carried(t, g)) loadRows.push(goodRow(g, carried(t, g)));
    open(h('h3', null, `Trenul ${t.id}`), h('div', { class: 'kind' }, trainKind(s, t).full), h('div', null, `${m.name} · ${t.cars} vagoane: ` + t.kinds.map((k) => CAR_TYPES[k].icon).join('')), h('div', null, names),
      why.length ? h('div', { class: 'why' }, why.map((l) => h('div', null, l))) : null,
      waitReason(s, t) ? h('div', { class: 'why' }, waitReason(s, t)) : null,
      h('div', { class: 'btns' },
        h('button', { class: 'opt' + (t.paused ? ' on' : ''), onclick: () => { ev.pause(t.id, !t.paused); again(); } }, t.paused ? '▶ Continuă' : '⏸ Pauză', h('small', null, t.paused ? 'Pleacă iar' : 'Oprește la gară')),
        h('button', { class: 'opt no', onclick: () => { ev.sell(t.id); close(); } }, 'Vinde trenul')),
      ev.editRoute ? h('button', { class: 'opt go', onclick: () => { close(); ev.editRoute(t.id); } }, '🗺️ Schimbă ruta', h('small', null, 'Alege altă rută pentru acest tren')) : null,
      row('Merge spre', dest ? dest.name : '—'), row('Viteză', `${m.vmax * 4} km/h`), row('Trage bine', `${m.power} vagoane`),
      row('Fiabilitate', `${rel}% (nou: ${m.rel}%)`), row('Vârstă', ageText(ageMonths(s, t))), row('Întreținere', lei(m.maint) + '/lună'),
      t.cars > m.power ? h('div', null, '⚠️ Are prea multe vagoane pentru locomotivă, așa că merge mai încet.') : null,
      t.state === 3 || t.tow ? null : carsEditor(s, t, (kinds) => { ev.cars(t.id, kinds); again(); }),
      depotRows(s, t, again),
      shopRow(s, t, again),
      h('div', null, h('b', null, 'Încărcătură')), loadRows.length ? loadRows : h('div', null, 'Gol deocamdată.'),
      row('Locuri', cap.map((c, k) => (c ? CAR_TYPES[k].icon + c : '')).join(' ')), row('A câștigat', lei(t.money)),
      orderRows(s, t, again));
  };
}
