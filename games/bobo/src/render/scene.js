// Randarea unui cadru de joc: fundal, teren, obiecte, personaje, particule, apă, HUD. Stilul („classic”/„modern”) vine din setări.
import { drawChunks, drawTiles, drawWater, resetTerrain } from './terrain.js';
import { drawEnemy, drawBoss, drawPlatforms, drawItems, drawBullets, drawCheckpoints, drawPortal } from './actors.js';
import { drawHero } from './hero.js';
import { drawHud } from '../hud.js';
import { createBackground } from './background.js';
import { drawWorldClassic, drawWaterClassic, createClassicBackground, resetClassicGround } from './classic/index.js';
import { gfxStyle } from './style.js';
import { applyInterp } from './interp.js';

export function resetRender() { resetTerrain(); resetClassicGround(); }

function bgFor(g, style) {
  if (!g.bgs || g.bgsLevel !== g.level) { g.bgs = {}; g.bgsLevel = g.level; }
  return g.bgs[style] || (g.bgs[style] = style === 'classic' ? createClassicBackground(g.level.theme, g.index) : createBackground(g.level.theme, g.index));
}

/** alpha = cât din pasul următor s-a scurs (0–1) pentru interpolare; 1 când simularea stă (pauză, final). */
export function renderScene(ctx, g, alpha = 1) {
  const { vw, vh, scale } = g.view, lv = g.level, t = g.tick, style = gfxStyle();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const { camX, restore } = applyInterp(g, alpha, scale);
  const sh = g.shake > 0.3 ? g.shake : 0;
  ctx.save();
  if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  if (style === 'classic') {
    drawWorldClassic(ctx, g, bgFor(g, 'classic'), camX, vw, vh, scale, t);
  } else {
    bgFor(g, 'modern').draw(ctx, camX, vw, vh, t);
    drawChunks(ctx, lv, g.theme, camX, vw, scale);
    drawTiles(ctx, lv, g.theme, camX, vw, t);
    drawCheckpoints(ctx, lv, g.cpActive, camX, t);
    drawPortal(ctx, lv, !g.boss, camX, t);
    drawPlatforms(ctx, g.platforms, g.theme, camX);
    drawItems(ctx, g.items, camX, t);
    for (const e of g.enemies) if (e.x + e.w > camX - 60 && e.x < camX + vw + 60) drawEnemy(ctx, e, camX, t);
    if (g.boss) drawBoss(ctx, g.boss, camX, t);
    drawBullets(ctx, g.bullets, camX, t);
  }
  const multi = g.players.length > 1;
  for (const p of g.players) drawHero(ctx, p, camX, t, multi);
  g.particles.draw(ctx, camX, 0);
  if (style === 'classic') drawWaterClassic(ctx, g, camX, vw, t); else drawWater(ctx, lv, camX, vw, t);
  ctx.restore();
  restore();
  drawHud(ctx, g);
}
