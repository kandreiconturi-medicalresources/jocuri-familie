// Jucătorii: stare, mișcare (prin stepPlayer), cutii, colectabile, răniri, checkpoint, tragere cu bagheta.
import { TS, ROWS } from './tiles.js';
import { stepPlayer, makeBody, tilesTouched, tileAt, overlapsSolid, SMALL, BIG } from './physics.js';
import { sfx } from '../../../shared/engine/audio.js';
import { landOnPlatforms } from './platforms.js';
import { isTouch } from '../../../shared/engine/screen.js';

const WH = ROWS * TS;

export function createPlayer(i) {
  return Object.assign(makeBody(0, 0), {
    i, hearts: 3, big: false, shield: false, wand: false, inv: 0, hurtT: 0, dead: false, respawn: 0,
    walk: 0, land: 0, shootCd: 0, py: 0, riding: null, prevB: false, jumpHeld: false,
  });
}

function resize(p, w, h) {
  const cx = p.x + p.w / 2, feet = p.y + p.h;
  p.w = w; p.h = h; p.x = cx - w / 2; p.y = feet - h;
}
function grow(g, p) {
  resize(p, BIG.w, BIG.h);
  if (overlapsSolid(p, g.level)) { resize(p, SMALL.w, SMALL.h); return false; }
  p.big = true; return true;
}
export function shrink(p) { resize(p, SMALL.w, SMALL.h); p.big = false; }

export function placePlayer(p, x, feetY) {
  shrink(p); p.x = x; p.y = feetY - p.h; p.vx = 0; p.vy = 0; p.onGround = false; p.riding = null;
}

export function hurtPlayer(g, p, fromX) {
  if (p.inv > 0 || p.dead) return;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (p.shield) { p.shield = false; p.inv = 90; sfx('pop'); g.particles.burst(cx, cy, '#9be7ff', 16); return; }
  const kx = fromX == null ? 0 : (cx < fromX ? -1 : 1) * 5;
  if (p.wand || p.big) {
    if (p.wand) { p.wand = false; g.particles.sparkle(cx, cy, 8); } else { g.particles.burst(cx, cy, '#ffc2e0', 14); shrink(p); }
    p.inv = 110; p.hurtT = 30; p.vy = -5; p.vx = kx; sfx('pop'); return;
  }
  p.hearts--; sfx('hurt'); p.inv = 110; p.hurtT = 40; p.vy = -7; p.vx = kx; g.shake = Math.max(g.shake, 5);
  if (p.hearts <= 0) killPlayer(g, p);
}

export function killPlayer(g, p, quiet) {
  if (p.dead) return;
  p.dead = true; p.respawn = 70; p.wand = false; p.shield = false; sfx('die');
  g.particles.burst(p.x + p.w / 2, Math.min(p.y + p.h / 2, WH - 20), quiet ? '#ff9a3c' : '#ffd23f', 22);
}

function respawn(g, p) {
  const o = g.players.find((q) => q !== p && !q.dead);
  if (o && !o.onGround) { p.respawn = 5; return; }
  p.dead = false; p.hearts = 3; p.inv = 120; p.hurtT = 0;
  if (o) placePlayer(p, o.x, o.y + o.h); else placePlayer(p, g.cp.x + p.i * 30, g.cp.y);
  g.particles.sparkle(p.x + p.w / 2, p.y + p.h / 2, 10);
}

/** Mesajul de la ridicarea baghetei: tasta potrivită pe PC, butonul ★ pe touch. În rețea controlul e ca la 1 jucător (F). */
function wandHint(g, p) {
  const two = g.players.length > 1 && !g.net;
  const who = two ? ['Bobo', 'Mimi'][p.i] + ': ' : '';
  if (isTouch) return who + 'Baghetă! Apasă ★';
  return who + 'Baghetă! Apasă ' + (two && p.i === 1 ? '↓' : 'F') + ' ca să tragi';
}

