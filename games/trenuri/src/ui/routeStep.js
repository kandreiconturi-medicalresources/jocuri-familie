// Pasul „Ruta” al asistentului: gările alese (cu numere ca pe hartă, reordonare, ștergere), descărcarea la fiecare oprire
// și lista tuturor gărilor tale (nume, oraș, distanță, ce au sau ce cer, „📍” ca să vezi locul fără să pierzi selecția).
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';
import { viewer } from '../sim/viewer.js';
import { assistReduce, dropOf, buyCommand, stationRows } from './assistState.js';
import { lei } from './hud.js';
import { dropControls } from './dropRow.js';

const icons = (l) => l.map((g) => GOODS[g].icon).join('');

/** edit (opțional): { cmd, label, note, drops } — editorul rutei unui tren existent; altfel pasul „Ruta” al cumpărării. */
export function routeStep({ env, a: get, upd, buy, pickOn, price, cash, tools, edit }) {
  const a = get(), s = env.state(), co = viewer.co, cmd = edit ? edit.cmd : buyCommand(a), freight = edit ? edit.drops : a.type === 'freight' && a.good >= 0;
  const toggle = (id) => upd(assistReduce(a, { t: 'toggle', id }));
  const stName = (id) => (s.stations.find((q) => q.id === id) || { name: '?' }).name;
  const cost = edit ? 0 : price(), poor = cost > cash();

  const chosen = a.stops.map((x, i) => h('div', { class: 'stop-card' },
    h('div', { class: 'srow on' }, h('span', { class: 'num' }, String(i + 1)), h('b', { class: 'sname' }, stName(x.id)),
      h('button', { class: 'rb', 'aria-label': 'Mai sus', disabled: i === 0, onclick: () => upd(assistReduce(a, { t: 'move', i, d: -1 })) }, '▲'),
      h('button', { class: 'rb', 'aria-label': 'Mai jos', disabled: i === a.stops.length - 1, onclick: () => upd(assistReduce(a, { t: 'move', i, d: 1 })) }, '▼'),
      h('button', { class: 'rb', 'aria-label': 'Scoate', onclick: () => upd(assistReduce(a, { t: 'remove', i })) }, '✖')),
    freight && (edit || i > 0) ? dropControls(dropOf(a, i), (drop) => upd(assistReduce(a, { t: 'drop', i, drop })) ) : null));

  const rows = stationRows(s, a, co).map((r) => {
    const tags = [r.has ? `📤 are ${GOODS[a.good].icon}` : null, r.wants || r.cityAsks ? `📥 cere ${GOODS[a.good].icon}` : null,
      a.good < 0 && r.gives.length ? `📤 ${icons(r.gives)}` : null, a.good < 0 && r.asks.length ? `📥 ${icons(r.asks)}` : null].filter(Boolean).join(' · ');
    return h('div', { class: 'srow' + (r.sel ? ' on' : '') },
      h('button', { class: 'sbtn' + (r.sel ? ' on' : ''), 'aria-label': r.sel ? 'Scoate din rută' : 'Adaugă la rută', onclick: () => toggle(r.st.id) }, r.sel ? String(r.sel) : '＋'),
      h('div', { class: 'sinfo', onclick: () => toggle(r.st.id) }, h('b', null, r.st.name), h('small', null, [r.city, r.d !== null ? r.d + ' plăci' : null, tags].filter(Boolean).join(' · '))),
      h('button', { class: 'rb', 'aria-label': 'Arată pe hartă', title: 'Arată pe hartă (selecția rămâne)', onclick: () => env.show(r.st.x, r.st.y) }, '📍'));
  });

  const onMap = tools.state.tool === 'train';
  return [
    edit ? h('div', { class: 'note' }, edit.note) : null,
    h('div', { class: 'note' }, 'Atinge gările pe hartă (poți face zoom, mișca harta sau deschide Info) sau alege din listă. Selecția rămâne cât timp asistentul e deschis.'),
    h('div', { class: 'btns' },
      h('button', { class: 'opt' + (onMap ? ' on' : ''), onclick: () => { pickOn(); upd(a); } }, onMap ? '👆 Aleg pe hartă' : '👆 Alege pe hartă', h('small', null, onMap ? 'Atinge o gară' : 'Acum e altă unealtă')),
      h('button', { class: 'opt', disabled: !a.stops.length, onclick: () => upd(assistReduce(a, { t: 'clear' })) }, '🧹 Șterge ruta')),
    h('div', null, h('b', null, a.stops.length ? 'Ruta ta' : 'Ruta ta: nicio gară încă')),
    chosen.length ? chosen : h('div', { class: 'note' }, 'Alege cel puțin două gări. Cu marfă poți adăuga mai multe orașe: la fiecare oprire alegi cât se descarcă.'),
    h('button', { class: 'opt go', disabled: !cmd || poor, onclick: () => buy(cmd) }, edit ? edit.label : `🚂 Cumpără trenul · ${lei(cost)}`, !cmd ? h('small', null, 'Alege cel puțin două gări diferite') : poor ? h('small', null, 'Nu ai destui bani') : null),
    h('div', null, h('b', null, 'Gările tale')),
    rows.length ? h('div', { class: 'slist' }, rows) : h('div', { class: 'note' }, 'Nu ai nicio gară încă. Pune gări lângă orașe sau industrii cu unealta 🚉.'),
  ];
}
