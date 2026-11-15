// Plăcile dinamice în stilul clasic: cărămizi, cutii-cadou, țepi, nori, trambuline, blocuri care cad, lavă, apă, colectabile.
import { TS, ROWS } from '../../tiles.js';
import { icon } from '../sprites.js';
import { ell, circ, rr, hash, star } from './draw.js';

export function drawBlock(c, th, x, y, moss, tx) {
  c.fillStyle = th.block; c.fillRect(x, y, TS, TS);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, y + 15, TS, 2); c.fillRect(x + 15, y, 2, 15); c.fillRect(x + 7, y + 17, 2, 15); c.fillRect(x + 23, y + 17, 2, 15);
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x, y, TS, 3); c.fillRect(x, y, 3, TS);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, y + TS - 3, TS, 3); c.fillRect(x + TS - 3, y, 3, TS);
  c.strokeStyle = th.blockDk; c.lineWidth = 1.5; c.strokeRect(x + 0.75, y + 0.75, TS - 1.5, TS - 1.5);
  if (th.moss && moss) { c.fillStyle = '#4caf50'; for (let i = 0; i < 4; i++) circ(c, x + 4 + i * 8, y + 2, 3.6 + hash(tx, i) * 1.5); c.fillStyle = '#81c784'; circ(c, x + 8, y + 1, 1.8); }
}

function drawGift(c, x, y, t, tx) {
  const g = c.createLinearGradient(0, y, 0, y + TS); g.addColorStop(0, '#b57cf0'); g.addColorStop(1, '#7b3fc4');
  rr(c, x + 1, y + 1, TS - 2, TS - 2, 6); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a1e8a'; c.stroke();
  c.fillStyle = '#ffd23f'; c.fillRect(x + 13, y + 2, 6, TS - 4); c.fillRect(x + 2, y + 13, TS - 4, 6);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 13, y + 2, 2, TS - 4); c.fillRect(x + 2, y + 13, TS - 4, 2);
  c.fillStyle = '#ffb703'; ell(c, x + 10, y + 4, 6, 3.5, -0.45); ell(c, x + 22, y + 4, 6, 3.5, 0.45); c.fillStyle = '#ffd23f'; circ(c, x + 16, y + 5, 3);
  c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, x + 4, y + 4, 6, 6, 2); c.fill();
  const k = (t + tx * 29) % 90;
  if (k < 16) { c.fillStyle = '#fff'; star(c, x + 26, y + 6, 5 * Math.sin(k / 16 * Math.PI), 0); }
}

function drawEmpty(c, x, y) {
  rr(c, x + 1, y + 1, TS - 2, TS - 2, 6); c.fillStyle = '#a69aa8'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#5f5562'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 4, y + 4, TS - 8, 3); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x + 4, y + TS - 7, TS - 8, 3);
  c.fillStyle = '#857a88'; circ(c, x + 8, y + 16, 2.2); circ(c, x + 24, y + 16, 2.2);
}

function drawCloudTile(c, x, y) {
  c.fillStyle = 'rgba(90,140,200,.3)'; rr(c, x - 2, y + 9, TS + 4, 9, 5); c.fill();
  c.fillStyle = '#e9f3ff'; rr(c, x - 1, y + 3, TS + 2, 12, 6); c.fill();
  c.fillStyle = '#fff'; circ(c, x + 9, y + 5, 7); circ(c, x + 22, y + 4, 8.5); rr(c, x, y + 2, TS, 9, 5); c.fill();
}

function drawSpikes(c, x, y) {
  c.fillStyle = '#7d8a96'; c.fillRect(x, y + TS - 4, TS, 4);
  for (let i = 0; i < 3; i++) {
    const bx = x + i * 10.6;
    c.fillStyle = '#e3ebf0'; c.beginPath(); c.moveTo(bx + 1, y + TS - 3); c.lineTo(bx + 5.3, y + 12); c.lineTo(bx + 5.3, y + TS - 3); c.closePath(); c.fill();
    c.fillStyle = '#9aa8b4'; c.beginPath(); c.moveTo(bx + 5.3, y + 12); c.lineTo(bx + 9.8, y + TS - 3); c.lineTo(bx + 5.3, y + TS - 3); c.closePath(); c.fill();
  }
}

