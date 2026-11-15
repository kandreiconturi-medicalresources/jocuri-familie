// Ajutoare pentru ecranele DOM (suprapuse peste scena 3D).
import { h, show } from '../../../../shared/ui/dom.js';

export const btn = (label, onclick, cls = '') => h('button', { class: 'big ' + cls, onclick }, label);

/** Ecran (overlay + card) în #ui; întoarce { el, card, show(on) }. */
export function makeScreen(children = [], cls = '') {
  const card = h('div', { class: 'card ' + cls }, children);
  const el = h('div', { class: 'ov hidden' }, card);
  document.getElementById('ui').appendChild(el);
  return { el, card, show: (on = true) => show(el, on) };
}

/** Rând de opțiuni: etichetă + butoane; `cur` = valoarea aleasă. */
export function optRow(label, options, cur, onPick) {
  return h('div', { class: 'row' }, h('span', { class: 'lab' }, label),
    options.map(([v, text]) => btn(text, () => onPick(v), 'opt sm' + (v === cur ? ' on' : ''))));
}

const NS = 'http://www.w3.org/2000/svg';
const COLORS = { Red: '#e8433c', Green: '#4cc24f', Orange: '#ff9a2e', White: '#f1f1f1' };
/** Mașinuță mică (SVG) în culoarea aleasă. */
export function carIcon(colorId, size = 64) {
  const s = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = s('svg', { viewBox: '0 0 64 40', width: size, height: size * 0.625 });
  svg.append(s('rect', { x: 4, y: 14, width: 56, height: 16, rx: 7, fill: COLORS[colorId] || '#fff', stroke: '#2a1458', 'stroke-width': 2.5 }),
    s('rect', { x: 20, y: 6, width: 24, height: 12, rx: 5, fill: '#9fd8ff', stroke: '#2a1458', 'stroke-width': 2.5 }),
    s('circle', { cx: 17, cy: 31, r: 6, fill: '#222', stroke: '#2a1458', 'stroke-width': 2 }),
    s('circle', { cx: 47, cy: 31, r: 6, fill: '#222', stroke: '#2a1458', 'stroke-width': 2 }));
  return svg;
}

export const fmtTime = (sec) => {
  const t = Math.max(0, sec), m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
};
