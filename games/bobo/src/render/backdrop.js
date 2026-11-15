// Fundalul ecranelor de meniu: peisajul lumii alese, care se mișcă încet, și Bobo și Mimi care merg.
import { drawSpr } from '../atlas.js';
import { createBackground } from './background.js';
import { drawHeroBig } from './hero.js';
import { terrainName } from './terrain.js';
import { themeFor } from './themes.js';

export function createBackdrop() {
  let key = '', bg = null, th = null;
  return {
    set(k) { if (k !== key) { key = k; bg = createBackground(k, 7); th = themeFor(k); } },
    draw(ctx, view, t) {
      if (!bg) this.set('meadow');
      const { vw, vh, scale } = view;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const cam = t * 0.9;
      bg.draw(ctx, cam, vw, vh, t);
      const off = -(cam % 32);
      for (let x = off - 32; x < vw + 32; x += 32) {
        drawSpr(ctx, 'tiles', terrainName(th.terrain, false, true, true, true), Math.round(x), vh - 64);
        drawSpr(ctx, 'tiles', terrainName(th.terrain, true, true, true, true), Math.round(x), vh - 32);
      }
      const f = 'w' + (Math.floor(t / 4) & 7);
      drawHeroBig(ctx, 0, vw * 0.12, vh - 64, 90, f);
      drawHeroBig(ctx, 1, vw * 0.88, vh - 64, 90, f);
    },
  };
}
