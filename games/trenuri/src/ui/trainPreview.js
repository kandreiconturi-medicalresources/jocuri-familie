// Previzualizare 2D a trenului (SVG): locomotiva și vagoanele, goale sau pline cu marfa aleasă.
import { CAR_TYPES, GOODS } from '../sim/goods.js';
import { goodColor } from '../render/cargo.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, a, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); kids.forEach((c) => e.append(c)); return e; };
const CAR_COL = ['#4a8ae0', '#5bbf6a', '#c9985a', '#555566', '#8a5a3a', '#d8d8e8', '#d84a4a', '#9aa4b0'];

export function trainPreview(model, kinds, good, full) {
  const W = 70, n = kinds.length, svg = el('svg', { viewBox: `0 0 ${W * (n + 1) + 10} 80`, class: 'wz-prev', role: 'img', 'aria-label': 'Previzualizare tren' });
  svg.append(el('rect', { x: 0, y: 66, width: W * (n + 1) + 10, height: 4, fill: '#6e4a2e' }));
  const loco = el('g', { transform: 'translate(4,0)' }, el('rect', { x: 0, y: 28, width: 60, height: 34, rx: 6, fill: '#c0392b', stroke: '#3b2314', 'stroke-width': 2 }),
    el('rect', { x: 36, y: 14, width: 24, height: 22, rx: 3, fill: '#a93226', stroke: '#3b2314', 'stroke-width': 2 }), el('rect', { x: 40, y: 18, width: 12, height: 10, fill: '#bfe6ff' }),
    el('rect', { x: 8, y: 14, width: 10, height: 14, fill: '#444' }));
  [14, 46].forEach((x) => loco.append(el('circle', { cx: x, cy: 64, r: 7, fill: '#2b2b33' })));
  svg.append(loco);
  kinds.forEach((k, i) => {
    const x = W * (i + 1) + 8, g = el('g', { transform: `translate(${x},0)` });
    g.append(el('rect', { x: 0, y: 34, width: 60, height: 28, rx: 3, fill: CAR_COL[k] || '#888', stroke: '#3b2314', 'stroke-width': 2 }));
    if (full && good >= 0 && k >= 2) g.append(el('path', { d: 'M4 34 Q18 12 30 14 Q44 12 56 34 Z', fill: goodColor(good), stroke: '#3b2314', 'stroke-width': 1.5 }));
    else if (full && k < 2) g.append(el('text', { x: 30, y: 54, 'text-anchor': 'middle', 'font-size': 16 }, GOODS[k].icon));
    else if (k >= 2) g.append(el('text', { x: 30, y: 54, 'text-anchor': 'middle', 'font-size': 14, opacity: 0.45 }, CAR_TYPES[k].icon));
    [10, 50].forEach((cx) => g.append(el('circle', { cx, cy: 64, r: 6, fill: '#2b2b33' })));
    svg.append(g);
  });
  return svg;
}
