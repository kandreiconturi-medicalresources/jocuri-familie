// Cumpărarea unui tren, pas cu pas, cu iconițe mari: 1 ce transporți, 2 ce marfă (cu sursa și destinația propuse),
// 3 locomotiva, 4 vagoanele (previzualizare). La final alegi ruta pe hartă (unealta Tren).
import { h } from '../../../../shared/ui/dom.js';
import { MODELS, CAR_PRICE } from '../sim/consts.js';
import { GOODS, CAR_TYPES, CAR_OF, CAR_SETS, INDUSTRIES, NG, wantOf } from '../sim/goods.js';
import { nearestSource } from '../sim/advice.js';
import { near } from '../sim/industry.js';
import { viewer } from '../sim/viewer.js';
import { lei } from './hud.js';
import { trainPreview } from './trainPreview.js';

/** Propunere pentru marfa g: cea mai apropiată pereche sursă → destinație { src, dst, d, stSrc, stDst } sau null. */
export function proposal(s, g) {
  const dsts = [...s.industries.filter((o) => INDUSTRIES[o.type].in.includes(g)), ...s.cities.filter((c) => wantOf(c, g) > 0)];
  let best = null;
  for (const dst of dsts) {
    const r = nearestSource(s, dst, g);
    if (r && (!best || r.d < best.d)) best = { src: r.o, dst, d: r.d };
  }
  if (!best) return null;
  const st = (o) => s.stations.find((q) => near(q, o));
  best.stSrc = st(best.src); best.stDst = st(best.dst);
  return best;
}
const nm = (o) => (o.type !== undefined ? INDUSTRIES[o.type].icon : '🏙️') + ' ' + o.name;

function big(icon, title, sub, { on, dis, click, extra } = {}) {
  return h('button', { class: 'wz-card' + (on ? ' on' : '') + (dis ? ' dis' : ''), 'aria-disabled': dis ? 'true' : null, onclick: () => { if (!dis) click(); } },
    h('span', { class: 'wz-i' }, icon), h('span', { class: 'wz-t' }, h('b', null, title), h('small', null, sub), extra || null));
}

export function openBuyWizard(card, s, tools, extras, hud) {
  const co = s.companies[viewer.co] || s.companies[0], cash = s.sandbox ? Infinity : co.cash;
  const w = { step: 1, type: 'pass', good: -1, model: tools.state.model, cars: -1, full: false };
  const steps = ['Ce transporți', 'Ce marfă', 'Locomotiva', 'Vagoanele'];
  const next = (n) => { w.step = n; draw(); };
  const kindsOf = () => (w.cars < 0 ? (w.good >= 0 ? [CAR_OF[w.good], CAR_OF[w.good], CAR_OF[w.good]] : [0, 0, 1]) : CAR_SETS[w.cars]);

  const s1 = () => [
    big('👥', 'Pasageri', 'Oamenii merg între orașe. Bun pentru început.', { click: () => { w.type = 'pass'; w.good = -1; w.cars = 0; next(3); } }),
    big('✉️', 'Poștă', 'Scrisori și colete. Vagonul de poștă merge cu pasagerii.', { click: () => { w.type = 'mail'; w.good = -1; w.cars = 0; next(3); } }),
    big('📦', 'Marfă', 'Cărbune, cereale, oțel, combustibil… Plătește mai bine.', { click: () => { w.type = 'freight'; next(2); } }),
  ];
  const s2 = () => {
    const out = [];
    const order = Array.from({ length: NG - 2 }, (_, i) => i + 2).map((g) => [g, proposal(s, g)]).sort((a, b) => !!b[1] - !!a[1]);
    for (const [g, p] of order) {
      const sub = p ? `${nm(p.src)} ➜ ${nm(p.dst)} · ${p.d} plăci` : 'Nu avem sursă sau cumpărător pe hartă.';
      const need = p ? (!p.stSrc ? '🚉 Pune o gară lângă ' + p.src.name : !p.stDst ? '🚉 Pune o gară lângă ' + p.dst.name : '✅ Gările există') : null;
      out.push(big(GOODS[g].icon, GOODS[g].name, sub, { dis: !p, on: w.good === g, extra: need ? h('small', { class: 'wz-n' }, need) : null, click: () => { w.good = g; w.cars = CAR_OF[g] - 1; next(3); } }));
    }
    return out;
  };
  const s3 = () => MODELS.map((m) => {
    const fut = m.year > s.date.y;
    return big('🚂', m.name, `${m.vmax * 4} km/h · trage ${m.power} vagoane · fiabilitate ${m.rel}%`, { dis: fut, on: w.model === m.id, extra: h('small', { class: 'wz-n' }, fut ? `Apare în anul ${m.year}` : lei(m.price) + (m.price > cash ? ' (nu ai destui bani)' : '')), click: () => { w.model = m.id; next(4); } });
  });
  const s4 = () => {
    const m = MODELS[w.model], kinds = kindsOf(), price = m.price + kinds.length * CAR_PRICE, p = w.good >= 0 ? proposal(s, w.good) : null;
    const fk = w.good >= 0 ? CAR_OF[w.good] : 0;
    const opts = w.type === 'freight' ? [[-1, '🤖 Potrivite rutei', 'După marfa din gări'], [fk - 1, CAR_TYPES[fk].icon + ' ' + CAR_TYPES[fk].name, 'Trei vagoane de același fel']] : [[0, '👥✉️ Pasageri și poștă', 'Două de pasageri, unul de poștă']];
    return [
      h('div', { class: 'btns' }, opts.map(([c, t, sub]) => h('button', { class: 'opt' + (w.cars === c ? ' on' : ''), onclick: () => { w.cars = c; draw(); } }, t, h('small', null, sub))),
        h('button', { class: 'opt' + (w.full ? ' on' : ''), onclick: () => { w.full = !w.full; draw(); } }, w.full ? '📦 Pline' : '⬜ Goale', h('small', null, 'Atinge ca să vezi'))),
      trainPreview(m, kinds, w.good, w.full),
      h('div', { class: 'row' }, h('span', null, 'Preț (locomotivă + vagoane)'), h('b', null, lei(price))),
      price > cash ? h('div', { class: 'note' }, `Îți mai trebuie ${lei(price - cash)}.`) : null,
      h('button', { class: 'opt go', disabled: price > cash, onclick: () => {
        card.close(); tools.choose({ tool: 'train', model: w.model, cars: w.cars });
        const a = p && p.stSrc, b = p && p.stDst;
        if (a) extras.show(a.x, a.y); else if (p) extras.show(p.src.x, p.src.y);
        hud.hint(a && b ? `Atinge gara de plecare (${a.name}), apoi gara de sosire (${b.name}).` : 'Atinge gara de plecare, apoi gara de sosire.', false, 7000);
      } }, '🛤️ Alege ruta pe hartă'),
    ];
  };
  const draw = () => {
    const body = [s1, s2, s3, s4][w.step - 1]();
    const back = w.step > 1 ? h('button', { class: 'rb', 'aria-label': 'Înapoi', onclick: () => next(w.type !== 'freight' && w.step === 3 ? 1 : w.step - 1) }, '◀') : null;
    const el = card.open(h('div', { class: 'wz-head' }, back, h('h3', null, `🚂 Tren nou · pasul ${w.step}/4`)),
      h('div', { class: 'wz-steps' }, steps.map((t, i) => h('span', { class: i + 1 === w.step ? 'on' : i + 1 < w.step ? 'ok' : '' }, t))), body);
    el.classList.add('wide', 'wz');
  };
  draw();
}
