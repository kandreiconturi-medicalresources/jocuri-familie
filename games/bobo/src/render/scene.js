// Randarea unui cadru de joc: fundal, teren, obiecte, personaje, particule, apă, HUD.
import { drawChunks, drawTiles, drawWater } from './terrain.js';
import { drawEnemy, drawBoss, drawPlatforms, drawItems, drawBullets, drawCheckpoints, drawPortal } from './actors.js';
import { drawHero } from './hero.js';
import { drawHud } from '../hud.js';

export function renderScene(ctx, g) {
  const { vw, vh, scale } = g.view, lv = g.level, t = g.tick;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const camX = Math.round(g.cam.x * scale) / scale;
  const sh = g.shake > 0.3 ? g.shake : 0;
  ctx.save();
  if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  g.bg.draw(ctx, camX, vw, vh, t);
  drawChunks(ctx, lv, g.theme, camX, vw, scale);
  drawTiles(ctx, lv, g.theme, camX, vw, t);
  drawCheckpoints(ctx, lv, g.cpActive, camX, t);
  drawPortal(ctx, lv, !g.boss, camX, t);
  drawPlatforms(ctx, g.platforms, g.theme, camX);
  drawItems(ctx, g.items, camX, t);
  for (const e of g.enemies) if (e.x + e.w > camX - 60 && e.x < camX + vw + 60) drawEnemy(ctx, e, camX, t);
  if (g.boss) drawBoss(ctx, g.boss, camX, t);
  drawBullets(ctx, g.bullets, camX, t);
  const multi = g.players.length > 1;
  for (const p of g.players) drawHero(ctx, p, camX, t, multi);
  g.particles.draw(ctx, camX, 0);
  drawWater(ctx, lv, camX, vw, t);
  ctx.restore();
  drawHud(ctx, g);
}
