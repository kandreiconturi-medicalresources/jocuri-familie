// Platforme mobile (one-way): dus-întors între (tx,ty) și (tx+dx,ty+dy); duc jucătorii cu ele.
import { TS } from './tiles.js';

const H = 12;

export function createPlatforms(lv) {
  return (lv.platforms || []).map((s) => {
    const x0 = s.tx * TS, y0 = s.ty * TS, x1 = (s.tx + s.dx) * TS, y1 = (s.ty + s.dy) * TS;
    return { x: x0, y: y0, w: s.w * TS, h: H, x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0), s: 0, dir: 1, wait: 0,
      speed: s.speed || 1, dx: 0, dy: 0, py: y0 };
  });
}

export function updatePlatforms(g) {
  for (const p of g.platforms) {
    const ox = p.x, oy = p.y;
    p.py = p.y;
    if (p.wait > 0) p.wait--;
    else if (p.len > 0) {
      p.s += p.dir * p.speed;
      if (p.s >= p.len) { p.s = p.len; p.dir = -1; p.wait = 20; }
      if (p.s <= 0) { p.s = 0; p.dir = 1; p.wait = 20; }
    }
    const k = p.len > 0 ? p.s / p.len : 0;
    p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k;
    p.dx = p.x - ox; p.dy = p.y - oy;
  }
}

/** După stepPlayer: dacă jucătorul cade pe o platformă, rămâne pe ea. */
export function landOnPlatforms(g, p) {
  if (p.vy < 0 && !p.onGround) return;
  const prevBottom = p.py + p.h, bottom = p.y + p.h;
  for (const pl of g.platforms) {
    if (p.x + p.w <= pl.x + 2 || p.x >= pl.x + pl.w - 2) continue;
    if (prevBottom <= pl.py + 4 && bottom >= pl.y && (p.vy >= 0 || p.onGround)) {
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.groundTile = '.'; p.riding = pl;
      return;
    }
  }
}
