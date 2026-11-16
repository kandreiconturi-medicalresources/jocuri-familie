// Asistentul de cumpărare a trenului, pas cu pas, cu iconițe mari: 1 ce transporți, 2 ce marfă (cu sursa și destinația propuse),
// 3 locomotiva, 4 vagoanele (previzualizare), 5 ruta (gări alese pe hartă sau din listă). E un panou fix, nu un card:
// harta rămâne vie (zoom, mutare, Info), iar selecția gărilor trăiește în starea pură din assistState.js.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS, CAR_PRICE } from '../sim/consts.js';
import { GOODS, CAR_TYPES, CAR_OF, INDUSTRIES, NG, wantOf } from '../sim/goods.js';
import { nearestSource, suggestKinds } from '../sim/advice.js';
import { near } from '../sim/industry.js';
import { viewer } from '../sim/viewer.js';
import { lei } from './hud.js';
import { trainPreview } from './trainPreview.js';
import { newAssist, assistReduce, pruneStops, kindsOf } from './assistState.js';
import { routeStep } from './routeStep.js';

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
export const nm = (o) => (o.type !== undefined ? INDUSTRIES[o.type].icon : '🏙️') + ' ' + o.name;

export function big(icon, title, sub, { on, dis, click, extra } = {}) {
  return h('button', { class: 'wz-card' + (on ? ' on' : '') + (dis ? ' dis' : ''), 'aria-disabled': dis ? 'true' : null, onclick: () => { if (!dis) click(); } },
    h('span', { class: 'wz-i' }, icon), h('span', { class: 'wz-t' }, h('b', null, title), h('small', null, sub), extra || null));
}

/**
 * env: { root, state(), tools, hud, exec(cmd), marks, onClose() } · preset: { good, stops, model }.
 * Întoarce { resume, close, update, tap, isOpen, state }. Camera nu se mișcă singură; „📍” de pe rânduri o mută doar la cerere.
 */
