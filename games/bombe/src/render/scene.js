// Randarea unui cadru: fundal, arenă, elemente dinamice, efecte, întuneric (Peștera) și HUD.
import { W, H } from '../logic/rules.js';
import { perf } from '../../../../shared/engine/perf.js';
import { T, OY, createArenaLayer } from './arena.js';
import { drawBelts, drawPortals, drawLava, drawPickups, drawBombs, drawFlames, drawPlayers } from './actors.js';
import { createFx } from './fx.js';
import { drawHud } from './hud.js';

export function createScene({ ctx, view, particles }) {
  const layer = createArenaLayer();
  const fx = createFx(particles);
  const bombPos = new Map();
  let rp = [];
  const dark = document.createElement('canvas');
  dark.width = Math.round(W * T / 4); dark.height = Math.round(H * T / 4);
  const dctx = dark.getContext('2d');

  function darkness(c, s) {
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = 'rgba(8,6,28,0.88)'; dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r) => {
      const px = x * T / 4, py = y * T / 4, rr = r * T / 4, g = dctx.createRadialGradient(px, py, rr * 0.2, px, py, rr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    };
    for (const p of s.players) if (p.alive) light(p.x, p.y, 3);
    for (const b of s.bombs) light(b.x + 0.5, b.y + 0.5, 2);
    for (const f of s.flames) light((f.i % W) + 0.5, ((f.i / W) | 0) + 0.5, 1.8);
    c.drawImage(dark, 0, 0, W * T, H * T);
  }

  return {
    fx,
    reset() { rp = []; bombPos.clear(); },
    draw(s, ready, hud = true) {
      const now = performance.now() / 1000, ox = Math.round((view.vw - W * T) / 2), c = ctx;
      c.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      const th = s.arena.theme;
      c.fillStyle = th.bg; c.fillRect(0, 0, view.vw, view.vh);
      c.fillStyle = 'rgba(255,255,255,.06)';
      for (let k = 0; k < 9; k++) { c.beginPath(); c.arc((k * 173) % view.vw, (k * 91) % view.vh, 60 + (k % 3) * 30, 0, 7); c.fill(); }
      const [sx, sy] = fx.shake();
      c.save();
      c.translate(ox + sx, OY + sy);
      c.drawImage(layer(s, view.scale), 0, 0, W * T, H * T);
      drawBelts(c, s, now); drawPortals(c, s, now); drawLava(c, s, now);
      drawPickups(c, s, now); drawBombs(c, s, now, bombPos);
      drawPlayers(c, s, now, rp, view.scale);
      drawFlames(c, s, now);
      fx.draw(c);
      if (s.arena.dark && perf.quality() >= 1) darkness(c, s);
      c.restore();
      if (hud) drawHud(c, view, s, ready, ox);
    },
  };
}
