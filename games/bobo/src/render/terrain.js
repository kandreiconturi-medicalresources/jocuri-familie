// Teren: autotile pre-randat pe bucăți (chunk-uri) pentru statice (# L I); restul plăcilor se desenează pe cadru.
import { TS, ROWS } from '../tiles.js';
import { sheetImage, frameRect, hasFrame, drawSpr, makeCanvas } from '../atlas.js';
import { icon } from './sprites.js';

const CH = 16;               // plăci pe bucată
const MAX_CHUNKS = 8;
const cache = new Map();
export const resetTerrain = () => cache.clear();

const solidGround = (lv, tx, ty) => {
  if (tx < 0 || tx >= lv.width) return true;
  if (ty < 0) return false;
  if (ty >= ROWS) return true;
  return lv.grid[ty][tx] === '#';
};

/** Numele cadrului de teren după vecini. */
export function terrainName(terrain, u, d, l, r) {
  const t = 'terrain_' + terrain;
  if (terrain === 'cloud') {
    const n = !l && !r ? '' : !l ? '_left' : !r ? '_right' : '_middle';
    return 'terrain_snow_cloud' + n;
  }
  if (!u && !d) return !l && !r ? t + '_block' : t + (!l ? '_horizontal_left' : !r ? '_horizontal_right' : '_horizontal_middle');
  if (!l && !r && (u || d)) return t + (!u ? '_vertical_top' : !d ? '_vertical_bottom' : '_vertical_middle');
  const row = !u ? 'top' : !d ? 'bottom' : '';
  const col = !l ? 'left' : !r ? 'right' : '';
  const n = row && col ? row + '_' + col : row || col || 'center';
  return t + '_block_' + n;
}

function buildChunk(lv, th, c, cs) {
  const cv = makeCanvas(CH * TS * cs, ROWS * TS * cs);
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const tp = (name) => frameRect('tiles', hasFrame('tiles', name) ? name : 'terrain_grass_block_center');
  for (let ty = 0; ty < ROWS; ty++) {
    for (let k = 0; k < CH; k++) {
      const tx = c * CH + k;
      if (tx >= lv.width) break;
      const ch = lv.grid[ty][tx];
      let name;
      if (ch === '#') {
        name = terrainName(th.terrain, solidGround(lv, tx, ty - 1), solidGround(lv, tx, ty + 1), solidGround(lv, tx - 1, ty), solidGround(lv, tx + 1, ty));
      } else if (ch === 'L') name = 'brick_grey';
      else if (ch === 'I') name = 'block_blue';
      else continue;
      const r = tp(name);
      x.drawImage(sheetImage('tiles'), r[0], r[1], r[2], r[3], k * TS * cs, ty * TS * cs, TS * cs + 0.6, TS * cs + 0.6);
      if (ch === 'I') { x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(k * TS * cs, ty * TS * cs, TS * cs, TS * cs * 0.25); }
    }
  }
  if (th.dark > 0) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(40,0,10,${th.dark})`; x.fillRect(0, 0, cv.width, cv.height); }
  return cv;
}

export function drawChunks(ctx, lv, th, camX, vw, scale) {
  const cs = scale > 1.25 ? 2 : 1;
  const c0 = Math.max(0, Math.floor(camX / (CH * TS))), c1 = Math.min(Math.floor((lv.width - 1) / CH), Math.floor((camX + vw) / (CH * TS)));
  for (let c = c0; c <= c1; c++) {
    const key = lv.index + '|' + c + '|' + cs;
    let cv = cache.get(key);
    if (cv) { cache.delete(key); } else cv = buildChunk(lv, th, c, cs);
    cache.set(key, cv);
    ctx.drawImage(cv, c * CH * TS - camX, 0, CH * TS, ROWS * TS);
  }
  while (cache.size > MAX_CHUNKS) cache.delete(cache.keys().next().value);
}

const key = (lv, tx, ty) => ty * lv.width + tx;

/** Plăcile dinamice: cutii, cărămizi, țepi, trambuline, blocuri care cad, colectabile, lavă. */
export function drawTiles(ctx, lv, th, camX, vw, t) {
  const fx = lv.fx;
  const a = Math.max(0, Math.floor(camX / TS) - 1), b = Math.min(lv.width - 1, Math.floor((camX + vw) / TS) + 1);
  for (let ty = 0; ty < ROWS; ty++) {
    const row = lv.grid[ty];
    for (let tx = a; tx <= b; tx++) {
      const c = row[tx];
      if (c === '.' || c === '#' || c === 'L' || c === 'I' || c === '~') continue;
      let x = tx * TS - camX, y = ty * TS;
      const k = key(lv, tx, ty);
      switch (c) {
        case 'B': case 'G': case 'Q': case 'C': case 'S': case 'g': {
          const bu = fx.bump[k]; if (bu) y -= Math.sin(bu / 8 * Math.PI) * 9;
          drawSpr(ctx, 'tiles', c === 'B' ? 'bricks_brown' : c === 'g' ? 'block_empty' : c === 'G' ? 'block_coin' : 'block_exclamation', x, y);
          break;
        }
        case 'X': {
          const cr = fx.crumb[k] || 0; if (cr) x += Math.sin(t * 2.2) * Math.min(2.5, cr / 8);
          drawSpr(ctx, 'tiles', 'block_planks', x, y); break;
        }
        case '=': drawSpr(ctx, 'tiles', 'bridge', x, y); break;
        case '^': drawSpr(ctx, 'tiles', 'spikes', x, y); break;
        case 'T': drawSpr(ctx, 'tiles', fx.spring[k] ? 'spring_out' : 'spring', x, y); break;
        case 'V': drawSpr(ctx, 'tiles', row[tx] === 'V' && ty > 0 && lv.grid[ty - 1][tx] === 'V' ? 'lava' : 'lava_top', x, y + (ty > 0 && lv.grid[ty - 1][tx] === 'V' ? 0 : Math.sin(t * 0.08 + tx) * 1.5)); break;
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

/** Apa (transparentă), desenată peste personaje. */
export function drawWater(ctx, lv, camX, vw, t) {
  const a = Math.max(0, Math.floor(camX / TS) - 1), b = Math.min(lv.width - 1, Math.floor((camX + vw) / TS) + 1);
  ctx.globalAlpha = 0.62;
  for (let ty = 0; ty < ROWS; ty++) {
    const row = lv.grid[ty];
    for (let tx = a; tx <= b; tx++) {
      if (row[tx] !== '~') continue;
      const top = ty === 0 || lv.grid[ty - 1][tx] !== '~';
      drawSpr(ctx, 'tiles', top ? 'water_top' : 'water', tx * TS - camX, ty * TS + (top ? Math.sin(t * 0.07 + tx * 0.8) * 1.5 : 0));
    }
  }
  ctx.globalAlpha = 1;
}