function applyItem(g, p, it) {
  const { x, y } = it, P = g.particles;
  if (it.kind === 'bubble') { p.shield = true; sfx('bubble'); P.burst(x, y, '#9be7ff', 14); P.text(x, y - 10, 'Bulă!', '#9be7ff'); }
  else if (it.kind === 'grow') {
    if (p.big) { g.fruits += 5; sfx('fruit'); P.text(x, y - 10, '+5', '#ffe066'); }
    else { if (!grow(g, p)) return false; sfx('grow'); P.sparkle(p.x + p.w / 2, p.y + p.h / 2, 14); P.text(x, y - 24, 'Mare!', '#ffc2e0'); }
  } else {
    p.wand = true; sfx('grow'); P.sparkle(x, y, 12); P.text(x, y - 14, 'Baghetă!', '#ffe066');
    if (!g.net || p === g.local) g.say(wandHint(g, p), 240);
  }
  return true;
}

function bump(g, p, hit) {
  const lv = g.level, { tx, ty } = hit, c = lv.grid[ty][tx], k = ty * lv.width + tx;
  const cx = tx * TS + TS / 2;
  let used = false, brk = false;
  if (c === 'G') { lv.grid[ty][tx] = 'g'; g.fruits++; sfx('fruit'); g.particles.text(cx, ty * TS - 4, '+1', '#ff7a8a'); g.particles.sparkle(cx, ty * TS - 8, 5); used = true; }
  else if (c === 'Q' || c === 'C' || c === 'S') {
    lv.grid[ty][tx] = 'g'; sfx('bump');
    g.items.push({ kind: c === 'Q' ? 'bubble' : c === 'C' ? 'grow' : 'wand', x: cx, y: ty * TS + 16, ty0: ty * TS - 16, t: 0, rise: 22, id: k });
    used = true;
  } else if (c === 'B') {
    if (p.big) {
      lv.grid[ty][tx] = '.'; brk = true; sfx('break'); g.shake = Math.max(g.shake, 3);
      g.particles.burst(cx, ty * TS + 16, '#b0703a', 10); g.particles.dust(cx, ty * TS + 20, 3);
    } else { sfx('bump'); used = true; }
  }
  if (used) lv.fx.bump[k] = 8;
  if (used || brk) g.emit({ e: 'b', id: k, c, n: lv.grid[ty][tx] });
  for (const e of g.enemies) {
    if (!e.dead && !e.knock && e.x + e.w > tx * TS && e.x < (tx + 1) * TS && Math.abs(e.y + e.h - ty * TS) < 8) g.hitEnemy(e, 'knock');
  }
}

export function shoot(g, p) {
  if (g.bullets.filter((b) => b.owner === p.i).length >= 3) return;
  p.shootCd = 12; sfx('shoot');
  const b = { x: p.x + p.w / 2 + p.face * 14, y: p.y + p.h * 0.45, vx: p.face * 6.5, t: 0, owner: p.i };
  g.bullets.push(b); g.emit({ e: 's', x: b.x, y: b.y, vx: b.vx });
}

function touch(g, p, c, tx, ty) {
  const lv = g.level;
  if (c === 'o' || c === 'h' || c === '*') g.emit({ e: 'p', id: ty * lv.width + tx, c });
  if (c === 'o') { lv.grid[ty][tx] = '.'; g.fruits++; sfx('fruit'); g.particles.sparkle(tx * TS + 16, ty * TS + 16, 3); }
  else if (c === 'h') {
    lv.grid[ty][tx] = '.'; sfx('heart');
    if (p.hearts < 3) { p.hearts++; g.particles.text(tx * TS + 16, ty * TS, '+1 ♥', '#ff6b8a'); } else g.fruits += 3;
    g.particles.sparkle(tx * TS + 16, ty * TS + 16, 6);
  } else if (c === '*') {
    lv.grid[ty][tx] = '.'; g.starSet.add(tx + ',' + ty); sfx('heart');
    g.particles.sparkle(tx * TS + 16, ty * TS + 16, 12); g.particles.text(tx * TS + 16, ty * TS, 'Steluță!', '#ffe066');
  } else if (c === '^') {
    if (p.y + p.h > ty * TS + 14 && p.x + p.w > tx * TS + 5 && p.x < tx * TS + 27) { hurtPlayer(g, p, null); if (p.inv > 100) p.vy = -8; }
  } else if (c === 'V') {
    if (p.y + p.h > ty * TS + 8) toCheckpoint(g, p, true);
  }
}

