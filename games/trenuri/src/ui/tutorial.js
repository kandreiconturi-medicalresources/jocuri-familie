// Tutorial interactiv în 5 pași. Fiecare pas evidențiază butonul sau zona potrivită și avansează singur când e făcut.
import { h } from '../../../../shared/ui/dom.js';
import { T_PRESENT } from '../sim/consts.js';

/** Pașii: text, ce evidențiem (cheie în hud.btn sau 'map'), unealta aleasă și condiția de terminare. */
export const STEPS = [
  { text: 'Mută harta: trage cu degetul pe ecran. Cu două degete poți apropia și roti.', hi: 'map', tool: 'info', done: (c) => c.moved() },
  { text: 'Apasă 🛤️ Șină. Trage cu degetul de la un oraș la altul, apoi apasă „Construiește”.', hi: 'track', tool: 'track', done: (c) => c.rail() >= 6 },
  { text: 'Apasă 🚉 Gară și atinge câte un loc la fiecare capăt al șinei. Ai nevoie de 2 gări!', hi: 'station', tool: 'station', done: (c) => c.s().stations.length >= 2 },
  { text: 'Apasă 🚂 Tren. Atinge o gară, apoi cealaltă: acolo ajunge trenul.', hi: 'train', tool: 'train', done: (c) => c.s().trains.some((t) => t.route.length >= 2) },
  { text: 'Uite-l cum pleacă! Urmărește banii 💰: cresc când trenul duce oameni.', hi: 'money', tool: 'info', done: (c) => c.s().trains.some((t) => t.money > 0) || c.moneyTapped },
];

export function createTutorial({ root, hud, helper, camera, state, setTool, onDone, onSkip }) {
  let step = -1, base = null, acc = 0, glowEl = null;
  const ring = h('div', { class: 'tut-ring hidden' }, '👆');
  const skip = h('button', { class: 'opt tutskip hidden', onclick: () => api.stop(true) }, 'Sari peste ⏭');
  root.append(ring, skip);
  const ctx = {
    s: state, moneyTapped: false,
    moved: () => { const c = camera.cam; return Math.hypot(c.x - base.x, c.z - base.z) > 3 || Math.abs(c.yaw - base.yaw) > 0.25 || Math.abs(c.dist - base.dist) > 3; },
    rail: () => { const s = state(); let n = 0; for (let i = 0; i < s.track.length; i++) if (s.track[i] & T_PRESENT) n++; return n - s.stations.length; },
  };
  hud.btn.money.addEventListener('click', () => { ctx.moneyTapped = true; });
  function glow(el) { if (glowEl) glowEl.classList.remove('glow'); glowEl = el; if (el) el.classList.add('glow'); }
  function enter(i) {
    step = i;
    const c = camera.cam; base = { x: c.x, z: c.z, yaw: c.yaw, dist: c.dist };
    const st = STEPS[i];
    setTool(st.tool);
    glow(st.hi === 'map' ? null : hud.btn[st.hi]);
    ring.classList.toggle('hidden', st.hi !== 'map');
    helper.say(`${i + 1}/${STEPS.length} · ${st.text}`, { keep: true, force: true });
  }
  const api = {
    get active() { return step >= 0; },
    start() { skip.classList.remove('hidden'); helper.show(true); enter(0); },
    stop(skipped) {
      if (step < 0) return;
      step = -1; glow(null); ring.classList.add('hidden'); skip.classList.add('hidden'); helper.hide();
      if (skipped) onSkip(); else onDone();
    },
    /** De apelat în fiecare cadru, cu `dt` în secunde. */
    update(dt) {
      if (step < 0) return;
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      if (STEPS[step].done(ctx)) { if (step + 1 < STEPS.length) enter(step + 1); else { api.stop(false); helper.say('Bravo! Acum știi să construiești. Hai la treabă! 🎉', { force: true, ms: 7000 }); } }
    },
  };
  return api;
}
