// Inamicii: definiții (sprite-uri, mărimi, comportament) și logica lor la pas fix.
import { TS, ROWS, isStandable } from './tiles.js';
import { moveX, moveY, tileAt, GRAV, MAXF } from './physics.js';
import { sfx } from '../../../shared/engine/audio.js';
import { hurtPlayer } from './player.js';

const WH = ROWS * TS;
const walker = (n, w, h, sp, extra = {}) => ({ k: 'walk', w, h, sp, a: [n + '_a', n + '_b'], ...extra });
/** k = tip de comportament; a = cadre animate; stomp:false = nu poate fi strivit. f = viteza oscilației. */
export const DEF = {
  snail: walker('snail_walk', 28, 22, 0.5, { flat: 'snail_shell' }),
  ladybug: walker('ladybug_walk', 28, 22, 0.7, { flat: 'ladybug_rest' }),
  mouse: walker('mouse_walk', 26, 20, 0.9, { flat: 'mouse_rest' }),
  worm: walker('worm_normal_move', 28, 18, 0.5, { flat: 'worm_normal_rest' }),
  slime_normal: walker('slime_normal_walk', 26, 20, 0.6, { flat: 'slime_normal_flat' }),
  slime_fire: walker('slime_fire_walk', 26, 20, 0.7, { flat: 'slime_fire_flat' }),
  slime_spike: walker('slime_spike_walk', 26, 20, 0.6, { stomp: false }),
  bee: { k: 'osc', w: 26, h: 22, a: ['bee_a', 'bee_b'], f: 0.035, range: 3, flat: 'bee_rest', fly: true },
  fly: { k: 'vert', w: 26, h: 20, a: ['fly_a', 'fly_b'], f: 0.045, range: 3, flat: 'fly_rest', fly: true },
  fish: { k: 'osc', w: 28, h: 18, a: ['fish_blue_swim_a', 'fish_blue_swim_b'], f: 0.03, range: 4, flat: 'fish_blue_rest', fish: true },
  frog: { k: 'frog', w: 26, h: 22, a: ['frog_idle', 'frog_idle'], air: 'frog_jump', flat: 'frog_rest' },
  block: { k: 'block', w: 28, h: 28, a: ['block_idle', 'block_idle'], fall: 'block_fall', rest: 'block_rest', stomp: false },
  saw: { k: 'osc', w: 28, h: 28, a: ['saw_a', 'saw_b'], f: 0.04, range: 3, stomp: false, spin: true },
  fireball: { k: 'fire', w: 16, h: 16, a: ['fireball', 'fireball'], stomp: false, sheet: 'tiles' },
};

export function makeEnemy(s) {
  const d = DEF[s.type];
  if (!d) return null;
  const cx = s.tx * TS + TS / 2, cy = s.ty * TS + TS / 2;
  const e = {
    type: s.type, d, w: d.w, h: d.h, vx: 0, vy: 0, onGround: false, hitWall: false, groundTile: '.', inWater: false,
    dir: -1, t: (s.tx * 7) % 50, dead: 0, knock: false, rot: 0, range: s.range, sx: cx, sy: cy, state: 'idle', timer: 0,
    x: cx - d.w / 2, y: (s.ty + 1) * TS - d.h, y0: 0,
  };
  if (d.fly || d.fish || d.spin) e.y = cy - d.h / 2;
  if (d.k === 'block') e.y = s.ty * TS + 2;
  if (d.k === 'frog') e.timer = 40 + (s.tx * 11) % 50;
  if (d.k === 'fire') { e.y = cy; e.y0 = cy; e.timer = 50 + (s.tx * 13) % 60; }
  e.y0 = d.k === 'block' ? e.y : e.y0;
  return e;
}

/** `id` = poziția în lv.enemies: la fel pe toate dispozitivele, ca să se potrivească în rețea. */
export const spawnEnemies = (lv) => lv.enemies.map((s, i) => { const e = makeEnemy(s); if (e) e.id = i; return e; }).filter(Boolean);

export function killEnemy(g, e, how) {
  if (e.dead || e.knock) return;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  if (how === 'stomp' && e.d.flat) {
    e.dead = 34; e.squashed = true; e.vx = 0; e.vy = 0; sfx('stomp'); g.shake = Math.max(g.shake, 4);
    g.particles.sparkle(cx, cy, 7); g.particles.text(cx, e.y, 'Poc!', '#ffe066');
  } else {
    e.knock = true; e.vy = -6; e.vx = (cx < g.cam.x + 400 ? 1 : -1) * 2; sfx('pop');
    g.particles.sparkle(cx, cy, 6);
  }
}

const near = (g, e) => (g.net ? g.players.some((p) => Math.abs(p.x - e.x) < 900) : e.x > g.cam.x - 200 && e.x < g.cam.x + g.view.vw + 200);

