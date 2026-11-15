// Terenul clasic: pământ cu iarbă, piatră (L) și gheață (I). Se pre-randează pe bucăți (16 plăci), ca să meargă repede pe telefoane vechi.
import { TS, ROWS } from '../../tiles.js';
import { makeCanvas } from '../../atlas.js';
import { ell, circ, rr, hash } from './draw.js';

/** O placă de teren (x,y = colț). isTop = nu are teren deasupra; L/R = nu are teren în lateral. */
export function drawGround(c, th, x, y, isTop, L, R, tx, ty) {
  c.fillStyle = th.dirt; c.fillRect(x, y, TS, TS);
  if (ty >= 16) { c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(x, y, TS, TS); }
  const h1 = hash(tx, ty), h2 = hash(ty + 7, tx);
  c.fillStyle = th.dirt2; ell(c, x + 6 + h1 * 18, y + (isTop ? 18 : 8) + h2 * 8, 4, 3); ell(c, x + 10 + h2 * 14, y + (isTop ? 26 : 20) + h1 * 6, 3, 2.2);
  c.fillStyle = 'rgba(255,255,255,.12)'; circ(c, x + 5 + h1 * 18, y + (isTop ? 17 : 7) + h2 * 8, 1.4);
  if (L) { c.fillStyle = th.dirtDk; c.fillRect(x, y, 4, TS); }
  if (R) { c.fillStyle = th.dirtDk; c.fillRect(x + TS - 4, y, 4, TS); }
  if (!isTop) return;
  c.fillStyle = th.grassDk; c.fillRect(x, y, TS, 12); for (let i = 0; i < 4; i++) circ(c, x + 4 + i * 8, y + 12, 4.5);
  c.fillStyle = th.grass; c.fillRect(x, y, TS, 10); for (let i = 0; i < 4; i++) circ(c, x + 4 + i * 8, y + 10, 4);
  c.fillStyle = th.grassHi; c.fillRect(x, y, TS, 3);
  if (L) { c.fillStyle = th.grassDk; circ(c, x + 2, y + 7, 7); c.fillStyle = th.grass; circ(c, x + 3, y + 6, 6); }
  if (R) { c.fillStyle = th.grassDk; circ(c, x + TS - 2, y + 7, 7); c.fillStyle = th.grass; circ(c, x + TS - 3, y + 6, 6); }
  if (h1 < 0.6) {
    c.fillStyle = th.grass;
    for (let k = 0; k < 3; k++) { const bx = x + 4 + ((h2 * 97 + k * 11) % 26); c.beginPath(); c.moveTo(bx - 2, y + 1); c.lineTo(bx, y - 5 - (k % 2) * 2); c.lineTo(bx + 2, y + 1); c.fill(); }
  }
}

/** Piatra/lada „L” (scări, trepte). */
export function drawCrate(c, x, y) {
  c.fillStyle = '#c48a4a'; c.fillRect(x, y, TS, TS);
  c.fillStyle = '#a8703a'; c.fillRect(x + 4, y + 10, TS - 8, 3); c.fillRect(x + 4, y + 19, TS - 8, 3);
  c.strokeStyle = '#8a5526'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 5, y + TS - 5); c.lineTo(x + TS - 5, y + 5); c.stroke();
  c.strokeStyle = '#5e3814'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, TS - 2, TS - 2); c.strokeRect(x + 4, y + 4, TS - 8, TS - 8);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 2, y + 2, TS - 4, 2);
  c.fillStyle = '#5e3814'; circ(c, x + 6, y + 6, 1.3); circ(c, x + TS - 6, y + 6, 1.3); circ(c, x + 6, y + TS - 6, 1.3); circ(c, x + TS - 6, y + TS - 6, 1.3);
}

/** Gheață (alunecoasă): bloc translucid cu sclipiri. */
export function drawIce(c, x, y) {
  const g = c.createLinearGradient(0, y, 0, y + TS); g.addColorStop(0, '#dff6ff'); g.addColorStop(1, '#8fd0f0');
  rr(c, x + 0.5, y + 0.5, TS - 1, TS - 1, 5); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a90c0'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + 4, y + 4, TS - 8, 3);
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 9, y + 24); c.lineTo(x + 17, y + 12); c.moveTo(x + 15, y + 26); c.lineTo(x + 21, y + 18); c.stroke();
  c.fillStyle = 'rgba(80,150,200,.25)'; c.fillRect(x + 4, y + TS - 7, TS - 8, 3);
}

const CH = 16, MAX_CHUNKS = 8;
const cache = new Map();
export const resetClassicGround = () => cache.clear();

const solid = (lv, tx, ty) => {
  if (tx < 0 || tx >= lv.width) return true;
  if (ty < 0) return false;
  if (ty >= ROWS) return true;
  return lv.grid[ty][tx] === '#';
};

function build(lv, th, c, cs) {
  const cv = makeCanvas(CH * TS * cs, ROWS * TS * cs), x = cv.getContext('2d');
  x.setTransform(cs, 0, 0, cs, 0, 0);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let k = 0; k < CH; k++) {
      const tx = c * CH + k;
      if (tx >= lv.width) break;
      const ch = lv.grid[ty][tx], px = k * TS, py = ty * TS;
      if (ch === '#') drawGround(x, th, px, py, !solid(lv, tx, ty - 1), !solid(lv, tx - 1, ty), !solid(lv, tx + 1, ty), tx, ty);
      else if (ch === 'L') drawCrate(x, px, py);
      else if (ch === 'I') drawIce(x, px, py);
    }
  }
  return cv;
}

export function drawGroundChunks(ctx, lv, th, camX, vw, scale) {
  const cs = scale > 1.25 ? 2 : 1;
  const c0 = Math.max(0, Math.floor(camX / (CH * TS))), c1 = Math.min(Math.floor((lv.width - 1) / CH), Math.floor((camX + vw) / (CH * TS)));
  for (let c = c0; c <= c1; c++) {
    const key = lv.index + '|' + c + '|' + cs;
    let cv = cache.get(key);
    if (cv) cache.delete(key); else cv = build(lv, th, c, cs);
    cache.set(key, cv);
    ctx.drawImage(cv, c * CH * TS - camX, 0, CH * TS, ROWS * TS);
  }
  while (cache.size > MAX_CHUNKS) cache.delete(cache.keys().next().value);
}
