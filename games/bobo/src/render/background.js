// Fundal cu paralaxă pe lume: cer, soare/lună, straturi Kenney, dealuri vectoriale, nori, particule ambientale.
import { sheetImage, frameRect, makeCanvas, getScale } from '../atlas.js';
import { perf } from '../../../../shared/engine/perf.js';
import { rng } from '../../../../shared/engine/rng.js';
import { themeFor } from './themes.js';
import { icon, circ, ell } from './sprites.js';

const PERIOD = 1024;

function tinted(name, tint) {
  const r = frameRect('bg', name);
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  x.drawImage(sheetImage('bg'), r[0], r[1], r[2], r[3], 0, 0, 256, 256);
  // Fundalurile Kenney au cerul alb opac: îl facem transparent, ca să se vadă cerul nostru.
  try {
    const d = x.getImageData(0, 0, 256, 256), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i] > 240 && p[i + 1] > 240 && p[i + 2] > 240) p[i + 3] = 0;
    x.putImageData(d, 0, 0);
  } catch (e) { /* canvas „tainted” – lăsăm așa */ }
  if (tint) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = tint[1]; x.fillStyle = tint[0]; x.fillRect(0, 0, 256, 256); }
  return c;
}

function hillStrip(color, hi, amp, f1, f2, ph, h, sc) {
  const c = makeCanvas(PERIOD * sc, h * sc), x = c.getContext('2d');
  x.scale(sc, sc);
  const y = (px) => h * 0.45 - Math.sin(px / PERIOD * 6.2832 * f1 + ph) * amp - Math.sin(px / PERIOD * 6.2832 * f2 + ph * 2) * amp * 0.4;
  x.beginPath(); x.moveTo(0, h);
  for (let px = 0; px <= PERIOD; px += 16) x.lineTo(px, y(px));
  x.lineTo(PERIOD, h); x.closePath(); x.fillStyle = color; x.fill();
  x.strokeStyle = hi; x.lineWidth = 4; x.beginPath();
  for (let px = 0; px <= PERIOD; px += 16) { if (px) x.lineTo(px, y(px) + 2); else x.moveTo(px, y(px) + 2); }
  x.stroke();
  return c;
}

