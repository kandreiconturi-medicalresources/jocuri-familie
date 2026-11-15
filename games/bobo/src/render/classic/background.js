// Fundalul clasic: cer, soare/stele, munți, nori, păsări, dealuri cu copaci (pre-randate pe benzi care se repetă), efecte ambientale.
import { makeCanvas, getScale } from '../../atlas.js';
import { perf } from '../../../../../shared/engine/perf.js';
import { rng } from '../../../../../shared/engine/rng.js';
import { classicTheme } from './palette.js';
import { ell, circ, rr, hash, TAU } from './draw.js';

const WH = 544, P = 2800; // înălțimea lumii; perioada benzilor de dealuri (întreg pentru frecvențe, ca să se repete fără cusătură)

/** Înălțimea dealului: ca în original, dar cu frecvențe întregi pe perioada P. */
const hillY = (xw, base, amp, k, ph) => {
  const f = TAU * k / P, f2 = TAU * Math.round(k * 2.3) / P;
  return base - (Math.sin(xw * f + ph) * 0.5 + 0.5) * amp - (Math.sin(xw * f2 + ph * 2) * 0.5 + 0.5) * amp * 0.4;
};

function tree(c, th, kind, sx, y, s, k) {
  c.fillStyle = th.trunk;
  if (kind === 'pine') {
    c.fillRect(sx - 3 * s, y - 22 * s, 6 * s, 24 * s);
    c.fillStyle = th.tree;
    for (let n = 0; n < 3; n++) { c.beginPath(); c.moveTo(sx, y - (70 - n * 16) * s); c.lineTo(sx - (16 + n * 5) * s, y - (30 - n * 10) * s); c.lineTo(sx + (16 + n * 5) * s, y - (30 - n * 10) * s); c.closePath(); c.fill(); }
    c.fillStyle = th.treeHi; c.beginPath(); c.moveTo(sx, y - 70 * s); c.lineTo(sx - 8 * s, y - 52 * s); c.lineTo(sx, y - 54 * s); c.closePath(); c.fill();
  } else if (kind === 'cactus') {
    c.fillStyle = th.tree; rr(c, sx - 5 * s, y - 46 * s, 10 * s, 48 * s, 5 * s); c.fill();
    rr(c, sx - 17 * s, y - 34 * s, 8 * s, 18 * s, 4 * s); c.fill(); c.fillRect(sx - 17 * s, y - 20 * s, 14 * s, 6 * s);
    rr(c, sx + 9 * s, y - 40 * s, 8 * s, 18 * s, 4 * s); c.fill(); c.fillRect(sx + 3 * s, y - 26 * s, 12 * s, 6 * s);
    c.fillStyle = th.treeHi; c.fillRect(sx - 2 * s, y - 42 * s, 2.5 * s, 38 * s);
  } else if (kind === 'palm') {
    c.strokeStyle = th.trunk; c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx, y + 2); c.quadraticCurveTo(sx + 10 * s, y - 30 * s, sx + 4 * s, y - 56 * s); c.stroke();
    c.lineWidth = 1; c.fillStyle = th.tree;
    for (let n = -2; n <= 2; n++) {
      c.beginPath(); c.moveTo(sx + 4 * s, y - 56 * s); c.quadraticCurveTo(sx + 4 * s + n * 14 * s, y - 76 * s - Math.abs(n) * -3 * s, sx + 4 * s + n * 26 * s, y - 52 * s - Math.abs(n) * 4 * s);
      c.quadraticCurveTo(sx + 4 * s + n * 14 * s, y - 64 * s, sx + 4 * s, y - 56 * s); c.fill();
    }
    c.fillStyle = th.treeHi; circ(c, sx + 4 * s, y - 56 * s, 3 * s);
  } else if (kind === 'crystal') {
    for (let n = -1; n <= 1; n++) {
      const h = (n ? 30 : 48) * s, w = (n ? 7 : 9) * s, bx = sx + n * 11 * s;
      c.fillStyle = th.tree; c.beginPath(); c.moveTo(bx - w, y + 2); c.lineTo(bx - w * 0.7, y - h * 0.7); c.lineTo(bx, y - h); c.lineTo(bx + w * 0.7, y - h * 0.7); c.lineTo(bx + w, y + 2); c.closePath(); c.fill();
      c.fillStyle = th.treeHi; c.beginPath(); c.moveTo(bx, y - h); c.lineTo(bx - w * 0.7, y - h * 0.7); c.lineTo(bx - w * 0.3, y - 4); c.lineTo(bx, y - 4); c.closePath(); c.fill();
    }
  } else if (kind === 'mushroom') {
    c.fillRect(sx - 6 * s, y - 30 * s, 12 * s, 32 * s);
    c.fillStyle = th.tree; c.beginPath(); c.ellipse(sx, y - 32 * s, 28 * s, 22 * s, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = th.treeHi; circ(c, sx - 10 * s, y - 40 * s, 4.5 * s); circ(c, sx + 9 * s, y - 46 * s, 3.5 * s); circ(c, sx + 14 * s, y - 36 * s, 3 * s);
  } else if (kind === 'puff') {
    c.fillStyle = th.hill2; circ(c, sx - 14 * s, y - 14 * s, 14 * s); circ(c, sx + 14 * s, y - 14 * s, 14 * s); circ(c, sx, y - 22 * s, 18 * s);
    c.fillStyle = th.tree; circ(c, sx - 14 * s, y - 16 * s, 12 * s); circ(c, sx + 14 * s, y - 16 * s, 12 * s); circ(c, sx, y - 24 * s, 16 * s);
  } else if (kind === 'ash') {
    c.fillStyle = th.tree; c.beginPath(); c.moveTo(sx - 12 * s, y + 2); c.lineTo(sx - 5 * s, y - 40 * s); c.lineTo(sx, y - 26 * s); c.lineTo(sx + 6 * s, y - 52 * s); c.lineTo(sx + 12 * s, y + 2); c.closePath(); c.fill();
    c.fillStyle = th.treeHi; c.fillRect(sx + 6 * s, y - 52 * s, 1.5 * s, 40 * s);
    c.fillStyle = 'rgba(255,120,40,.7)'; circ(c, sx + 6 * s, y - 52 * s, 2.2 * s);
  } else {
    c.fillRect(sx - 3 * s, y - 22 * s, 6 * s, 24 * s);
    c.fillStyle = th.tree; circ(c, sx, y - 34 * s, 18 * s); circ(c, sx - 11 * s, y - 26 * s, 13 * s); circ(c, sx + 11 * s, y - 26 * s, 13 * s);
    c.fillStyle = th.treeHi; circ(c, sx - 5 * s, y - 40 * s, 8 * s);
  }
}