function drawSpring(c, x, y, out) {
  const h = out ? 18 : 10, top = y + TS - 6 - h;
  c.lineWidth = 2; c.strokeStyle = '#3d2a1a';
  c.fillStyle = '#5c6470'; rr(c, x + 3, y + TS - 6, TS - 6, 6, 2); c.fill(); c.stroke();
  c.strokeStyle = '#8a95a3'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x + 9, y + TS - 6);
  const n = 4; for (let i = 1; i <= n; i++) c.lineTo(x + (i % 2 ? 23 : 9), y + TS - 6 - h * i / n);
  c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#3d2a1a'; c.fillStyle = '#ff595e'; rr(c, x + 1, top - 6, TS - 2, 7, 3.5); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + 5, top - 4, TS - 12, 2);
}

function drawCrumble(c, x, y, cr) {
  c.fillStyle = '#d9a35f'; c.fillRect(x, y, TS, TS);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, y + 10, TS, 2); c.fillRect(x, y + 21, TS, 2);
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x, y, TS, 3);
  c.strokeStyle = '#7a4a1a'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
  c.fillStyle = '#5e3814'; circ(c, x + 5, y + 6, 1.3); circ(c, x + TS - 5, y + 6, 1.3); circ(c, x + 5, y + TS - 6, 1.3); circ(c, x + TS - 5, y + TS - 6, 1.3);
  if (cr > 0) {
    c.strokeStyle = '#3d2a1a'; c.lineWidth = 1.6; c.beginPath();
    c.moveTo(x + 8, y + 2); c.lineTo(x + 13, y + 12); c.lineTo(x + 9, y + 20); c.lineTo(x + 15, y + 30);
    if (cr > 12) { c.moveTo(x + 24, y + 3); c.lineTo(x + 20, y + 14); c.lineTo(x + 26, y + 24); }
    c.stroke();
  }
}

function drawLava(c, x, y, t, tx, top) {
  c.fillStyle = '#ff5a14'; c.fillRect(x, y + (top ? 6 : 0), TS, TS - (top ? 6 : 0) + 0.5);
  c.fillStyle = '#ff8a24'; for (let i = 0; i < 3; i++) ell(c, x + 6 + i * 10 + Math.sin(t * 0.05 + tx + i) * 2, y + 14 + i * 5, 6, 2.5);
  const b = (t * 0.4 + hash(tx, 3) * 32) % 32; c.fillStyle = '#ffd060'; circ(c, x + 6 + hash(tx, 4) * 20, y + TS - b, 2 + (b < 8 ? b / 8 : 1));
  if (top) {
    c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(x, y + TS);
    c.lineTo(x, y + 6 + Math.sin(t * 0.08 + tx * 1.7) * 2.5);
    for (let i = 1; i <= 8; i++) c.lineTo(x + i * 4, y + 6 + Math.sin(t * 0.08 + (tx * TS + i * 4) * 0.12) * 2.5);
    c.lineTo(x + TS, y + TS); c.closePath(); c.fill();
    c.fillStyle = '#ff5a14'; c.fillRect(x, y + 11, TS, TS - 10);
    c.strokeStyle = '#fff0a0'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 8; i++) { const yy = y + 6 + Math.sin(t * 0.08 + (tx * TS + i * 4) * 0.12) * 2.5; i ? c.lineTo(x + i * 4, yy) : c.moveTo(x, yy); }
    c.stroke();
  }
}

