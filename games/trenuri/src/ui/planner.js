// „Planificatorul de rută”: panou fix (ca asistentul de cumpărare) cu 6 pași: ce cere orașul → de unde aduc → traseul și șina → câte vagoane →
// mai vrea cineva marfa → rezumat și „Fă tot”. Calculele sunt în sim/planner.js; comenzile pleacă prin env.exec (applyCommand) din plannerRun.js.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';
import { viewer } from '../sim/viewer.js';
import { buildPlan } from '../sim/planner.js';
import { ERR_TEXT } from '../sim/commands.js';
import { pickCity, whatCityWants, pickSource, routeStep, wagonStep } from './plannerView.js';
import { othersStep, summaryStep } from './plannerEnd.js';
import { drawPlan } from './plannerMap.js';
import { runPlan } from './plannerRun.js';

const TITLES = ['Ce cere', 'De unde aduc', 'Traseul', 'Vagoane', 'Alți clienți', 'Rezumat'];
const STEPS = [pickCity, whatCityWants, pickSource, routeStep, wagonStep, othersStep, summaryStep];

/** preset: { city, g? } din panoul orașului · { industry, g } din panoul industriei · nimic = alegi orașul. env: { root, state(), tools, hud, exec(cmd), marks, overlay(), show(x,y), onClose() }. */
export function openPlanner(env, preset = {}) {
  const S = () => env.state(), co = () => viewer.co;
  const start = preset.industry ? 2 : preset.city ? (preset.g >= 2 ? 2 : 1) : 0;
  let p = { step: start, entry: start, g: preset.g >= 2 ? preset.g : -1, dst: preset.city || null, src: preset.industry || null, mode: preset.industry ? 'from' : 'to', stops: [], track: 'none', model: null, manual: false, looked: false, queue: [], result: null, snap: null };
  let min = false, closed = false, cache = {}, memo = null, framed = '';
  const dock = h('div', { class: 'asst pl' });
  env.root.append(dock);
  const cash = () => { const q = S().companies[co()] || S().companies[0]; return S().sandbox ? 1e9 : q.cash; };
  const req = () => ({ g: p.g, owner: co(), stops: p.stops, cash: cash(), year: S().date.y, model: p.model === null ? undefined : p.model, cache });
  const ctx = {
    get s() { return S(); }, get p() { return p; }, co: co(), get cash() { return cash(); }, get sandbox() { return !!S().sandbox; }, get cache() { return cache; }, env, req,
    errText: (k) => ERR_TEXT[k] || 'nu se poate',
    plan() { if (p.result && p.result.ok && p.snap) return p.snap; return memo || (memo = buildPlan(S(), req())); },
    set(patch, step) { p = { ...p, ...patch, result: null, snap: null }; if (step !== undefined) p.step = step; if (patch.stops || patch.model !== undefined) cache = {}; draw(); },
    go(n) { p = { ...p, step: n, result: null, snap: null, manual: n === 3 ? p.manual : false }; if (n >= 3 && p.manual === false) pickOn(); draw(); },
    manual() {
      p = { ...p, manual: true }; env.tools.setTool('track');
      env.hud.hint('Trage șina de la 1 la 2. Numerele sunt pe hartă.', false, 6000); draw();
    },
    recheck() {
      cache = {}; memo = null;
      if (ctx.plan().legs.every((l) => l.link)) { p = { ...p, manual: false, step: 4 }; pickOn(); env.hud.hint('Șina e legată. Mergem mai departe!', false, 3500); }
      else env.hud.hint('Încă nu e șină legată între numerele de pe hartă. Trage-o de la 1 la 2.', true, 4500);
      draw();
    },
    /** Pasul „întâi adu materia g la fabrica o”: planul curent rămâne în coadă și se reia după ce termini lanțul. */
    chain(g, o) {
      const back = { ...p, queue: [], step: 2, result: null, snap: null };
      p = { ...p, queue: [...p.queue, back], g, dst: o, src: null, mode: 'to', stops: [], track: 'none', model: null, manual: false, looked: false, entry: 2, step: 2, result: null, snap: null };
      cache = {}; env.hud.hint(`Mai întâi ${o.name} are nevoie de ${GOODS[g].name.toLowerCase()}. După ce o rezolvi, te întorci la plan.`, false, 6000); draw();
    },
    newTrain(o) {
      p = { ...p, queue: [...p.queue, { ...p, queue: [], step: 6 }] };
      p = { ...p, dst: o, stops: [p.stops[0], o], step: 3, track: 'none', manual: false, looked: false, model: null, result: null, snap: null };
      cache = {}; env.hud.hint(`Planul pentru primul oraș rămâne deoparte. Acum: ${o.name}.`, false, 5000); draw();
    },
    run() {
      if (p.busy) return;
      const plan = ctx.plan(), done = (r) => {
        cache = {}; memo = null;
        p = { ...p, busy: false, result: r, snap: r.ok ? plan : null };
        if (r.ok) env.hud.hint('Gata! Trenul tău pleacă.', false, 5000);
        if (!closed) draw();
      };
      const r = runPlan(plan, env.execWait || env.exec); // în rețea: promisiune, până confirmă gazda
      if (r && typeof r.then === 'function') { p = { ...p, busy: true, result: null }; draw(); r.then(done); } else done(r);
    },
    finish() {
      if (p.queue.length) { const [next, ...rest] = p.queue; p = { ...next, queue: rest, result: null, snap: null, entry: p.entry }; cache = {}; memo = null; draw(); } else api.close();
    },
  };
  const pickOn = () => { if (!p.manual && env.tools.state.tool !== 'train') env.tools.setTool('train'); };

  function draw() {
    if (closed) return;
    memo = null;
    const old = dock.querySelector('.asst-body'), top = old ? old.scrollTop : 0;
    const back = p.step > p.entry ? h('button', { class: 'rb', 'aria-label': 'Înapoi', onclick: () => ctx.go(p.step - 1) }, '◀') : null;
    let body = null;
    if (!min) { try { body = STEPS[p.step](ctx); } catch (e) { body = [h('div', { class: 'note pl-warn' }, 'Ceva n-a mers la calcul: ' + e.message)]; } }
    dock.classList.toggle('min', min);
    dock.replaceChildren(...[
      h('div', { class: 'wz-head' }, back, h('h3', null, p.step ? `🧭 Planificator · pasul ${p.step}/6` : '🧭 Planificator'),
        h('button', { class: 'rb', 'aria-label': min ? 'Arată' : 'Ascunde', onclick: () => { min = !min; draw(); } }, min ? '▴' : '▾'),
        h('button', { class: 'rb', 'aria-label': 'Închide planificatorul', onclick: () => api.close() }, '✖')),
      min ? null : h('div', { class: 'wz-steps' }, TITLES.map((t, i) => h('span', { class: i + 1 === p.step ? 'on' : i + 1 < p.step ? 'ok' : '' }, `${i + 1} ${t}`))),
      min ? h('div', { class: 'note' }, 'Planificatorul e ascuns. Planul rămâne.') : h('div', { class: 'asst-body' }, body)].filter(Boolean));
    const b = dock.querySelector('.asst-body');
    if (b) b.scrollTop = top;
    let pl = null;
    if (p.step >= 3 && p.stops.length >= 2) { try { pl = ctx.plan(); } catch (e) { pl = null; } }
    drawPlan(env, pl);
    const key = pl && p.step === 3 ? p.stops.map((o) => o.name).join('>') : '';
    if (key && key !== framed && env.frame) {
      const q = pl.stops.filter((x) => x.spot), cx = (Math.min(...q.map((x) => x.spot.x)) + Math.max(...q.map((x) => x.spot.x))) >> 1, cy = (Math.min(...q.map((x) => x.spot.y)) + Math.max(...q.map((x) => x.spot.y))) >> 1;
      env.frame(cx, cy, Math.max(34, Math.min(70, pl.len * 2.4)));
    }
    if (p.step !== 3) framed = ''; else framed = key;
  }
  const api = {
    isOpen: () => !closed, state: () => p,
    resume() { min = false; pickOn(); draw(); },
    tap() { env.hud.hint('Folosește butoanele din panoul 🧭.', true, 2500); return true; },
    update() {},
    close() {
      if (closed) return;
      closed = true; dock.remove(); env.marks.clear(); if (env.overlay()) env.overlay().clear();
      if (env.tools.state.tool === 'train' || p.manual) env.tools.setTool('track');
      env.onClose();
    },
    ctx,
  };
  draw();
  return api;
}
