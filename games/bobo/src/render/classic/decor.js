// Decorul de pe teren (tufișuri, flori, smocuri, pietre, ferigi + cactuși, scoici, cristale, ciuperci, oameni de zăpadă) și indicatorul de la start.
import { TS, ROWS } from '../../tiles.js';
import { circ, ell, rr, hash } from './draw.js';

/** Se calculează o dată pe nivel, din terenul inițial (`#` nu se schimbă în joc). */
export function buildDecor(lv, th) {
  const out = [], g = lv.grid;
  const at = (tx, ty) => (ty < 0 || ty >= ROWS || tx < 0 || tx >= lv.width ? '.' : g[ty][tx]);
  for (let tx = 0; tx < lv.width; tx++) {
    for (let ty = 2; ty < ROWS; ty++) {
      if (g[ty][tx] !== '#' || g[ty - 1][tx] !== '.' || g[ty - 2][tx] !== '.') continue;
      const h = hash(tx * 3 + lv.index * 101, ty), x = tx * TS, y = ty * TS;
      if (h < 0.09 && at(tx + 1, ty) === '#' && at(tx + 1, ty - 1) === '.') out.push({ t: th.extra === 'cactus' ? 'cactus' : 'bush', x: x + TS, y, s: 0.75 + hash(tx, 5) * 0.5 });
      else if (th.extra && h < 0.19) out.push({ t: th.extra, x: x + 16, y, s: 0.8 + hash(tx, 6) * 0.5, c: Math.floor(hash(tx, 11) * 4) });
      else if (h < 0.25 && !th.noFlower) out.push({ t: 'flower', x: x + 6 + hash(tx, 9) * 20, y, c: Math.floor(hash(tx, 11) * 4) });
      else if (h < 0.34) out.push({ t: 'tuft', x: x + 16, y });
      else if (h < 0.38) out.push({ t: 'rock', x: x + 16, y, s: 0.7 + hash(tx, 3) * 0.6 });
      else if (h < 0.43 && th.pine) out.push({ t: 'fern', x: x + 16, y });
    }
  }
  const sx = lv.spawn.tx + 5;
  if (g[15] && g[15][sx] === '#') out.push({ t: 'sign', x: sx * TS + 16, y: 15 * TS });
  return out;
}

