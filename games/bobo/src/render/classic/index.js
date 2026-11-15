// Stilul „Clasic”: tot ce e desenat în cod, în ordinea din original. Alege paleta după tema nivelului.
import { createClassicBackground } from './background.js';
import { classicTheme } from './palette.js';
import { drawGroundChunks, resetClassicGround, drawGround } from './ground.js';
import { drawTilesClassic, drawPitWater, drawWaterTiles } from './tiles.js';
import { buildDecor, drawDecor } from './decor.js';
import { drawChecksClassic, drawPlatformsClassic, drawBulletsClassic } from './props.js';
import { drawEnemyClassic, drawBossClassic } from './creatures.js';
import { drawItems, drawPortal } from '../actors.js';

export { createClassicBackground, classicTheme, resetClassicGround, drawGround };

/** Tot ce se desenează înaintea personajelor. */
export function drawWorldClassic(ctx, g, bg, camX, vw, vh, scale, t) {
  const lv = g.level, th = classicTheme(lv.theme);
  bg.draw(ctx, camX, vw, vh, t);
  drawPitWater(ctx, th, camX, vw, t);
  drawGroundChunks(ctx, lv, th, camX, vw, scale);
  drawTilesClassic(ctx, lv, th, camX, vw, t);
  if (!lv._decor) lv._decor = buildDecor(lv, th);
  drawDecor(ctx, th, lv._decor, camX, vw, t);
  drawChecksClassic(ctx, lv, g.cpActive, camX, t);
  drawPortal(ctx, lv, !g.boss, camX, t);
  drawPlatformsClassic(ctx, th, g.platforms, camX);
  drawItems(ctx, g.items, camX, t);
  for (const e of g.enemies) if (e.x + e.w > camX - 60 && e.x < camX + vw + 60) drawEnemyClassic(ctx, e, camX, t);
  if (g.boss) drawBossClassic(ctx, g.boss, camX, t);
  drawBulletsClassic(ctx, g.bullets, camX, t);
}

export function drawWaterClassic(ctx, g, camX, vw, t) {
  drawWaterTiles(ctx, g.level, classicTheme(g.level.theme), camX, vw, t);
}
