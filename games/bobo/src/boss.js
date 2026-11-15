// Boss-ul generic (level.boss): 3 comportamente: umblă și sare, zboară și plonjează, sare și face undă de șoc.
import { TS } from './tiles.js';
import { makeBody, moveX, moveY, GRAV, MAXF } from './physics.js';
import { sfx } from '../../../shared/engine/audio.js';
import { DEF } from './enemies.js';
import { hurtPlayer } from './player.js';

const WORLD_BEHAV = ['jump', 'jump', 'fly', 'jump', 'fly', 'shock', 'jump', 'shock', 'shock', 'shock'];
const TYPE_BEHAV = { bee: 'fly', fly: 'fly', fish: 'fly', frog: 'shock', block: 'shock', slime_normal: 'shock', slime_fire: 'shock', slime_spike: 'shock' };
export const BOSS_W = 72, BOSS_H = 64;

export function createBoss(lv) {
  if (!lv.boss) return null;
  const type = String(lv.boss.type || '').replace(/^(giant_|boss_)/, '');
  const key = DEF[type] ? type : 'slime_normal';
  const floorY = lv.portal.ty * TS;
  const b = Object.assign(makeBody((lv.portal.tx - 10) * TS, floorY - BOSS_H, BOSS_W, BOSS_H), {
    type: key, d: DEF[key], behav: lv.boss.behavior || TYPE_BEHAV[key] || WORLD_BEHAV[lv.world] || 'jump',
    hp: lv.boss.hp || 4, max: lv.boss.hp || 4, inv: 0, state: 'sleep', t: 0, timer: 60, dir: -1, mul: 1, dead: 0,
    waves: [], L: (lv.portal.tx - 18) * TS, R: (lv.portal.tx + 3) * TS, floorY, homeY: floorY - BOSS_H - 150, air: false, face: -1,
  });
  return b;
}

function damage(g, b, p) {
  if (b.inv > 0) return;
  b.hp--; b.inv = 60; sfx('stomp'); g.shake = Math.max(g.shake, 6);
  b.mul = Math.min(2, 1 + 0.3 * (b.max - b.hp));
  g.particles.sparkle(b.x + b.w / 2, b.y + 10, 10); g.particles.text(b.x + b.w / 2, b.y - 6, b.hp > 0 ? 'Aoleu!' : 'Gata!', '#ffe066');
  if (b.hp <= 0) { b.dead = 80; b.state = 'dead'; sfx('win'); }
  if (b.state === 'rest') b.timer = Math.min(b.timer, 10);
}
export function hitBoss(g, p) { const b = g.boss; if (b && b.state !== 'sleep' && !b.dead) damage(g, b, p); }
/** În rețea, clientul nu scade viața boss-ului: raportează gazdei lovitura. */
const strike = (g, b, p) => { if (g.net && !g.net.host) g.net.hit(-1, 'boss'); else damage(g, b, p); };

const nearest = (g, b) => {
  let best = null, bd = 1e9;
  for (const p of g.players) if (!p.dead) { const d = Math.abs(p.x - b.x); if (d < bd) { bd = d; best = p; } }
  return best;
};

function walkBody(g, b) {
  b.vy = Math.min(b.vy + GRAV, MAXF);
  moveX(b, g.level); moveY(b, g.level);
  if (b.x < b.L) { b.x = b.L; b.dir = 1; } else if (b.x + b.w > b.R) { b.x = b.R - b.w; b.dir = -1; }
}

function wave(g, b, dir) {
  b.waves.push({ x: b.x + b.w / 2, y: b.floorY, vx: dir * 3.4, t: 0 });
}