/** Plăcile desenate pe cadru (tot ce nu e în bucățile pre-randate și nu e apă). */
export function drawTilesClassic(ctx, lv, th, camX, vw, t) {
  const fx = lv.fx;
  const a = Math.max(0, Math.floor(camX / TS) - 1), b = Math.min(lv.width - 1, Math.floor((camX + vw) / TS) + 1);
  for (let ty = 0; ty < ROWS; ty++) {
    const row = lv.grid[ty];
    for (let tx = a; tx <= b; tx++) {
      const ch = row[tx];
      if (ch === '.' || ch === '#' || ch === 'L' || ch === 'I' || ch === '~') continue;
      const x = tx * TS - camX; let y = ty * TS;
      const k = ty * lv.width + tx;
      switch (ch) {
        case 'B': case 'G': case 'Q': case 'C': case 'S': case 'g': {
          const bu = fx.bump[k]; if (bu) y -= Math.sin(bu / 8 * Math.PI) * 9;
          if (ch === 'B') drawBlock(ctx, th, x, y, ty > 0 && lv.grid[ty - 1][tx] === '.', tx);
          else if (ch === 'g') drawEmpty(ctx, x, y);
          else drawGift(ctx, x, y + Math.sin(t * 0.06 + tx), t, tx);
          break;
        }
        case 'X': { const cr = fx.crumb[k] || 0; drawCrumble(ctx, x + (cr ? Math.sin(t * 2.2) * Math.min(2.5, cr / 8) : 0), y, cr); break; }
        case '=': drawCloudTile(ctx, x, y); break;
        case '^': drawSpikes(ctx, x, y); break;
        case 'T': drawSpring(ctx, x, y, !!fx.spring[k]); break;
        case 'V': drawLava(ctx, x, y, t, tx, ty === 0 || lv.grid[ty - 1][tx] !== 'V'); break;
        case 'o': ctx.drawImage(icon('berry'), x, y + Math.sin(t * 0.1 + tx) * 2.5, TS, TS); break;
        case 'h': ctx.drawImage(icon('heart'), x, y + Math.sin(t * 0.1 + tx) * 2.5, TS, TS); break;
        case '*': {
          const p = 1 + Math.sin(t * 0.12 + tx) * 0.1, sz = TS * 1.15 * p;
          ctx.drawImage(icon('star'), x + TS / 2 - sz / 2, y + TS / 2 - sz / 2 + Math.sin(t * 0.1) * 2, sz, sz); break;
        }
        default: break;
      }
    }
  }
}

/** Apa din gropi (banda de jos), desenată în spatele terenului ca în original. */
export function drawPitWater(ctx, th, camX, vw, t) {
  const y0 = ROWS * TS - 18, x0 = camX - 20, x1 = camX + vw + 20;
  ctx.fillStyle = th.water; ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.moveTo(x0, ROWS * TS + 20);
  for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + t * 0.06) * 3);
  ctx.lineTo(x1, ROWS * TS + 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = th.waterHi; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let x = x0; x <= x1; x += 10) { const y = y0 + Math.sin(x * 0.05 + t * 0.06) * 3; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
}

/** Plăcile de apă `~` (transparente), desenate peste personaje. */
export function drawWaterTiles(ctx, lv, th, camX, vw, t) {
  const a = Math.max(0, Math.floor(camX / TS) - 1), b = Math.min(lv.width - 1, Math.floor((camX + vw) / TS) + 1);
  for (let ty = 0; ty < ROWS; ty++) {
    const row = lv.grid[ty];
    for (let tx = a; tx <= b; tx++) {
      if (row[tx] !== '~') continue;
      const x = tx * TS - camX, y = ty * TS, top = ty === 0 || lv.grid[ty - 1][tx] !== '~';
      ctx.globalAlpha = 0.6; ctx.fillStyle = th.water;
      if (top) {
        ctx.beginPath(); ctx.moveTo(x, y + TS + 0.5);
        for (let i = 0; i <= 8; i++) ctx.lineTo(x + i * 4, y + 3 + Math.sin(t * 0.07 + (tx * TS + i * 4) * 0.1) * 2);
        ctx.lineTo(x + TS, y + TS + 0.5); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = th.waterHi; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i <= 8; i++) { const yy = y + 3 + Math.sin(t * 0.07 + (tx * TS + i * 4) * 0.1) * 2; i ? ctx.lineTo(x + i * 4, yy) : ctx.moveTo(x, yy); }
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, TS + 0.5, TS + 0.5);
        ctx.globalAlpha = 0.35; ctx.fillStyle = th.waterHi; const h1 = hash(tx, ty); ctx.fillRect(x + 4 + h1 * 14, y + 6 + ((t * 0.3 + h1 * 30) % 18), 8, 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}