function stepWalker(g, e) {
  const lv = g.level, d = e.d;
  e.vy = Math.min(e.vy + GRAV, MAXF);
  e.vx = e.dir * d.sp;
  moveX(e, lv);
  if (e.hitWall) e.dir = -e.dir;
  moveY(e, lv);
  if (e.onGround) {
    const ax = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
    if (!isStandable(tileAt(lv, Math.floor(ax / TS), Math.floor((e.y + e.h + 2) / TS)))) e.dir = -e.dir;
  }
  if (e.range != null) {
    const off = e.x + e.w / 2 - e.sx, lim = e.range * TS / 2;
    if (off > lim) e.dir = -1; else if (off < -lim) e.dir = 1;
  }
}

function stepFrog(g, e) {
  e.vy = Math.min(e.vy + GRAV, MAXF);
  moveX(e, g.level);
  moveY(e, g.level);
  if (e.onGround) {
    e.vx = 0;
    if (--e.timer <= 0) {
      const p = nearestPlayer(g, e);
      e.dir = p && p.x < e.x ? -1 : 1; e.vy = -9.5; e.vx = e.dir * 2.2; e.timer = 70 + (e.t % 40); e.onGround = false;
    }
  }
}

function nearestPlayer(g, e) {
  let best = null, bd = 1e9;
  for (const p of g.players) if (!p.dead) { const d = Math.abs(p.x - e.x); if (d < bd) { bd = d; best = p; } }
  return best;
}

function stepBlock(g, e) {
  if (e.state === 'idle') {
    for (const p of g.players) if (!p.dead && Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 36 && p.y > e.y && p.y - e.y < TS * 9) { e.state = 'fall'; e.vy = 0; }
  } else if (e.state === 'fall') {
    e.vy = Math.min(e.vy + 0.6, 11); e.y += e.vy;
    const tx = Math.floor((e.x + e.w / 2) / TS), ty = Math.floor((e.y + e.h) / TS);
    if (tileAt(g.level, tx, ty) !== '.' && tileAt(g.level, tx, ty) !== '~' || e.y > WH) {
      e.y = ty * TS - e.h; e.state = 'rest'; e.timer = 70; sfx('bump'); g.shake = Math.max(g.shake, 3);
      g.particles.dust(e.x + e.w / 2, e.y + e.h, 5);
    }
  } else if (e.state === 'rest') { if (--e.timer <= 0) e.state = 'rise'; } else {
    e.y -= 1.2; if (e.y <= e.y0) { e.y = e.y0; e.state = 'idle'; }
  }
}

function stepFire(g, e) {
  if (e.vy === 0 && e.y >= e.y0) { if (--e.timer <= 0) { e.vy = -(11 + (e.sx / TS % 4)); e.timer = 90 + (e.t % 50); } return; }
  e.vy += 0.3; e.y += e.vy;
  if (e.y >= e.y0 && e.vy > 0) { e.y = e.y0; e.vy = 0; }
}

function step(g, e) {
  const d = e.d;
  e.t++;
  if (e.knock) { e.vy += GRAV; e.x += e.vx; e.y += e.vy; e.rot += 0.25 * (e.vx > 0 ? 1 : -1); return; }
  if (e.dead) { e.dead--; return; }
  if (!near(g, e) && d.k !== 'fire') return;
  switch (d.k) {
    case 'walk': stepWalker(g, e); break;
    case 'frog': stepFrog(g, e); break;
    case 'block': stepBlock(g, e); break;
    case 'fire': stepFire(g, e); break;
    case 'osc': {
      const A = (e.range != null ? e.range : d.range) * TS / 2, a = e.t * d.f;
      e.x = e.sx + Math.sin(a) * A - e.w / 2; e.dir = Math.cos(a) > 0 ? 1 : -1;
      e.y = e.sy + (d.fish ? Math.sin(e.t * 0.06) * 5 : d.spin ? 0 : Math.sin(e.t * 0.09) * 7) - e.h / 2; break;
    }
    case 'vert': {
      const A = (e.range != null ? e.range : d.range) * TS / 2;
      e.y = e.sy + Math.sin(e.t * d.f) * A - e.h / 2; e.dir = e.dir || -1; break;
    }
    default: break;
  }
}

const hit = (p, e) => p.x + p.w - 3 > e.x && p.x + 3 < e.x + e.w && p.y + p.h > e.y + 2 && p.y + 3 < e.y + e.h;

export function updateEnemies(g) {
  const list = g.enemies, sim = !g.net || g.net.host; // clientul în rețea doar afișează; gazda simulează
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (sim) step(g, e); else g.net.stepEnemy(e);
    if (e.y > WH + 90 || (e.squashed && e.dead <= 0)) { list.splice(i, 1); continue; }
    if (e.dead || e.knock) continue;
    const d = e.d;
    if (d.k === 'fire' && e.y > e.y0 - 6) continue;
    for (const p of g.sim) {
      if (p.dead || !hit(p, e)) continue;
      if (d.k === 'block' && e.state === 'rest') continue;
      const stomp = d.stomp !== false && p.vy > 0.3 && p.y + p.h - e.y < Math.max(10, e.h * 0.75);
      if (stomp) {
        g.hitEnemy(e, 'stomp');
        p.vy = p.jumpHeld ? -10.5 : -7.5; p.onGround = false;
        break;
      }
      hurtPlayer(g, p, e.x + e.w / 2);
    }
  }
}