export function drawDecor(c, th, list, camX, vw, t) {
  for (const d of list) {
    if (d.x < camX - 60 || d.x > camX + vw + 60) continue;
    const x = d.x - camX, y = d.y, s = d.s;
    switch (d.t) {
      case 'bush':
        c.fillStyle = th.grassDk; circ(c, x - 14 * s, y - 8 * s, 12 * s); circ(c, x + 14 * s, y - 8 * s, 12 * s); circ(c, x, y - 15 * s, 15 * s);
        c.fillStyle = th.tree; circ(c, x - 14 * s, y - 9 * s, 10.5 * s); circ(c, x + 14 * s, y - 9 * s, 10.5 * s); circ(c, x, y - 16 * s, 13.5 * s);
        c.fillStyle = th.treeHi; circ(c, x - 5 * s, y - 22 * s, 5 * s); circ(c, x + 12 * s, y - 14 * s, 3.5 * s); break;
      case 'flower': {
        const sw = Math.sin(t * 0.05 + d.x * 0.1) * 2;
        c.strokeStyle = '#2e8b3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sw * 0.5, y - 6, x + sw, y - 12); c.stroke();
        c.fillStyle = th.flowers[d.c]; for (let n = 0; n < 5; n++) { const a = n * 1.257 + t * 0.01; circ(c, x + sw + Math.cos(a) * 3.8, y - 13 + Math.sin(a) * 3.8, 2.8); }
        c.fillStyle = '#ffb703'; circ(c, x + sw, y - 13, 2.2); break;
      }
      case 'tuft':
        c.fillStyle = th.tuft || th.grassDk;
        for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * 5 - 3, y + 1); c.lineTo(x + k * 7 + Math.sin(t * 0.04 + d.x) * 1.5, y - 10 + Math.abs(k) * 3); c.lineTo(x + k * 5 + 3, y + 1); c.fill(); }
        break;
      case 'rock': c.fillStyle = th.rock[0]; ell(c, x, y - 4 * s, 9 * s, 6 * s); c.fillStyle = th.rock[1]; ell(c, x - 2 * s, y - 6 * s, 5 * s, 3 * s); break;
      case 'fern':
        c.strokeStyle = '#4caf50'; c.lineWidth = 2;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + k * 4, y - 12, x + k * 9, y - 8 - Math.abs(k) * -2); c.stroke(); }
        break;
      case 'cactus':
        c.fillStyle = th.tree; rr(c, x - 5 * s, y - 34 * s, 10 * s, 36 * s, 5 * s); c.fill();
        rr(c, x - 15 * s, y - 24 * s, 7 * s, 14 * s, 3.5 * s); c.fill(); c.fillRect(x - 15 * s, y - 14 * s, 11 * s, 5 * s);
        rr(c, x + 8 * s, y - 28 * s, 7 * s, 14 * s, 3.5 * s); c.fill(); c.fillRect(x + 3 * s, y - 18 * s, 11 * s, 5 * s);
        c.fillStyle = th.treeHi; c.fillRect(x - 2 * s, y - 30 * s, 2 * s, 28 * s);
        c.fillStyle = '#ff70a6'; circ(c, x, y - 36 * s, 3 * s); break;
      case 'shell':
        c.fillStyle = '#ffd6c0'; c.beginPath(); c.moveTo(x - 8 * s, y); c.quadraticCurveTo(x - 10 * s, y - 14 * s, x, y - 14 * s); c.quadraticCurveTo(x + 10 * s, y - 14 * s, x + 8 * s, y); c.closePath(); c.fill();
        c.strokeStyle = '#e8907a'; c.lineWidth = 1.5; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * 3 * s, y - 1); c.lineTo(x + k * 5 * s, y - 12 * s); c.stroke(); } break;
      case 'crystal':
        for (let k = -1; k <= 1; k++) {
          const h = (k ? 16 : 26) * s, bx = x + k * 7 * s;
          c.fillStyle = k ? '#9a7af0' : '#b890ff'; c.beginPath(); c.moveTo(bx - 4 * s, y); c.lineTo(bx - 3 * s, y - h * 0.7); c.lineTo(bx, y - h); c.lineTo(bx + 3 * s, y - h * 0.7); c.lineTo(bx + 4 * s, y); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(bx, y - h); c.lineTo(bx - 3 * s, y - h * 0.7); c.lineTo(bx - 1.5 * s, y - 2); c.lineTo(bx, y - 2); c.closePath(); c.fill();
        }
        break;
      case 'mushroom':
        c.fillStyle = '#f4e4cc'; c.fillRect(x - 3 * s, y - 12 * s, 6 * s, 13 * s);
        c.fillStyle = d.c % 2 ? '#e8484a' : '#ffb347'; c.beginPath(); c.ellipse(x, y - 12 * s, 11 * s, 9 * s, 0, Math.PI, 0); c.closePath(); c.fill();
        c.fillStyle = '#fff'; circ(c, x - 4 * s, y - 17 * s, 2 * s); circ(c, x + 4 * s, y - 15 * s, 1.6 * s); break;
      case 'snowman':
        c.fillStyle = '#fff'; circ(c, x, y - 7 * s, 8 * s); circ(c, x, y - 19 * s, 6 * s);
        c.fillStyle = '#b4cce6'; circ(c, x + 3 * s, y - 5 * s, 4 * s); c.fillStyle = '#fff'; circ(c, x, y - 19 * s, 6 * s);
        c.fillStyle = '#222'; circ(c, x - 2 * s, y - 20 * s, 0.9 * s); circ(c, x + 2 * s, y - 20 * s, 0.9 * s);
        c.fillStyle = '#ff7a2a'; c.beginPath(); c.moveTo(x, y - 18 * s); c.lineTo(x + 6 * s, y - 17 * s); c.lineTo(x, y - 16.5 * s); c.fill();
        c.fillStyle = '#e63946'; c.fillRect(x - 6 * s, y - 14 * s, 12 * s, 2.5 * s); break;
      case 'sign':
        c.fillStyle = '#7a4c20'; c.fillRect(x - 3, y - 34, 6, 34);
        rr(c, x - 22, y - 48, 44, 22, 5); c.fillStyle = '#c48a4a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#5e3814'; c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 12, y - 40); c.lineTo(x + 4, y - 40); c.lineTo(x + 4, y - 45); c.lineTo(x + 14, y - 37); c.lineTo(x + 4, y - 29); c.lineTo(x + 4, y - 34); c.lineTo(x - 12, y - 34); c.closePath(); c.fill();
        break;
      default: break;
    }
  }
}