export function toCheckpoint(g, p, burn) {
  if (p.dead) return;
  sfx(burn ? 'hurt' : 'splash');
  g.particles.burst(p.x + p.w / 2, Math.min(p.y + p.h, WH - 10), burn ? '#ff7a2a' : '#9be7ff', 16);
  g.shake = Math.max(g.shake, 4);
  placePlayer(p, g.cp.x + p.i * 30, g.cp.y); p.inv = 90; p.hurtT = 0;
}

export function updatePlayer(g, p, inp) {
  if (p.dead) { if (--p.respawn <= 0) respawn(g, p); return; }
  const lv = g.level, P = g.particles;
  if (p.inv > 0) p.inv--;
  if (p.hurtT > 0) p.hurtT--;
  if (p.shootCd > 0) p.shootCd--;
  if (p.land > 0) p.land--;
  p.py = p.y;
  if (p.riding) { const ox = p.x; p.x += p.riding.dx; if (overlapsSolid(p, lv)) p.x = ox; p.riding = null; }
  const jump = inp.a || inp.up; p.jumpHeld = jump;
  const wasWater = p.inWater;
  const ev = stepPlayer(p, { left: inp.left, right: inp.right, jump }, lv);
  landOnPlatforms(g, p);
  const cx = p.x + p.w / 2, by = p.y + p.h;
  if (ev.jumped) { sfx('jump'); P.dust(cx, by, 3); }
  if (ev.swam) { sfx('splash'); P.burst(cx, by - 10, 'rgba(180,230,255,.9)', 3); }
  if (ev.sprung) { sfx('jump'); P.sparkle(cx, by, 4); const k = p.groundY * lv.width + p.groundX; lv.fx.spring[k] = 12; }
  if (ev.landed > 5) { p.land = 8; P.dust(cx, by, 3, -1); P.dust(cx, by, 3, 1); if (ev.landed > 10) g.shake = Math.max(g.shake, 1.5); }
  if (ev.bump) bump(g, p, ev.bump);
  if (!wasWater && p.inWater) { sfx('splash'); P.burst(cx, by, 'rgba(180,230,255,.9)', 8); }
  if (p.onGround && Math.abs(p.vx) > 0.3) {
    p.walk += Math.abs(p.vx) * 0.06;
    if ((g.tick & 7) === 0) P.dust(cx, by, 1, -p.face * 0.5);
  } else if (!p.onGround) p.walk = 0;
  if (p.onGround && p.groundTile === 'X') { const k = p.groundY * lv.width + p.groundX; lv.fx.crumb[k] = (lv.fx.crumb[k] || 0) + 2; }
  if (p.wand && inp.b && !p.prevB && p.shootCd <= 0) shoot(g, p);
  p.prevB = inp.b;
  tilesTouched(p, lv, (c, tx, ty) => { if (c !== '.' && tx >= 0 && tx < lv.width) touch(g, p, c, tx, ty); });
  for (const it of g.items) {
    if (it.rise > 0) continue;
    if (Math.abs(it.x - cx) < 20 + p.w / 2 - 6 && Math.abs(it.y - (p.y + p.h / 2)) < 22 + p.h / 2 - 6) {
      if (applyItem(g, p, it)) { it.gone = true; g.emit({ e: 'i', id: it.id }); }
    }
  }
  if (p.x < g.cam.x) { p.x = g.cam.x; if (p.vx < 0) p.vx = 0; }
  if (p.x + p.w > g.cam.x + g.view.vw) { p.x = g.cam.x + g.view.vw - p.w; if (p.vx > 0) p.vx = 0; }
  if (p.y > WH + 40) toCheckpoint(g, p, false);
}

export { tileAt };
