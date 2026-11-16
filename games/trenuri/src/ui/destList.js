// Liste din panourile industriei și ale orașului: spre ce poate duce marfa (sortat după profit) și cine poate aproviziona.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS, INDUSTRIES } from '../sim/goods.js';
import { destinations, suppliers } from '../sim/routes.js';
import { near } from '../sim/industry.js';
import { viewer } from '../sim/viewer.js';

const RAIL = { station: '🚉 gară', track: '🛤️ șină aproape', none: '⛔ fără șină' };
const LEVEL = ['nu cere', 'cerere mică', 'cerere mare'];
export const nameOf = (o) => (o.type !== undefined ? INDUSTRIES[o.type].icon : '🏙️') + ' ' + o.name;

/** Presetul asistentului: marfa g de la src la dst, cu gările tale din apropiere (câte există). */
export function presetFor(s, g, src, dst) {
  const at = (o) => s.stations.find((q) => q.owner === viewer.co && (o.type === undefined ? Math.max(Math.abs(q.x - o.x), Math.abs(q.y - o.y)) <= 5 : near(q, o)));
  return { good: g, stops: [at(src), at(dst)].filter(Boolean).map((q) => q.id) };
}

function row(ev, o, g, line, d, perTon, rail, route) {
  return h('div', { class: 'drow' },
    h('div', { class: 'dinfo' }, h('b', null, nameOf(o)), h('small', null, line), h('small', null, `${d} plăci · ≈ ${perTon} lei/t · ${RAIL[rail]}`)),
    h('div', { class: 'dbtns' },
      ev.show ? h('button', { class: 'opt', onclick: () => ev.show(o.x, o.y) }, '📍 Arată') : null,
      ev.makeRoute ? h('button', { class: 'opt go', onclick: () => ev.makeRoute(route) }, '🚂 Fă o rută') : null));
}

/** „Spre ce poate duce marfa”: orașe și industrii, de la cel mai bun profit estimat. */
export function destSection(s, ev, src, g, max = 6) {
  const list = destinations(s, src, g, viewer.co).slice(0, max);
  if (!list.length) return h('div', { class: 'note' }, 'Pe hartă nu e nimeni care să ceară ' + GOODS[g].name.toLowerCase() + '.');
  return h('div', { class: 'dlist' }, list.map((e) => row(ev, e.o, g,
    e.kind === 'city' ? `${LEVEL[e.level]}${e.level ? ` · ${e.want}/lună` : ' (plătește doar un sfert)'}` : e.level ? `cere ${GOODS[g].name.toLowerCase()} (loc pentru ${e.want})` : 'stocul e plin',
    e.d, e.perTon, e.rail, presetFor(s, g, src, e.o))));
}

/** „Cine îl poate aproviza”: industriile care produc marfa g, de la cea mai apropiată. */
export function supplySection(s, ev, dst, g, max = 3) {
  const list = suppliers(s, dst, g, viewer.co).slice(0, max);
  if (!list.length) return h('div', { class: 'note' }, `Pe hartă nu produce nimeni ${GOODS[g].name.toLowerCase()}.`);
  return h('div', { class: 'dlist' }, list.map((e) => row(ev, e.o, g, 'produce ' + GOODS[g].name.toLowerCase(), e.d, e.perTon, e.rail, presetFor(s, g, e.o, dst))));
}
