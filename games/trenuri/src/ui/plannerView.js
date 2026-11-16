// Pașii planificatorului: 0 alege orașul · 1 ce cere · 2 de unde aduc · 3 traseul și șina · 4 câte vagoane. (5 și 6: plannerEnd.js)
// Fiecare pas întoarce o listă de noduri DOM. `c` = { s, p, plan(), cash, co, cache, set(patch, step), go(n), env, errText }.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS, INDUSTRIES, CAR_TYPES, CAR_OF } from '../sim/goods.js';
import { availableModels } from '../sim/consts.js';
import { rankOptions, cityLack, cityRequests, isCity } from '../sim/planner.js';
import { lei } from './hud.js';
import { cityCards } from './plannerCards.js';
import { kindsText } from './plannerMap.js';
import { trainPreview } from './trainPreview.js';

export const icon = (o) => (isCity(o) ? '🏙️' : INDUSTRIES[o.type].icon);
export const nm = (o) => icon(o) + ' ' + o.name;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export const money = (n) => (n < 0 ? '−' : '~') + lei(Math.abs(Math.round(n / 100) * 100)); // cifre rotunde
const low = (g) => GOODS[g].name.toLowerCase();
export const line = (icon_, text, cls) => h('div', { class: 'pl-line' + (cls ? ' ' + cls : '') }, h('span', null, icon_), h('span', null, text));
export const nextBtn = (c, text, to, dis) => h('button', { class: 'opt go pl-next', disabled: dis || null, onclick: () => c.go(to) }, text);

/** Pasul 0: ce oraș vrei să ajuți (cele care lipsesc cel mai mult sunt primele). */
export function pickCity(c) {
  const list = c.s.cities.filter((q) => cityLack(c.s, q) > 0).sort((a, b) => cityLack(c.s, b) - cityLack(c.s, a) || a.id - b.id).slice(0, 6);
  return [h('div', { class: 'note' }, 'Alege orașul căruia vrei să-i aduci marfă. Primele au cea mai mare nevoie.'),
    ...list.map((q) => h('button', { class: 'wz-card', onclick: () => c.set({ dst: q, src: null, mode: 'to', stops: [] }, 1) },
      h('span', { class: 'wz-i' }, '🏙️'), h('span', { class: 'wz-t' }, h('b', null, q.name), h('small', null, cityRequests(c.s, q).filter((r) => r.got < r.want).map((r) => `${GOODS[r.g].icon} ${Math.round(r.want - r.got)} t`).join(' · ') || 'Nu-i lipsește nimic'))))];
}

/** Pasul 1: ce cere orașul. */
export function whatCityWants(c) {
  const { p, s } = c;
  return [h('div', { class: 'note' }, `🏙️ ${p.dst.name} cere aceste mărfuri. Atinge „De unde aduc?” la cea pe care vrei s-o aduci.`),
    ...cityCards(s, p.dst, (g) => c.set({ g, src: null, stops: [], track: 'none', model: null, manual: false, looked: false }, 2))];
}

const railText = (e) => (e.linked ? '✅ șina e deja pusă' : e.rail === 'station' ? '🚉 are deja gară' : e.rail === 'track' ? '🛤️ șină aproape' : '⛔ fără șină');

/** Pasul 2: de unde aduc (sau unde duc), cea mai bună alegere prima. */
export function pickSource(c) {
  const { p, s } = c, to = p.mode === 'to', fixed = to ? p.dst : p.src;
  const list = rankOptions(s, { fixed, mode: p.mode, g: p.g, owner: c.co, cash: c.cash, year: s.date.y, cache: c.cache });
  const head = to ? `De unde aduci ${GOODS[p.g].icon} ${low(p.g)} pentru ${p.dst.name}?` : `Unde duci ${GOODS[p.g].icon} ${low(p.g)} de la ${p.src.name}?`;
  if (!list.length) return [h('div', { class: 'note' }, head), h('div', { class: 'note' }, to ? `Pe hartă nu produce nimeni ${low(p.g)}.` : `Nimeni nu cere ${low(p.g)} acum.`)];
  const fresh = { track: 'none', model: null, manual: false, looked: false };
  return [h('div', { class: 'note' }, head + ' Prima e cea mai bună alegere.'), ...list.map((e, i) => {
    const pick = () => c.set(to ? { ...fresh, src: e.o, stops: [e.o, p.dst] } : { ...fresh, dst: e.o, stops: [p.src, e.o] }, 3);
    return h('div', { class: 'pl-opt' + (i === 0 ? ' best' : '') },
      i === 0 ? h('div', { class: 'pl-star' }, '⭐ Recomandat', h('small', null, cap(e.why) + '.')) : null,
      h('div', { class: 'pl-row' }, h('span', { class: 'pl-big' }, icon(e.o)),
        h('div', { class: 'pl-txt' }, h('b', null, e.o.name), h('span', null, `📏 ${e.d} plăci`),
          to ? h('span', null, e.prod ? `📦 face ~${e.prod} t/lună` : '😴 acum nu face nimic (îi lipsesc materiile)') : h('span', null, `📥 cere ~${e.want} t/lună`),
          h('span', null, railText(e)), h('span', null, `🏗️ construcție ${e.cost ? money(e.cost) : '0 lei'}`), h('span', null, `💰 profit ${money(e.profit)}/lună`))),
      h('div', { class: 'btns' }, h('button', { class: 'opt go', onclick: pick }, 'Aleg asta'), h('button', { class: 'opt', onclick: () => c.env.show(e.o.x, e.o.y) }, '📍 Arată')));
  })];
}