const behaviours = {
  jump(g, b, tgt) {
    b.dir = tgt ? (tgt.x < b.x ? -1 : 1) : b.dir;
    b.vx = b.dir * 1.1 * b.mul;
    if (b.onGround && --b.timer <= 0) { b.vy = -11.5; b.timer = 75 / b.mul; sfx('jump'); }
    walkBody(g, b);
  },
  shock(g, b, tgt) {
    b.vx *= 0.9;
    if (b.onGround) {
      if (b.air) { b.air = false; wave(g, b, -1); wave(g, b, 1); sfx('break'); g.shake = Math.max(g.shake, 7); g.particles.dust(b.x + b.w / 2, b.y + b.h, 8); }
      else if (--b.timer <= 0) { b.dir = tgt ? (tgt.x < b.x ? -1 : 1) : b.dir; b.vy = -13.5; b.vx = b.dir * 1.6 * b.mul; b.air = true; b.timer = 90 / b.mul; sfx('jump'); }
    }
    walkBody(g, b);
  },
  fly(g, b, tgt) {
    const cx = b.x + b.w / 2;
    if (b.state === 'fight') {
      b.y = b.homeY + Math.sin(b.t * 0.05) * 14;
      if (tgt) { const d = tgt.x + tgt.w / 2 - cx; b.x += Math.max(-2, Math.min(2, d * 0.04)) * b.mul; b.dir = d < 0 ? -1 : 1; }
      if (--b.timer <= 0) { b.state = 'dive'; b.vy = 0; b.timer = 0; b.tx = tgt ? tgt.x : b.x; sfx('shoot'); }
    } else if (b.state === 'dive') {
      b.vy += 0.6 * b.mul; b.y += b.vy; b.x += Math.max(-3, Math.min(3, (b.tx - b.x) * 0.06));
      if (b.y + b.h >= b.floorY) {
        b.y = b.floorY - b.h; b.state = 'rest'; b.timer = 60; sfx('bump'); g.shake = Math.max(g.shake, 6);
        g.particles.dust(cx, b.floorY, 8);
      }
    } else if (b.state === 'rest') { if (--b.timer <= 0) b.state = 'rise'; }
    else if (b.state === 'rise') { b.y -= 3; if (b.y <= b.homeY) { b.state = 'fight'; b.timer = 110 / b.mul; } }
    b.x = Math.max(b.L, Math.min(b.R - b.w, b.x));
  },
};

const hit = (p, b) => p.x + p.w - 4 > b.x + 6 && p.x + 4 < b.x + b.w - 6 && p.y + p.h > b.y + 4 && p.y + 4 < b.y + b.h;

/** Undele de șoc rănesc jucătorii simulați local (în rețea, fiecare client își verifică propriul jucător). */
export function waveHits(g, b) {
  for (const w of b.waves) {
    for (const p of g.sim) {
      if (!p.dead && p.x + p.w > w.x - 10 && p.x < w.x + 10 && p.y + p.h > w.y - 22 && p.y < w.y) hurtPlayer(g, p, w.x);
    }
  }
}

export function bodyHits(g, b) {
  for (const p of g.sim) {
    if (p.dead || !hit(p, b)) continue;
    if (p.vy > 0.3 && p.y + p.h - b.y < 30) { strike(g, b, p); p.vy = -10.5; p.onGround = false; if (b.hp <= 0) break; } else if (b.inv < 30) hurtPlayer(g, p, b.x + b.w / 2);
  }
}

export function updateBoss(g) {
  const b = g.boss;
  if (!b) return;
  b.t++;
  if (b.inv > 0) b.inv--;
  for (let i = b.waves.length - 1; i >= 0; i--) {
    const w = b.waves[i]; w.x += w.vx; w.t++;
    if (w.t > 100 || w.x < b.L - 100 || w.x > b.R + 100) { b.waves.splice(i, 1); continue; }
  }
  waveHits(g, b);
  if (b.dead) {
    b.dead--;
    if (b.dead % 6 === 0) { g.particles.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, '#ffd23f', 8); g.particles.sparkle(b.x + b.w / 2, b.y + b.h / 2, 4); }
    if (b.dead === 0) {
      g.boss = null; g.bossDown = true; g.shake = 8; sfx('check');
      g.particles.sparkle(g.level.portal.tx * TS + 16, g.level.portal.ty * TS - 40, 20);
    }
    return;
  }
  if (b.state === 'sleep') {
    if (g.players.some((p) => !p.dead && p.x > b.L + 120)) { b.state = 'fight'; b.timer = 80; g.bossIntro = 90; }
    walkBody(g, Object.assign(b, { vx: 0 }));
    return;
  }
  behaviours[b.behav](g, b, nearest(g, b));
  b.face = b.dir;
  bodyHits(g, b);
}
