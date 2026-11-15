// Desenul inamicilor, boss-ului, platformelor, obiectelor, glonțelor, portalului și steagurilor de checkpoint.
import { TS } from '../tiles.js';
import { drawSpr } from '../atlas.js';
import { icon, drawIcon, starPath } from './sprites.js';
import { terrainName } from './terrain.js';
import { BOSS_W, BOSS_H } from '../boss.js';

const SIZE = { block: 34, saw: 36, fireball: 26 };

export function drawEnemy(ctx, e, camX, t) {
  const d = e.d, sheet = d.sheet || 'enemies';
  let name;
  if (e.squashed) name = d.flat;
  else if (d.k === 'block') name = e.state === 'fall' ? d.fall : e.state === 'rest' ? d.rest : d.a[0];
  else if (d.k === 'frog') name = e.onGround ? d.a[0] : d.air;
  else name = d.a[(e.t >> 3) & 1];
  const s = SIZE[e.type] || Math.max(d.w, d.h) * 1.5;
  const cx = e.x + e.w / 2 - camX, cy = e.y + e.h / 2;
  const mid = d.fly || d.fish || d.spin || d.k === 'block' || d.k === 'fire';
  const y = mid ? cy - s / 2 : e.y + e.h + s * 0.08 - s;
  if (e.knock || d.spin) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(d.spin ? e.t * 0.3 : e.rot);
    if (e.knock) ctx.scale(1, -1);
    drawSpr(ctx, sheet, name, -s / 2, -s / 2, s, s, e.dir > 0); ctx.restore(); return;
  }
  if (e.squashed && !d.flat) { ctx.save(); ctx.translate(cx, e.y + e.h); ctx.scale(1, 0.4); drawSpr(ctx, sheet, d.a[0], -s / 2, -s, s, s, e.dir > 0); ctx.restore(); return; }
  drawSpr(ctx, sheet, name, cx - s / 2, y, s, s, e.dir > 0);
}

export function drawBoss(ctx, b, camX, t) {
  if (b.dead && b.dead % 6 < 3) return;
  const d = b.d, s = 136, cx = b.x + b.w / 2 - camX, bottom = b.y + b.h + 8;
  if (b.inv > 0 && (b.inv >> 2) % 2 === 0) ctx.globalAlpha = 0.5;
  const name = b.type === 'frog' ? (b.onGround ? 'frog_idle' : 'frog_jump') : d.k === 'block' ? 'block_idle' : d.a[(t >> 4) & 1];
  const squash = b.state === 'sleep' ? 1 + Math.sin(t * 0.06) * 0.03 : 1;
  ctx.save(); ctx.translate(cx, bottom); ctx.scale(1, squash);
  drawSpr(ctx, d.sheet || 'enemies', name, -s / 2, -s, s, s, b.face > 0);
  ctx.restore(); ctx.globalAlpha = 1;
  for (const w of b.waves) {
    const x = w.x - camX, r = 13 + Math.sin(w.t * 0.5) * 2;
    ctx.fillStyle = 'rgba(255,230,120,.35)'; ctx.beginPath(); ctx.arc(x, w.y, r + 8, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff4b0'; ctx.beginPath(); ctx.arc(x, w.y, r, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, w.y, r, Math.PI, 0); ctx.stroke();
  }
}

export function drawPlatforms(ctx, list, th, camX) {
  for (const p of list) {
    const n = Math.round(p.w / TS);
    for (let i = 0; i < n; i++) drawSpr(ctx, 'tiles', terrainName(th.terrain, false, false, i > 0, i < n - 1), p.x + i * TS - camX, p.y - 4);
  }
}

export function drawItems(ctx, items, camX, t) {
  for (const it of items) {
    const y = it.y + (it.rise > 0 ? 0 : Math.sin(t * 0.1 + it.x) * 3);
    drawIcon(ctx, it.kind, it.x - camX, y, 34);
  }
}

export function drawBullets(ctx, list, camX, t) {
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  for (const b of list) { starPath(ctx, b.x - camX, b.y, 8, t * 0.25); ctx.fill(); ctx.stroke(); }
}

export function drawCheckpoints(ctx, lv, active, camX, t) {
  lv.checkpoints.forEach((c, i) => {
    const on = active.has(i);
    drawSpr(ctx, 'tiles', on ? (((t >> 4) & 1) ? 'flag_green_b' : 'flag_green_a') : 'flag_off', c.tx * TS - 8 - camX, c.ty * TS - 48, 48, 48);
  });
}

export function drawPortal(ctx, lv, open, camX, t) {
  const cx = lv.portal.tx * TS + TS / 2 - camX, cy = lv.portal.ty * TS;
  if (cx < -160 || cx > 1500) return;
  ctx.globalAlpha = open ? 1 : 0.28;
  if (open) {
    const g = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, 110);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 110, cy - 140, 220, 220);
  }
  ctx.drawImage(icon('portal'), cx - 100, cy - 110, 200, 130);
  ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(t * 0.08) * 0.1})`; ctx.beginPath(); ctx.arc(cx, cy, 28, Math.PI, 0); ctx.fill();
  if (open) {
    for (let k = 0; k < 7; k++) {
      const a = t * 0.035 + k * 0.9, r = 46 + Math.sin(t * 0.1 + k) * 10;
      ctx.fillStyle = k % 2 ? '#fff' : '#ffe066';
      starPath(ctx, cx + Math.cos(a) * r, cy - 34 + Math.sin(a) * r * 0.6, 3 + Math.sin(t * 0.2 + k) * 1.5, a); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export { BOSS_W, BOSS_H };
