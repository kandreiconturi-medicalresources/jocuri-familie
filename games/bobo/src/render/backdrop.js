// Fundalul ecranelor de meniu: peisajul lumii alese, care se mișcă încet, și Bobo și Mimi care merg.
import { drawSpr } from '../atlas.js';
import { createBackground } from './background.js';
import { drawHeroBig } from './hero.js';
import { terrainName } from './terrain.js';
import { themeFor } from './themes.js';
import { createClassicBackground, classicTheme, drawGround } from './classic/index.js';
import { gfxStyle } from './style.js';

export function createBackdrop() {
  let key = '', bg = null, th = null, bgStyle = '';
  return {
    set(k) { key = k; bg = null; },
    draw(ctx, view, t) {
      const style = gfxStyle();
      if (!key) key = 'meadow';
      if (!bg || bgStyle !== style) {
        bgStyle = style;
        bg = style === 'classic' ? createClassicBackground(key, 7) : createBackground(key, 7);
        th = style === 'classic' ? classicTheme(key) : themeFor(key);
      }
      const { vw, vh, scale } = view;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const cam = t * 0.9;
      bg.draw(ctx, cam, vw, vh, t);
      const off = -(cam % 32), i0 = Math.floor(cam / 32);
      for (let x = off - 32, i = 0; x < vw + 32; x += 32, i++) {
        if (style === 'classic') {
          drawGround(ctx, th, Math.round(x), vh - 64, true, false, false, i0 + i, 15);
          drawGround(ctx, th, Math.round(x), vh - 32, false, false, false, i0 + i, 16);
          continue;
        }
        drawSpr(ctx, 'tiles', terrainName(th.terrain, false, true, true, true), Math.round(x), vh - 64);
        drawSpr(ctx, 'tiles', terrainName(th.terrain, true, true, true, true), Math.round(x), vh - 32);
      }
      const f = 'w' + (Math.floor(t / 4) & 7);
      drawHeroBig(ctx, 0, vw * 0.12, vh - 64, 90, f);
      drawHeroBig(ctx, 1, vw * 0.88, vh - 64, 90, f);
    },
  };
}
