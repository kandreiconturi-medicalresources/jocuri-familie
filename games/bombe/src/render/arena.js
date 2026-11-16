// Stratul static al arenei (podea, pereți, lăzi, tufișuri), desenat într-un canvas și refăcut doar când se schimbă grila.
import { W, H, WALL, CRATE, BUSH, idx } from '../logic/rules.js';
import { drawSpr, hasFrame } from '../../../bobo/src/atlas.js';

export const T = 32;   // mărimea unei plăci în unități logice
export const OY = 48;  // loc pentru bara de sus

function sprOr(c, name, x, y, fallback) {
  if (hasFrame('tiles', name)) { drawSpr(c, 'tiles', name, x, y, T, T); return; }
  c.fillStyle = fallback; c.fillRect(x, y, T, T);
}

function bush(c, x, y, i) {
  c.fillStyle = '#2f8f3f';
  c.beginPath(); c.arc(x + T * 0.3, y + T * 0.6, T * 0.3, 0, 7); c.arc(x + T * 0.7, y + T * 0.6, T * 0.3, 0, 7); c.arc(x + T * 0.5, y + T * 0.4, T * 0.34, 0, 7); c.fill();
  c.fillStyle = '#4dbb55';
  c.beginPath(); c.arc(x + T * 0.42, y + T * 0.38, T * 0.2, 0, 7); c.arc(x + T * 0.7, y + T * 0.55, T * 0.14, 0, 7); c.fill();
  c.fillStyle = i % 3 ? '#ff7eb6' : '#ffd23f';
  c.beginPath(); c.arc(x + T * 0.3, y + T * 0.5, 2.5, 0, 7); c.arc(x + T * 0.62, y + T * 0.7, 2.5, 0, 7); c.fill();
}

export function createArenaLayer() {
  let cv = null, key = '';
  return function layer(s, scale) {
    const k = s.arenaId + ':' + s.gv + ':' + scale;
    if (k === key) return cv;
    key = k;
    if (!cv) cv = document.createElement('canvas');
    cv.width = Math.ceil(W * T * scale); cv.height = Math.ceil(H * T * scale);
    const c = cv.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const th = s.arena.theme;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * T, py = y * T;
        c.fillStyle = (x + y) % 2 ? th.a : th.b; c.fillRect(px, py, T, T);
        if (s.arena.ice && (x * 7 + y * 3) % 5 === 0) {
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 8, py + 28); c.lineTo(px + 20, py + 14); c.stroke();
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = idx(x, y), g = s.grid[i], px = x * T, py = y * T;
        if (g === WALL || g === CRATE) {
          c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(px + 3, py + 5, T, T); // umbră
          sprOr(c, g === WALL ? th.wall : th.crate, px, py, g === WALL ? '#777' : '#b07a3a');
          if (g === CRATE) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, T - 2, T - 2); }
        } else if (g === BUSH) bush(c, px, py, i);
      }
    }
    return cv;
  };
}