export function createBackground(key, seed = 1) {
  const th = themeFor(key), R = rng(seed + key.length * 97);
  let far = null, near = null, clouds = null, strips = null, lastScale = 0;
  const cl = Array.from({ length: 9 }, (_, i) => ({ x: R.range(0, 2400), y: R.range(30, 200), s: R.range(0.5, 1), v: R.range(0.1, 0.35), k: i % 2 ? 'cloud' : 'cloud2' }));
  const fl = Array.from({ length: 28 }, () => ({ x: R.next(), y: R.next(), s: R.range(0.4, 1.4), p: R.range(0, 6) }));

  function prep() {
    lastScale = getScale();
    if (th.set === 'clouds') { near = tinted('background_clouds', null); far = null; } else {
      far = tinted('background_fade_' + th.set, th.tint); near = tinted('background_color_' + th.set, th.tint);
    }
    const sc = Math.min(2, Math.max(1, lastScale));
    strips = [hillStrip(th.hills[0], 'rgba(255,255,255,.25)', 34, 2, 5, 0.7, 220, sc), hillStrip(th.hills[1], 'rgba(255,255,255,.3)', 26, 3, 7, 2.1, 190, sc)];
  }

  function band(ctx, img, par, camX, vw, vh, h, alpha, srcW = 256) {
    const tw = h * srcW / img.height;
    let x = -((camX * par) % tw);
    ctx.globalAlpha = alpha;
    for (; x < vw; x += tw - 0.5) ctx.drawImage(img, x, vh - h, tw, h);
    ctx.globalAlpha = 1;
  }
  function strip(ctx, img, par, camX, vw, vh, h) {
    let x = -((camX * par) % PERIOD);
    for (; x < vw; x += PERIOD) ctx.drawImage(img, x, vh - h, PERIOD, h);
  }

  function sun(ctx, vw, vh, t, q) {
    const kind = th.sun;
    if (kind === 'day' || kind === 'sunset' || kind === 'lava') {
      const sx = kind === 'day' ? vw * 0.8 : vw * 0.7, sy = kind === 'day' ? 90 : vh - 210;
      const g = ctx.createRadialGradient(sx, sy, 8, sx, sy, kind === 'day' ? 120 : 190);
      g.addColorStop(0, kind === 'lava' ? 'rgba(255,120,40,.8)' : 'rgba(255,245,180,.9)'); g.addColorStop(1, 'rgba(255,245,180,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 200, sy - 200, 400, 400);
      ctx.fillStyle = kind === 'day' ? '#fff3a0' : kind === 'lava' ? '#ff7a2a' : '#ffd08a'; circ(ctx, sx, sy, kind === 'day' ? 34 : 54);
      if (q > 1 && kind === 'day') {
        ctx.strokeStyle = 'rgba(255,255,200,.25)'; ctx.lineWidth = 6;
        for (let i = 0; i < 10; i++) { const a = t * 0.004 + i * 0.628; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 46, sy + Math.sin(a) * 46); ctx.lineTo(sx + Math.cos(a) * 78, sy + Math.sin(a) * 78); ctx.stroke(); }
      }
    } else if (kind === 'moon') {
      ctx.fillStyle = '#f4f8d8'; circ(ctx, vw * 0.78, 80, 30); ctx.fillStyle = 'rgba(23,60,99,.9)'; circ(ctx, vw * 0.78 + 12, 72, 26);
    }
    if (kind === 'moon' || kind === 'crystal') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 24; i++) { const f = fl[i]; ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 0.03 + f.p)); circ(ctx, f.x * vw, f.y * vh * 0.55, f.s); }
      ctx.globalAlpha = 1;
    }
  }

  function ambient(ctx, camX, vw, vh, t, q) {
    const n = [0, 12, 28][q];
    if (!th.ambient || !n) return;
    const a = th.ambient;
    for (let i = 0; i < n; i++) {
      const f = fl[i];
      let x = ((f.x * vw + Math.sin(t * 0.02 + f.p) * 20 - camX * 0.3 * f.s) % vw + vw) % vw, y;
      if (a === 'snow') { y = ((f.y * vh + t * (0.6 + f.s * 0.6)) % vh); ctx.fillStyle = 'rgba(255,255,255,.85)'; circ(ctx, x, y, f.s * 2.2); }
      else if (a === 'ember') { y = vh - ((f.y * vh + t * (0.5 + f.s)) % vh); ctx.fillStyle = `rgba(255,${120 + (i * 17) % 100},40,.8)`; circ(ctx, x, y, f.s * 1.8); }
      else if (a === 'leaf') { y = ((f.y * vh + t * 0.5 * f.s) % vh); ctx.fillStyle = 'rgba(160,230,120,.6)'; ell(ctx, x, y, 4, 2, t * 0.03 + f.p); }
      else { y = f.y * vh * 0.9 + Math.sin(t * 0.02 + f.p) * 10; ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.04 + f.p)); ctx.fillStyle = a === 'glow' ? '#b890ff' : '#ffd0f0'; circ(ctx, x, y, f.s * 2); ctx.globalAlpha = 1; }
    }
  }

  return {
    draw(ctx, camX, vw, vh, t) {
      const q = perf.quality();
      if (!far && !near || lastScale !== getScale()) prep();
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      sun(ctx, vw, vh, t, q);
      if (q > 0 && far) band(ctx, far, 0.08, camX, vw, vh, 330, 0.9);
      if (q > 0) {
        for (const c of cl) {
          const x = (((c.x - camX * 0.15 - t * c.v) % 2400) + 2400) % 2400 - 150;
          if (x < vw) { ctx.globalAlpha = th.sun === 'crystal' ? 0.25 : 0.9; ctx.drawImage(icon(c.k), x, c.y, 100 * c.s * 1.5, 60 * c.s * 1.5); }
        }
        ctx.globalAlpha = 1;
      }
      strip(ctx, strips[0], 0.22, camX, vw, vh, 220);
      if (near) band(ctx, near, 0.38, camX, vw, vh, th.set === 'clouds' ? vh : 300, 1);
      strip(ctx, strips[1], 0.55, camX, vw, vh, 190);
      ambient(ctx, camX, vw, vh, t, q);
    },
  };
}