/** Pasul 3: traseul de la 1 la 2, șina existentă sau nouă, gările. */
export function routeStep(c) {
  const { p } = c, plan = c.plan(), out = [];
  out.push(h('div', { class: 'pl-title' }, plan.stops.map((x, i) => `${i + 1} ${nm(x.o)}`).join(' ➜ ')), line('📏', `${plan.len} plăci în total`));
  plan.stops.forEach((x, i) => out.push(x.st ? line('🚉', `${i + 1}: ${x.st.name} există deja`, 'ok')
    : line('🚉', x.spot ? `${i + 1}: pun ${['o haltă', 'o gară', 'un terminal'][x.size]} lângă ${x.o.name} (${money(x.cost)})` : `${i + 1}: nu găsesc loc de gară lângă ${x.o.name}`, x.spot ? '' : 'bad')));
  const miss = plan.legs.some((l) => !l.link);
  plan.legs.forEach((l, i) => {
    if (l.link) {
      const on = plan.stops.filter((x) => x.st && l.link.some(([a, b]) => a === x.st.x && b === x.st.y)).length;
      out.push(line('✅', `${i + 1}➜${i + 2}: există șină (${l.link.length - 1} plăci${on ? ', prin gările tale' : ', drum direct'})`, 'ok'));
    } else out.push(line('❌', `${i + 1}➜${i + 2}: nu există șină` + (l.err ? ' · ' + c.errText(l.err) : ` · ${money(l.cost)}`), 'bad'));
  });
  if (!miss) return [...out, nextBtn(c, 'Bine, mai departe ➜ Câte vagoane?', 4)];
  if (p.manual) return [...out, h('div', { class: 'note' }, '✏️ Trage șina cu unealta 🛤️ de la 1 la 2 (numerele de pe hartă). Când ai terminat, apasă „Verifică”.'),
    h('div', { class: 'btns' }, h('button', { class: 'opt go', onclick: () => c.recheck() }, '✅ Am terminat, verifică'), h('button', { class: 'opt', onclick: () => c.set({ manual: false, track: 'none' }, 3) }, '↩ Înapoi la plan'))];
  const can = plan.legs.every((l) => l.link || !l.err) && plan.stops.every((x) => x.spot);
  if (!can) out.push(h('div', { class: 'note' }, 'Nu găsesc cum să trag șina singur. Încearcă „Fac eu” sau alege altă sursă.'));
  if (p.track === 'auto' && can) {
    const k = kindsText(plan);
    out.push(h('div', { class: 'pl-sum' }, h('b', null, `🤖 Șina automată: ${money(plan.build.track)}`), h('small', null, k.length ? k.join(' · ') : 'teren ușor, fără poduri'),
      h('small', null, 'Plăcile galbene de pe hartă sunt șina nouă, cele verzi există deja.')), nextBtn(c, 'Confirm traseul ➜ Câte vagoane?', 4));
    out.push(h('button', { class: 'opt', onclick: () => c.set({ track: 'none' }, 3) }, '↩ Altă variantă'));
  } else out.push(h('div', { class: 'btns' },
    h('button', { class: 'opt go', disabled: can ? null : true, onclick: () => c.set({ track: 'auto' }, 3) }, `🤖 Construiește automat (${money(plan.build.track)})`),
    h('button', { class: 'opt', onclick: () => c.manual() }, '✏️ Fac eu')));
  return out;
}

/** Pasul 4: câte vagoane. */
export function wagonStep(c) {
  const { p } = c, pl = c.plan(), m = pl.model, nd = pl.nd, car = CAR_TYPES[CAR_OF[p.g]], out = [];
  if (!pl.flow) out.push(h('div', { class: 'note pl-warn' }, pl.prod ? 'Orașul nu cere marfa asta acum.' : `${nm(pl.stops[0].o)} nu produce acum. Fără marfă, trenul merge gol.`));
  out.push(h('div', { class: 'pl-big-text' }, `Ca să duci ~${pl.flow} t/lună pe ${pl.len} plăci, ai nevoie de `, h('b', null, `${nd.cars} ${nd.cars === 1 ? 'vagon' : 'vagoane'}`), ` cu locomotiva ${m.name} (o cursă la ~${nd.oneWayDays} zile).`));
  out.push(line(car.icon, `Vagoane de ${car.name.toLowerCase()}: câte ${nd.cap} t fiecare.`));
  if (nd.trains > 1) out.push(h('div', { class: 'note pl-warn' }, `⚠️ Un tren nu ajunge. Recomand ${nd.trains} trenuri, fiecare cu ${nd.carsPer} vagoane.`));
  if (pl.prod && pl.prod < pl.wants) out.push(line('ℹ️', `${pl.stops[0].o.name} face doar ~${pl.prod} t/lună, iar orașul vrea ~${pl.wants}. Duci atât cât se produce.`));
  out.push(trainPreview(m, pl.kinds, p.g, true));
  out.push(h('div', { class: 'pl-sub' }, 'Locomotiva (propusă: cea mai potrivită):'));
  out.push(h('div', { class: 'chips' }, availableModels(c.s.date.y).map((q) => h('button', { class: 'dchip' + (q.id === m.id ? ' on' : ''), onclick: () => c.set({ model: q.id }, 4) }, `${q.name} · ${money(q.price)}`))));
  out.push(nextBtn(c, 'Mai departe ➜ Mai vrea cineva marfa?', 5));
  return out;
}