/** O bandă de deal care se repetă la fiecare P px. */
function hillStrip(th, color, hi, base, amp, k, ph, trees, sc) {
  const top = Math.floor(base - amp * 1.4 - (trees ? 100 : 6)), h = WH - top + 4;
  const cv = makeCanvas(P * sc, h * sc), c = cv.getContext('2d');
  c.scale(sc, sc); c.translate(0, -top);
  c.fillStyle = color; c.beginPath(); c.moveTo(0, WH + 40);
  for (let x = 0; x <= P; x += 8) c.lineTo(x, hillY(x, base, amp, k, ph));
  c.lineTo(P, WH + 40); c.closePath(); c.fill();
  c.strokeStyle = hi; c.lineWidth = 4; c.beginPath();
  for (let x = 0; x <= P; x += 8) { const y = hillY(x, base, amp, k, ph) + 2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  if (trees) {
    const sp = P / 30;
    for (let n = 0; n < 30; n++) {
      if (hash(n, 8) < 0.35) continue;
      const xw = n * sp + hash(n, 9) * 50, y = hillY(xw % P, base, amp, k, ph) + 4, s = 0.7 + hash(n, 10) * 0.6;
      for (const o of [0, -P]) tree(c, th, th.trees, xw + o, y, s, n);
    }
  }
  return { cv, top, h };
}

function cloudSprite() {
  const cv = makeCanvas(208, 152), c = cv.getContext('2d');
  c.translate(52, 84); c.scale(2, 2);
  const s = 1, x = 0, y = 0;
  c.fillStyle = 'rgba(190,215,240,.55)'; circ(c, x + 4 * s, y + 8 * s, 20 * s); circ(c, x + 30 * s, y + 4 * s, 24 * s); circ(c, x + 54 * s, y + 8 * s, 20 * s);
  c.fillStyle = '#fff'; circ(c, x, y, 22 * s); circ(c, x + 24 * s, y - 12 * s, 27 * s); circ(c, x + 50 * s, y - 2 * s, 22 * s);
  rr(c, x - 12 * s, y - 4 * s, 84 * s, 22 * s, 11 * s); c.fill();
  return cv;
}

function sunDisc(th) {
  const lava = th.sun === 'lava';
  const cv = makeCanvas(300, 300), c = cv.getContext('2d');
  c.fillStyle = lava ? 'rgba(255,110,40,.35)' : 'rgba(255,220,150,.3)'; circ(c, 150, 150, 150);
  const sg = c.createLinearGradient(0, 40, 0, 260);
  sg.addColorStop(0, lava ? '#ffd060' : '#fff3a0'); sg.addColorStop(1, lava ? '#ff3a10' : '#ff6f61');
  c.save(); c.beginPath(); c.arc(150, 150, 110, 0, TAU); c.clip(); c.fillStyle = sg; c.fillRect(40, 40, 220, 220);
  c.fillStyle = th.sky[1]; for (let k = 0; k < 6; k++) c.fillRect(40, 160 + k * 16, 220, 3 + k * 1.4);
  c.restore();
  return cv;
}

export function createClassicBackground(key, seed = 1) {
  const th = classicTheme(key), R = rng(seed + key.length * 97);
  const clouds = Array.from({ length: 14 }, (_, i) => ({ x: i * 260 + R.range(0, 120), y: R.range(40, 200), s: R.range(0.6, 1.2) }));
  let sky = null, h1 = null, h2 = null, cloud = null, sun = null, lastScale = 0;

  function prep() {
    lastScale = getScale();
    const sc = lastScale > 1.3 ? 1.5 : 1;
    sky = makeCanvas(1, WH);
    const c = sky.getContext('2d'), g = c.createLinearGradient(0, 0, 0, WH);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, 1, WH);
    h1 = hillStrip(th, th.hill, th.hillHi, 420, 120, 2, 1.3, true, sc);
    h2 = hillStrip(th, th.hill2, th.hill2Hi, 470, 70, 3, 0.4, false, sc);
    cloud = cloudSprite();
    sun = th.sun === 'sunset' || th.sun === 'lava' ? sunDisc(th) : null;
  }

  function band(ctx, s, par, camX, vw) {
    let x = -((camX * par) % P);
    for (; x < vw; x += P) ctx.drawImage(s.cv, x, s.top, P, s.h);
  }

  function sky_(ctx, camX, vw, vh, t, q) {
    const kind = th.sun;
    if (kind === 'day') {
      const sx = vw * 0.8, sy = 90;
      if (q > 0) {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.002); ctx.fillStyle = 'rgba(255,250,200,.18)';
        for (let k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -260); ctx.lineTo(18, -260); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,245,180,.35)'; circ(ctx, sx, sy, 62); ctx.fillStyle = '#fff6b0'; circ(ctx, sx, sy, 46); ctx.fillStyle = '#ffe066'; circ(ctx, sx, sy, 38);
    } else if (kind === 'sunset' || kind === 'lava') {
      if (kind === 'sunset') starField(ctx, vw, t, q, 40);
      ctx.drawImage(sun, vw * 0.68 - 150, 330 - 150);
    } else if (kind === 'night') {
      starField(ctx, vw, t, q, 40);
    } else if (kind === 'beams') {
      ctx.fillStyle = th.beam;
      for (let k = 0; k < 5; k++) { const bx = ((k * 260 - camX * 0.15) % (vw + 400) + vw + 400) % (vw + 400) - 200; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 70, 0); ctx.lineTo(bx + 260, vh); ctx.lineTo(bx + 120, vh); ctx.closePath(); ctx.fill(); }
    }
    if ((kind === 'night' || kind === 'lava') && q > 0) {
      ctx.fillStyle = th.beam;
      for (let k = 0; k < 3; k++) { const bx = ((k * 340 - camX * 0.15) % (vw + 400) + vw + 400) % (vw + 400) - 200; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 60, 0); ctx.lineTo(bx + 240, vh); ctx.lineTo(bx + 120, vh); ctx.closePath(); ctx.fill(); }
    }
  }
  function starField(ctx, vw, t, q, n) {
    const m = q > 0 ? n : n >> 1;
    for (let k = 0; k < m; k++) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.03 + k * 1.7));
      ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`; circ(ctx, hash(k, 1) * vw, hash(k, 2) * 150, hash(k, 3) * 1.6 + 0.6);
    }
  }

  function mountains(ctx, camX, vw) {
    const sp = 280, off = camX * 0.08, base = 400;
    for (let k = Math.floor((off - 300) / sp); k <= Math.floor((off + vw + 300) / sp); k++) {
      const px = k * sp + hash(k, 1) * 120 - off, ph = 130 + hash(k, 2) * 130;
      ctx.fillStyle = th.mount; ctx.beginPath(); ctx.moveTo(px - 190, base); ctx.lineTo(px, base - ph); ctx.lineTo(px + 190, base); ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.mountDk; ctx.beginPath(); ctx.moveTo(px, base - ph); ctx.lineTo(px + 190, base); ctx.lineTo(px + 30, base); ctx.closePath(); ctx.fill();
      if (th.snow) {
        const sh = ph * 0.28; ctx.fillStyle = th.snow; ctx.beginPath(); ctx.moveTo(px, base - ph); ctx.lineTo(px + sh * 0.75, base - ph + sh);
        ctx.lineTo(px + sh * 0.35, base - ph + sh * 0.8); ctx.lineTo(px, base - ph + sh * 1.05); ctx.lineTo(px - sh * 0.35, base - ph + sh * 0.8); ctx.lineTo(px - sh * 0.75, base - ph + sh); ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = th.mount; ctx.fillRect(0, 398, vw, WH);
  }

  function birds(ctx, vw, t) {
    ctx.strokeStyle = th.fx === 'stars' ? 'rgba(60,20,60,.6)' : 'rgba(40,60,90,.55)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const x = ((t * 0.9 + k * 430) % (vw + 300)) - 150, y = 70 + k * 34 + Math.sin(t * 0.03 + k) * 10, f = Math.sin(t * 0.25 + k) * 5;
      ctx.beginPath(); ctx.moveTo(x - 8, y - f); ctx.quadraticCurveTo(x - 4, y - 2, x, y); ctx.quadraticCurveTo(x + 4, y - 2, x + 8, y - f); ctx.stroke();
    }
  }

  function ambient(ctx, camX, vw, vh, t, q) {
    const fx = th.fx, m = q === 0 ? 0.4 : 1;
    if (!fx || fx === 'stars') return;
    const wrap = (v, n) => ((v % n) + n) % n;
    if (fx === 'fireflies') {
      for (let i = 0; i < 18 * m; i++) {
        const x = wrap(hash(i, 1) * 3000 + Math.sin(t * 0.012 + i) * 50 - camX * 0.6, vw + 100) - 50, y = 140 + hash(i, 2) * 300 + Math.sin(t * 0.02 + i * 2) * 22, a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.04 + i));
        ctx.fillStyle = `rgba(220,255,120,${a * 0.25})`; circ(ctx, x, y, 8); ctx.fillStyle = `rgba(240,255,170,${a})`; circ(ctx, x, y, 2.4);
      }
    } else if (fx === 'butterflies') {
      const cols = ['#ff70a6', '#ffd23f', '#9b5de5', '#4cc9f0'];
      for (let i = 0; i < 6 * m; i++) {
        const x = wrap(hash(i, 4) * 2400 + t * 0.6 + Math.sin(t * 0.02 + i) * 40 - camX * 0.9, vw + 100) - 50, y = 330 + hash(i, 5) * 120 + Math.sin(t * 0.05 + i * 3) * 16, f = Math.abs(Math.sin(t * 0.3 + i));
        ctx.fillStyle = cols[i % 4]; ell(ctx, x - 3 * f, y, 4 * f + 0.6, 5, -0.3); ell(ctx, x + 3 * f, y, 4 * f + 0.6, 5, 0.3); ctx.fillStyle = '#333'; ctx.fillRect(x - 0.6, y - 3, 1.2, 6);
      }
    } else {
      for (let i = 0; i < 24 * m; i++) {
        const s = 0.4 + hash(i, 6) * 1.1, x = wrap(hash(i, 1) * vw + Math.sin(t * 0.02 + i) * 20 - camX * 0.3 * s, vw), by = hash(i, 2) * vh;
        if (fx === 'snowfall') { ctx.fillStyle = 'rgba(255,255,255,.85)'; circ(ctx, x, wrap(by + t * (0.6 + s * 0.6), vh), s * 2.2); }
        else if (fx === 'embers') { ctx.fillStyle = `rgba(255,${120 + (i * 17) % 100},40,.8)`; circ(ctx, x, vh - wrap(by + t * (0.5 + s), vh), s * 1.8); }
        else if (fx === 'dust') { ctx.fillStyle = 'rgba(255,230,170,.35)'; circ(ctx, wrap(x + t * 0.8 * s, vw), 300 + hash(i, 7) * 200, s * 1.4); }
        else if (fx === 'bubbles') { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, vh - wrap(by * 0.6 + t * (0.3 + s * 0.3), vh * 0.6), s * 3, 0, TAU); ctx.stroke(); }
        else { ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.04 + i)); ctx.fillStyle = fx === 'glow' ? '#b890ff' : '#ffd0f0'; circ(ctx, x, by * 0.9 + Math.sin(t * 0.02 + i) * 10, s * 2); ctx.globalAlpha = 1; }
      }
    }
  }

  return {
    draw(ctx, camX, vw, vh, t) {
      const q = perf.quality();
      if (!sky || lastScale !== getScale()) prep();
      ctx.drawImage(sky, 0, 0, vw, vh);
      sky_(ctx, camX, vw, vh, t, q);
      mountains(ctx, camX, vw);
      const span = 14 * 260;
      ctx.globalAlpha = th.birds ? 0.92 : 0.2;
      for (const c of clouds) {
        const x = (((c.x - camX * 0.18 - t * 0.12 * c.s) % span) + span) % span - 200;
        if (x > vw + 40 || x < -140) continue;
        ctx.drawImage(cloud, x - 26 * c.s, c.y - 42 * c.s, 104 * c.s, 76 * c.s);
      }
      ctx.globalAlpha = 1;
      if (q > 0 && th.birds && th.fx !== 'fireflies') birds(ctx, vw, t);
      band(ctx, h1, 0.25, camX, vw);
      band(ctx, h2, 0.5, camX, vw);
      ambient(ctx, camX, vw, vh, t, q);
    },
  };
}