export function openBuyWizard(env, preset) {
  const { tools, hud } = env, S = () => env.state(), co = () => viewer.co;
  let a = newAssist({ model: tools.state.model, ...(preset || {}) }), min = false, closed = false, last = '';
  const dock = h('div', { class: 'asst' });
  env.root.append(dock);
  const steps = ['Ce transporți', 'Ce marfă', 'Locomotiva', 'Vagoanele', 'Ruta'];
  const set = (v) => { a = assistReduce(a, { t: 'set', v }); };
  const next = (n) => { a = assistReduce(a, { t: 'step', step: n }); if (n === 5) pickOn(); draw(); };
  const pickOn = () => { if (tools.state.tool !== 'train') tools.setTool('train'); hud.hint('Atinge gările pe hartă, în ordinea rutei. Poți face zoom și mișca harta.', false, 5000); };
  const cash = () => { const c = S().companies[co()] || S().companies[0]; return S().sandbox ? Infinity : c.cash; };

  const s1 = () => [
    big('👥', 'Pasageri', 'Oamenii merg între orașe. Bun pentru început.', { click: () => { set({ type: 'pass', good: -1, cars: 0 }); next(3); } }),
    big('✉️', 'Poștă', 'Scrisori și colete. Vagonul de poștă merge cu pasagerii.', { click: () => { set({ type: 'mail', good: -1, cars: 0 }); next(3); } }),
    big('📦', 'Marfă', 'Cărbune, cereale, oțel, combustibil… Plătește mai bine.', { click: () => { set({ type: 'freight' }); next(2); } }),
  ];
  const s2 = () => {
    const s = S(), out = [];
    const order = Array.from({ length: NG - 2 }, (_, i) => i + 2).map((g) => [g, proposal(s, g)]).sort((x, y) => !!y[1] - !!x[1]);
    for (const [g, p] of order) {
      const sub = p ? `${nm(p.src)} ➜ ${nm(p.dst)} · ${p.d} plăci` : 'Nu avem sursă sau cumpărător pe hartă.';
      const need = p ? (!p.stSrc ? '🚉 Pune o gară lângă ' + p.src.name : !p.stDst ? '🚉 Pune o gară lângă ' + p.dst.name : '✅ Gările există') : null;
      out.push(big(GOODS[g].icon, GOODS[g].name, sub, { dis: !p, on: a.good === g, extra: need ? h('small', { class: 'wz-n' }, need) : null, click: () => { set({ good: g, cars: CAR_OF[g] - 1 }); next(3); } }));
    }
    return out;
  };
  const s3 = () => MODELS.map((m) => {
    const fut = m.year > S().date.y;
    return big('🚂', m.name, `${m.vmax * 4} km/h · trage ${m.power} vagoane · fiabilitate ${m.rel}%`, { dis: fut, on: a.model === m.id, extra: h('small', { class: 'wz-n' }, fut ? `Apare în anul ${m.year}` : lei(m.price) + (m.price > cash() ? ' (nu ai destui bani)' : '')), click: () => { set({ model: m.id }); tools.state.model = m.id; next(4); } });
  });
  const s4 = () => {
    const m = MODELS[a.model], fk = a.good >= 0 ? CAR_OF[a.good] : 0, kinds = kindsOf(a) || (a.type === 'freight' ? [fk, fk, fk] : [0, 0, 1]);
    const same = a.good >= 0 && a.cars === fk - 1, bump = (d) => () => { a = assistReduce(a, { t: 'cars', n: a.n + d }); draw(); };
    const opts = a.type === 'freight' ? [[-1, '🤖 Potrivite rutei', 'După marfa din gări'], ...(a.good >= 0 ? [[fk - 1, CAR_TYPES[fk].icon + ' ' + CAR_TYPES[fk].name, 'Toate vagoanele de același fel']] : [])] : [[0, '👥✉️ Pasageri și poștă', 'Două de pasageri, unul de poștă']];
    return [
      h('div', { class: 'btns' }, opts.map(([c, t, sub]) => h('button', { class: 'opt' + (a.cars === c ? ' on' : ''), onclick: () => { set({ cars: c }); draw(); } }, t, h('small', null, sub))),
        h('button', { class: 'opt' + (a.full ? ' on' : ''), onclick: () => { set({ full: !a.full }); draw(); } }, a.full ? '📦 Pline' : '⬜ Goale', h('small', null, 'Atinge ca să vezi'))),
      same ? h('div', { class: 'row' }, h('span', null, 'Câte vagoane'), h('span', { class: 'stepper' }, h('button', { class: 'opt', onclick: bump(-1) }, '−'), h('b', null, a.n), h('button', { class: 'opt', onclick: bump(1) }, '+'))) : null,
      same ? h('div', { class: 'note' }, 'Cu mai multe vagoane poți lăsa marfă în mai multe orașe, dacă vrei.') : null,
      trainPreview(m, kinds, a.good, a.full),
      kinds.length > m.power ? h('div', { class: 'note' }, `⚠️ ${m.name} trage bine doar ${m.power} vagoane: cu ${kinds.length} merge mai încet.`) : null,
      h('button', { class: 'opt go', onclick: () => next(5) }, '🛤️ Alege ruta'),
    ];
  };
  const stepFns = [s1, s2, s3, s4, () => routeStep({ env, a: () => a, upd: (x) => { a = x; draw(); }, buy, pickOn, price, cash, tools })];

  function price() {
    const m = MODELS[a.model], k = kindsOf(a) || (a.stops.length > 1 ? suggestKinds(S(), a.stops.map((x) => x.id), m.power) : [0, 0, 1]);
    return m.price + k.length * CAR_PRICE;
  }
  function buy(cmd) {
    const r = env.exec(cmd);
    if (!r.ok) return;
    hud.hint(`Trenul tău pleacă!${r.cost ? ' A costat ' + lei(r.cost) + '.' : ''}`, false, 5000);
    api.close();
  }
  /** Marcajele de pe hartă urmează selecția. */
  function sync() {
    const pts = a.stops.map((x) => S().stations.find((q) => q.id === x.id)).filter(Boolean);
    env.marks.set(pts.map((q) => ({ x: q.x, y: q.y })));
  }
  function draw() {
    if (closed) return;
    a = pruneStops(a, S(), co());
    const old = dock.querySelector('.asst-body'), top = old ? old.scrollTop : 0;
    const back = a.step > 1 ? h('button', { class: 'rb', 'aria-label': 'Înapoi', onclick: () => next(a.type !== 'freight' && a.step === 3 ? 1 : a.step - 1) }, '◀') : null;
    dock.classList.toggle('min', min);
    dock.replaceChildren(...[
      h('div', { class: 'wz-head' }, back, h('h3', null, `🚂 Tren nou · pasul ${a.step}/5`),
        h('button', { class: 'rb', 'aria-label': min ? 'Arată' : 'Ascunde', onclick: () => { min = !min; draw(); } }, min ? '▴' : '▾'),
        h('button', { class: 'rb', 'aria-label': 'Închide asistentul', onclick: () => api.close() }, '✖')),
      min ? h('div', { class: 'note' }, a.stops.length ? `Gări alese: ${a.stops.length}. Selecția rămâne cât timp asistentul e deschis.` : 'Asistentul e ascuns.') : null,
      min ? null : h('div', { class: 'wz-steps' }, steps.map((t, i) => h('span', { class: i + 1 === a.step ? 'on' : i + 1 < a.step ? 'ok' : '' }, t))),
      min ? null : h('div', { class: 'asst-body' }, stepFns[a.step - 1]())].filter(Boolean));
    const b = dock.querySelector('.asst-body');
    if (b) b.scrollTop = top;
    last = tools.state.tool; sync();
  }
  const api = {
    isOpen: () => !closed, state: () => a,
    /** Apăsarea pe 🚂 cât asistentul e deschis: îl arată iar și reia alegerea pe hartă, cu selecția intactă. */
    resume() { min = false; if (a.step === 5) pickOn(); draw(); },
    /** Atingere pe hartă (cu unealta Tren). Întoarce true dacă a fost folosită. */
    tap(t) {
      if (closed) return false;
      const st = S().stations.find((q) => q.x === t.x && q.y === t.y && q.owner === co());
      if (a.step < 5) { hud.hint('Mai întâi alege ce transporți, marfa și locomotiva, apoi gările.', true, 3500); return true; }
      if (!st) { hud.hint('Atinge o gară (🚉) ca s-o adaugi la rută; atinge-o iar ca s-o scoți.', true, 3500); return true; }
      a = assistReduce(a, { t: 'toggle', id: st.id }); draw();
      return true;
    },
    /** Periodic: dacă s-a schimbat unealta (de pildă Info), reîmprospătează butonul „Alege pe hartă”. */
    update() { if (!closed && tools.state.tool !== last) draw(); },
    close() {
      if (closed) return;
      closed = true; dock.remove(); env.marks.clear();
      if (tools.state.tool === 'train') tools.setTool('track');
      env.onClose();
    },
  };
  draw();
  return api;
}
