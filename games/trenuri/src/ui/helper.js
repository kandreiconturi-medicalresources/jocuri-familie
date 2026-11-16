// „Ajutorul”: un conductor prietenos desenat în cod (SVG), care dă câte un sfat într-un balon. Sfaturile se pot opri din setări.
import { h } from '../../../../shared/ui/dom.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  kids.forEach((c) => e.appendChild(c));
  return e;
}

/** Conductorul: șapcă albastră cu insignă aurie, față rotundă, mustață, jachetă cu nasturi. */
export function drawConductor() {
  const o = '#3b2314';
  return svg('svg', { viewBox: '0 0 64 64', width: '100%', height: '100%', 'aria-hidden': 'true' },
    svg('path', { d: 'M8 64 Q10 44 32 42 Q54 44 56 64 Z', fill: '#2f6fd0', stroke: o, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    svg('circle', { cx: 32, cy: 52, r: 2.2, fill: '#ffd23f' }), svg('circle', { cx: 32, cy: 59, r: 2.2, fill: '#ffd23f' }),
    svg('path', { d: 'M26 43 L32 49 L38 43', fill: '#fff', stroke: o, 'stroke-width': 2 }),
    svg('circle', { cx: 32, cy: 29, r: 15, fill: '#ffcfa3', stroke: o, 'stroke-width': 2.5 }),
    svg('ellipse', { cx: 24, cy: 33, rx: 3, ry: 2, fill: '#ff9f9f', opacity: 0.7 }), svg('ellipse', { cx: 40, cy: 33, rx: 3, ry: 2, fill: '#ff9f9f', opacity: 0.7 }),
    svg('circle', { cx: 26.5, cy: 28, r: 2, fill: '#2a1a12' }), svg('circle', { cx: 37.5, cy: 28, r: 2, fill: '#2a1a12' }),
    svg('circle', { cx: 27.1, cy: 27.3, r: 0.7, fill: '#fff' }), svg('circle', { cx: 38.1, cy: 27.3, r: 0.7, fill: '#fff' }),
    svg('path', { d: 'M22 35 Q27 31 32 34 Q37 31 42 35 Q37 38 32 36 Q27 38 22 35 Z', fill: '#8a5a3a', stroke: o, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M27 38.5 Q32 42 37 38.5', fill: 'none', stroke: o, 'stroke-width': 2, 'stroke-linecap': 'round' }),
    svg('path', { d: 'M15 21 Q16 8 32 8 Q48 8 49 21 Z', fill: '#2f6fd0', stroke: o, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    svg('rect', { x: 13, y: 19, width: 38, height: 6, rx: 3, fill: '#1d4f9e', stroke: o, 'stroke-width': 2 }),
    svg('circle', { cx: 32, cy: 15, r: 4, fill: '#ffd23f', stroke: o, 'stroke-width': 1.5 }),
    svg('path', { d: 'M30 15 L32 12.5 L34 15 L32 17.5 Z', fill: '#e8863a' }));
}

export function createHelper(root, { enabled, onOpen }) {
  let timer = 0, sticky = false;
  const bubble = h('button', { class: 'bubble hidden', 'aria-label': 'Închide sfatul', onclick: () => { if (!sticky) api.hide(); } });
  const face = h('button', { class: 'helper', 'aria-label': 'Ajutorul', onclick: () => { if (sticky) return; if (onOpen) { api.hide(); onOpen(); return; } if (bubble.classList.contains('hidden') && api.last) api.say(api.last, { force: true }); else api.hide(); } }, drawConductor());
  root.append(face, bubble);
  const api = {
    el: [face, bubble], last: '',
    /** Spune ceva. `sticky` = rămâne până îl închide jucătorul (tutorial). Întoarce false dacă sfaturile sunt oprite. */
    say(text, { ms = 9000, force = false, keep = false } = {}) {
      if (!force && !keep && !enabled()) return false;
      api.last = text; sticky = keep;
      bubble.textContent = text; bubble.classList.remove('hidden'); root.classList.add('bubbled');
      face.classList.remove('talk'); void face.offsetWidth; face.classList.add('talk');
      clearTimeout(timer);
      if (!keep && ms) timer = setTimeout(api.hide, ms);
      return true;
    },
    hide() { clearTimeout(timer); bubble.classList.add('hidden'); root.classList.remove('bubbled'); face.classList.remove('talk'); sticky = false; },
    busy: () => !bubble.classList.contains('hidden'),
    isSticky: () => sticky,
    show(on) { face.classList.toggle('hidden', !on); if (!on) api.hide(); },
  };
  return api;
}
