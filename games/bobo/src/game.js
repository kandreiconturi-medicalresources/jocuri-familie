// Starea jocului în nivel: pornire, pas fix (update), checkpoint-uri, glonțe, obiecte, final de nivel.
import { TS, isSolid } from './tiles.js';
import { tileAt } from './physics.js';
import { getLevel } from './levels/index.js';
import { sfx } from '../../../shared/engine/audio.js';
import { createPlayer, placePlayer, updatePlayer } from './player.js';
import { spawnEnemies, updateEnemies, killEnemy } from './enemies.js';
import { createBoss, updateBoss, hitBoss } from './boss.js';
import { createPlatforms, updatePlatforms } from './platforms.js';
import { createCamera, updateCamera } from './camera.js';
import { createBackground } from './render/background.js';
import { themeFor } from './render/themes.js';
import { resetTerrain } from './render/terrain.js';

const IMMUNE = new Set(['saw', 'block', 'fireball']);

export function createGame({ input, view, particles, onFinish }) {
  const g = {
    view, input, particles, players: [], enemies: [], items: [], bullets: [], platforms: [], crumbs: [], boss: null,
    level: null, index: 0, tick: 0, shake: 0, cam: createCamera(), fruits: 0, starSet: new Set(), cp: { x: 0, y: 0 },
    cpActive: new Set(), bossDown: false, bossIntro: 0, hint: 0, hintText: '', done: false, theme: null, bg: null,
  };

  g.start = (index, n) => {
    const lv = getLevel(index);
    lv.grid = lv.grid.map((r) => (typeof r === 'string' ? r.split('') : r.slice()));
    lv.fx = { bump: {}, crumb: {}, spring: {} };
    Object.assign(g, {
      level: lv, index, theme: themeFor(lv.theme), bg: createBackground(lv.theme, index), tick: 0, shake: 0, fruits: 0,
      starSet: new Set(), items: [], bullets: [], crumbs: [], done: false, bossDown: false, bossIntro: 0, hint: 0,
      cpActive: new Set(), cp: { x: lv.spawn.tx * TS, y: lv.spawn.ty * TS },
    });
    resetTerrain();
    g.enemies = spawnEnemies(lv); g.platforms = createPlatforms(lv); g.boss = createBoss(lv);
    g.players = Array.from({ length: n }, (_, i) => {
      const p = createPlayer(i); placePlayer(p, g.cp.x + i * 30, g.cp.y); p.face = 1; return p;
    });
    g.cam.x = 0; g.cam.look = 0; updateCamera(g, true);
    g.particles.update();
    g.say(n > 1 ? 'Împreună ajungeți mai departe!' : 'Hai la aventură!', 120);
  };

  g.say = (s, frames = 120) => { g.hintText = s; g.hint = frames; };

  function readInputs() {
    if (g.players.length > 1) return [input.read(0), input.read(1)];
    const a = input.read(0), b = input.read(1), o = {};
    for (const k in a) o[k] = a[k] || b[k];
    return [o];
  }

  function updateFx() {
    const lv = g.level, fx = lv.fx;
    for (const m of [fx.bump, fx.spring]) for (const k in m) if (--m[k] <= 0) delete m[k];
    for (const k in fx.crumb) {
      const v = fx.crumb[k] - 1;
      if (v <= 0) { delete fx.crumb[k]; continue; }
      fx.crumb[k] = v;
      if (v >= 30) {
        const tx = k % lv.width, ty = Math.floor(k / lv.width);
        lv.grid[ty][tx] = '.'; g.crumbs.push({ tx, ty, t: 180 }); delete fx.crumb[k];
        sfx('bump'); g.particles.burst(tx * TS + 16, ty * TS + 16, '#c89a5a', 8); g.particles.dust(tx * TS + 16, ty * TS + 24, 3);
      }
    }
    for (let i = g.crumbs.length - 1; i >= 0; i--) {
      const c = g.crumbs[i];
      if (--c.t > 0) continue;
      const busy = g.players.some((p) => !p.dead && p.x < (c.tx + 1) * TS && p.x + p.w > c.tx * TS && p.y < (c.ty + 1) * TS && p.y + p.h > c.ty * TS);
      if (busy) { c.t = 10; continue; }
      lv.grid[c.ty][c.tx] = 'X'; g.crumbs.splice(i, 1);
    }
  }

  function updateBullets() {
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i];
      b.x += b.vx; b.t++;
      let dead = b.t > 80 || isSolid(tileAt(g.level, Math.floor(b.x / TS), Math.floor(b.y / TS)));
      if (!dead) {
        for (const e of g.enemies) {
          if (e.dead || e.knock || IMMUNE.has(e.type)) continue;
          if (Math.abs(b.x - (e.x + e.w / 2)) < e.w / 2 + 6 && Math.abs(b.y - (e.y + e.h / 2)) < e.h / 2 + 6) { killEnemy(g, e, 'knock'); dead = true; break; }
        }
        const bo = g.boss;
        if (!dead && bo && !bo.dead && bo.state !== 'sleep' && b.x > bo.x && b.x < bo.x + bo.w && b.y > bo.y && b.y < bo.y + bo.h) { hitBoss(g); dead = true; }
      }
      if (dead) { g.particles.sparkle(b.x, b.y, 3); g.bullets.splice(i, 1); }
    }
  }

  function updateMisc() {
    const lv = g.level;
    for (let i = g.items.length - 1; i >= 0; i--) {
      const it = g.items[i];
      if (it.rise > 0) { it.rise--; it.y += (it.ty0 - it.y) * 0.18; if (it.rise === 0) it.y = it.ty0; }
      if (it.gone) g.items.splice(i, 1);
    }
    lv.checkpoints.forEach((c, i) => {
      if (g.cpActive.has(i)) return;
      const hit = g.players.find((p) => !p.dead && p.x + p.w / 2 > c.tx * TS);
      if (hit && Math.abs(hit.y + hit.h - c.ty * TS) < 200) {
        g.cpActive.add(i); g.cp = { x: c.tx * TS, y: c.ty * TS }; sfx('check');
        g.particles.sparkle(c.tx * TS + 16, c.ty * TS - 30, 10); g.particles.text(c.tx * TS + 16, c.ty * TS - 50, 'Punct salvat!', '#a8ffb0');
      }
    });
    if (g.boss || g.done) return;
    const px = lv.portal.tx * TS + TS / 2, py = lv.portal.ty * TS;
    for (const p of g.players) {
      if (p.dead || Math.abs(p.x + p.w / 2 - px) > 36 || p.y + p.h < py - 80 || p.y > py + 6) continue;
      g.done = true; sfx('win');
      g.particles.sparkle(px, py - 40, 24);
      onFinish({ index: g.index, stars: Math.min(3, g.starSet.size), fruits: g.fruits, players: g.players.length });
      break;
    }
  }

  g.update = () => {
    g.tick++;
    g.shake *= 0.85;
    if (!g.done) {
      const inps = readInputs();
      updatePlatforms(g); updateFx();
      g.players.forEach((p, i) => updatePlayer(g, p, inps[i]));
      updateEnemies(g); updateBoss(g); updateBullets(); updateMisc();
    } else {
      for (const p of g.players) { p.vx *= 0.9; }
    }
    g.particles.update();
    updateCamera(g, false);
  };

  return g;
}
