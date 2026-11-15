// Obiecte desenate în cod (căpșună, inimă, steluță, brioșă, bulă, baghetă, portal, nor), pre-randate o dată.
import { makeCanvas } from '../atlas.js';

export const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.2832); c.fill(); };
export const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };

export function starPath(c, x, y, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  c.closePath();
}

export function drawBerry(c, x, y, s) {
  c.fillStyle = '#c81d3a'; c.beginPath(); c.moveTo(x, y + 12 * s);
  c.bezierCurveTo(x - 13 * s, y + 4 * s, x - 11 * s, y - 9 * s, x, y - 7 * s);
  c.bezierCurveTo(x + 11 * s, y - 9 * s, x + 13 * s, y + 4 * s, x, y + 12 * s); c.fill();
  c.fillStyle = '#ff3b52'; c.beginPath(); c.moveTo(x, y + 10 * s);
  c.bezierCurveTo(x - 11 * s, y + 3 * s, x - 9.5 * s, y - 7.5 * s, x, y - 5.5 * s);
  c.bezierCurveTo(x + 9.5 * s, y - 7.5 * s, x + 11 * s, y + 3 * s, x, y + 10 * s); c.fill();
  c.fillStyle = '#ffe9a0';
  [[-4, -1], [3, -2], [0, 3], [-3, 5], [4, 4], [-6, 2], [6, 0]].forEach(([a, b]) => c.fillRect(x + a * s - 1, y + b * s - 1, 2, 2));
  c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, x - 5 * s, y - 3 * s, 2 * s, 3.2 * s, 0.4);
  c.fillStyle = '#2e9a3a'; ell(c, x - 4.5 * s, y - 7.5 * s, 4.5 * s, 2.2 * s, -0.5); ell(c, x + 4.5 * s, y - 7.5 * s, 4.5 * s, 2.2 * s, 0.5);
  c.fillStyle = '#46c04f'; ell(c, x, y - 9 * s, 2.2 * s, 3.8 * s);
}

export function drawHeart(c, x, y, r, color, outline) {
  c.fillStyle = color; c.beginPath(); c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4);
  c.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  c.fill();
  if (outline) { c.lineWidth = 2; c.strokeStyle = outline; c.lineJoin = 'round'; c.stroke(); }
}

export function drawStarIcon(c, x, y, r, full) {
  c.lineJoin = 'round'; c.lineWidth = 2.5;
  c.fillStyle = full ? '#ffd23f' : 'rgba(60,30,100,.45)';
  c.strokeStyle = full ? '#c98a00' : 'rgba(255,255,255,.5)';
  starPath(c, x, y, r); c.fill(); c.stroke();
  if (full) { c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, x - r * 0.25, y - r * 0.2, r * 0.18, r * 0.3, 0.5); }
}

export function drawCloud(c, x, y, s, a = 1) {
  c.fillStyle = `rgba(190,215,240,${0.55 * a})`; circ(c, x + 4 * s, y + 8 * s, 20 * s); circ(c, x + 30 * s, y + 4 * s, 24 * s); circ(c, x + 54 * s, y + 8 * s, 20 * s);
  c.fillStyle = `rgba(255,255,255,${a})`;
  circ(c, x, y, 22 * s); circ(c, x + 24 * s, y - 12 * s, 27 * s); circ(c, x + 50 * s, y - 2 * s, 22 * s);
  c.beginPath(); c.rect(x - 4 * s, y - 4 * s, 68 * s, 22 * s); c.fill();
}

const MAKERS = {
  berry: [64, (c) => drawBerry(c, 32, 34, 2)],
  heart: [64, (c) => drawHeart(c, 32, 30, 14, '#ff3b6b', '#8a1238')],
  heartEmpty: [64, (c) => drawHeart(c, 32, 30, 14, 'rgba(60,30,100,.5)', 'rgba(255,255,255,.55)')],
  star: [64, (c) => drawStarIcon(c, 32, 33, 26, true)],
  starEmpty: [64, (c) => drawStarIcon(c, 32, 33, 26, false)],
  bubble: [64, (c) => {
    c.fillStyle = 'rgba(155,231,255,.35)'; circ(c, 32, 32, 26); c.strokeStyle = '#4cc9f0'; c.lineWidth = 4;
    c.beginPath(); c.arc(32, 32, 26, 0, 6.2832); c.stroke();
    c.strokeStyle = 'rgba(255,120,220,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 20, 0.5, 1.9); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.9)'; circ(c, 22, 22, 6); circ(c, 42, 44, 3);
  }],
  grow: [64, (c) => {
    c.fillStyle = 'rgba(255,190,225,.35)'; circ(c, 32, 32, 30);
    c.lineWidth = 3; c.strokeStyle = '#7a3b1d'; c.lineJoin = 'round'; c.fillStyle = '#ffb347';
    c.beginPath(); c.moveTo(12, 34); c.lineTo(52, 34); c.lineTo(46, 56); c.lineTo(18, 56); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#b03a78'; c.fillStyle = '#ff8cc6';
    c.beginPath(); c.arc(32, 32, 20, Math.PI, 0); c.lineTo(52, 36); c.lineTo(12, 36); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; circ(c, 24, 26, 3); circ(c, 38, 22, 2.5); c.fillStyle = '#e03a3a'; circ(c, 32, 12, 4);
  }],
  wand: [64, (c) => {
    c.fillStyle = 'rgba(255,230,120,.3)'; circ(c, 32, 32, 30);
    c.strokeStyle = '#5a2ba0'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(16, 56); c.lineTo(36, 26); c.stroke();
    c.fillStyle = '#c98a00'; starPath(c, 40, 20, 16, 0.3); c.fill(); c.fillStyle = '#ffd23f'; starPath(c, 40, 20, 12, 0.3); c.fill();
  }],
  portal: [200, (c) => {
    const cx = 100, cy = 110;
    ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].forEach((col, n) => {
      c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, 64 - n * 6.5, Math.PI, 0); c.stroke();
    });
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx, cy, 28, Math.PI, 0); c.fill();
    drawCloud(c, cx - 92, cy - 4, 0.6); drawCloud(c, cx + 50, cy - 4, 0.6);
  }],
  cloud: [200, (c) => drawCloud(c, 40, 50, 1)],
  cloud2: [200, (c) => drawCloud(c, 40, 50, 1.3)],
  glow: [64, (c) => {
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }],
};
const store = {};
/** Canvas pre-randat (pătrat) pentru un obiect desenat în cod. */
export function icon(name) {
  let cv = store[name];
  if (!cv) {
    const [sz, fn] = MAKERS[name];
    cv = makeCanvas(sz, name.startsWith('cloud') ? 120 : sz === 200 ? 130 : sz);
    fn(cv.getContext('2d'));
    store[name] = cv;
  }
  return cv;
}
/** Desenează un icon centrat în (x,y), cu latura `size` logică. */
export function drawIcon(ctx, name, x, y, size) {
  const cv = icon(name);
  ctx.drawImage(cv, x - size / 2, y - size / 2, size, size * cv.height / cv.width);
}
