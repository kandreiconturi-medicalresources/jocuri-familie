// Bobo (ursuleț) și Mimi (iepuraș), desenați în cod. Cadrele (mers 8, săritură, cădere, lovit, respirat, clipit)
// se pre-randează la cerere într-un cache, apoi se desenează ca imagini (rapid pe A9).
import { makeCanvas, getScale } from '../atlas.js';
import { perf } from '../../../../shared/engine/perf.js';
import { starPath, circ } from './sprites.js';

export const HERO = [
  { body: '#b9773f', belly: '#f2d3ac', inner: '#ec9f78', feet: '#7a4a28', out: '#3b2314', name: 'Bobo', color: '#ff9f43' },
  { body: '#ffbcd9', belly: '#fff5fa', inner: '#ff86b6', feet: '#ec84b0', out: '#7a2e55', name: 'Mimi', color: '#ff7fb0' },
];
const BW = 80, BH = 96, OX = 40, OY = 90;
const cache = new Map();
let cacheScale = 0;

const E = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.2832); };
const ell = (c, x, y, rx, ry, rot) => { E(c, x, y, rx, ry, rot); c.fill(); };
const part = (c, x, y, rx, ry, rot) => { E(c, x, y, rx, ry, rot); c.fill(); c.stroke(); };

/** Un cadru la origine = tălpile. f = { step, bob, arm, air, hurt, blink, wig, ear }. */
function drawPose(c, i, f, wand, wandUp) {
  const C = HERO[i], { step = 0, bob = 0, arm = 0.1, air = 0, hurt = false, blink = false, wig = 0, ear = 0 } = f;
  c.lineWidth = 2.2; c.strokeStyle = C.out; c.lineJoin = 'round';
  c.fillStyle = C.feet; part(c, -8, -12 - bob, 3.6, 6.5, -arm + 0.3);
  c.fillStyle = C.feet; part(c, -6 + step, -3.5, 6.5, 4.2); part(c, 6 - step, -3.5, 6.5, 4.2);
  if (i === 0) {
    c.fillStyle = C.body; part(c, -8, -26 - bob, 6.5, 6.5); part(c, 7, -27 - bob, 6.5, 6.5);
    c.fillStyle = C.inner; circ(c, -8, -26 - bob, 3.2); circ(c, 7, -27 - bob, 3.2);
  } else {
    const er = air === 'up' ? -0.15 : air === 'down' ? -0.55 : ear;
    c.fillStyle = C.body; part(c, -5, -36 - bob, 4.5, 11.5, -0.2 + er); part(c, 4, -37 - bob, 4.5, 11.5, 0.15 + er);
    c.fillStyle = C.inner; ell(c, -5, -36 - bob, 2.2, 7.5, -0.2 + er); ell(c, 4, -37 - bob, 2.2, 7.5, 0.15 + er);
  }
  c.fillStyle = C.body; part(c, 0, -15 - bob, 13.5, 13);
  c.fillStyle = C.belly; ell(c, 3, -10 - bob, 8.5, 7);
  c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -5, -22 - bob, 4.5, 3, -0.5);
  if (i === 0) {
    c.fillStyle = '#3a86ff'; c.fillRect(-12, -10 - bob, 24, 4.5);
    c.fillStyle = '#2667cc'; c.fillRect(-15, -10 - bob, 5, 10 + wig);
    c.fillStyle = '#fff'; circ(c, -6, -8 - bob, 0.9); circ(c, 2, -8 - bob, 0.9);
  } else {
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#c98a00'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-1, -27 - bob); c.lineTo(-10, -33 - bob); c.lineTo(-10, -22 - bob); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1, -27 - bob); c.lineTo(8, -33 - bob); c.lineTo(8, -22 - bob); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffb703'; circ(c, -1, -27 - bob, 2.8); c.strokeStyle = C.out; c.lineWidth = 2.2;
  }
  if (hurt) {
    c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath();
    c.moveTo(2, -22 - bob); c.lineTo(6, -19 - bob); c.lineTo(2, -16 - bob); c.moveTo(13, -22 - bob); c.lineTo(9, -19 - bob); c.lineTo(13, -16 - bob); c.stroke();
  } else {
    c.fillStyle = '#fff'; ell(c, 4.5, -19 - bob, 3.6, blink ? 0.8 : 4.4); ell(c, 11, -19 - bob, 3.3, blink ? 0.8 : 4.1);
    if (!blink) {
      c.fillStyle = '#1d1d2b'; circ(c, 5.5, -18.5 - bob, 2.2); circ(c, 11.8, -18.5 - bob, 2);
      c.fillStyle = '#fff'; circ(c, 6.3, -19.6 - bob, 0.9); circ(c, 12.5, -19.6 - bob, 0.8);
    }
  }
  c.fillStyle = i ? '#ff5c8a' : '#3b2314'; ell(c, 13, -14 - bob, 2.4, 1.9);
  if (air === 'up' || hurt) { c.fillStyle = '#6a1b1b'; ell(c, 9.5, -10.5 - bob, 2.2, 2.6); }
  else { c.strokeStyle = '#3b2314'; c.lineWidth = 1.3; c.beginPath(); c.arc(9.5, -12 - bob, 2.6, 0.2, Math.PI - 0.4); c.stroke(); }
  c.fillStyle = 'rgba(255,100,140,.45)'; ell(c, 4, -12.5 - bob, 2.8, 1.7);
  c.lineWidth = 2.2; c.strokeStyle = C.out; c.fillStyle = C.body; part(c, 8, -11 - bob, 3.6, 6.5, arm + 0.3);
  if (wand) {
    c.save(); c.translate(10, -8 - bob); c.rotate(0.55 + (wandUp ? -0.5 : 0));
    c.strokeStyle = '#5a2ba0'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -13); c.stroke();
    c.fillStyle = '#c98a00'; starPath(c, 0, -16, 6.5, 0.3); c.fill(); c.fillStyle = '#ffd23f'; starPath(c, 0, -16, 5, 0.3); c.fill();
    c.restore();
  }
}

const FRAMES = { idle0: {}, idle1: { bob: 1.2, wig: 1.5 }, blink: { blink: true }, up: { arm: -1.4, air: 'up' }, fall: { arm: -1.4, air: 'down' }, hurt: { hurt: true, arm: -0.8 } };
for (let k = 0; k < 8; k++) {
  const ph = k * Math.PI / 4;
  FRAMES['w' + k] = { step: Math.sin(ph) * 4, bob: Math.abs(Math.sin(ph)) * 2, arm: Math.sin(ph) * 0.7, wig: Math.sin(ph * 2) * 1.5, ear: Math.sin(ph) * 0.12 };
}

function frameCanvas(i, name, wand, wandUp, big) {
  const sc = getScale();
  if (sc !== cacheScale) { cache.clear(); cacheScale = sc; }
  const key = i + name + (wand ? 'w' : '') + (wandUp ? 'u' : '') + (big ? 'B' : '');
  let cv = cache.get(key);
  if (!cv) {
    const s = Math.min(2, Math.ceil(sc * 2) / 2 * (big ? 1.2 : 1));
    cv = makeCanvas(BW * s, BH * s);
    const x = cv.getContext('2d');
    x.scale(s, s); x.translate(OX, OY);
    const K = big ? 1.4 : 1; x.scale(K, K);
    drawPose(x, i, FRAMES[name], wand, wandUp);
    cache.set(key, cv);
  }
  return cv;
}

function poseName(p, tick) {
  if (p.hurtT > 0) return 'hurt';
  if (!p.onGround) return p.vy < 0 && !p.inWater ? 'up' : 'fall';
  if (Math.abs(p.vx) > 0.3) return 'w' + (Math.floor(p.walk) & 7);
  if ((tick % 200) < 6) return 'blink';
  return (tick >> 5) & 1 ? 'idle1' : 'idle0';
}

/** Desenează un jucător (p are x,y,w,h,face,vy,onGround,big,inv,shield,wand...). */
export function drawHero(ctx, p, camX, tick, multi) {
  if (p.dead) return;
  const cx = p.x + p.w / 2 - camX, by = p.y + p.h, K = p.big ? 1.4 : 1;
  if (p.onGround && perf.quality() > 0) {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx, by - 1, p.w * 0.55, 3.5, 0, 0, 6.2832); ctx.fill();
  }
  const flick = p.inv > 0 && ((p.inv >> 2) & 1) === 0;
  if (flick) ctx.globalAlpha = 0.45;
  let sx = 1, sy = 1;
  if (p.land > 0) { const k = p.land / 8; sy = 1 - 0.2 * k; sx = 1 + 0.16 * k; }
  else if (!p.onGround) { if (p.vy < 0) { sy = 1.1; sx = 0.92; } else { sy = 0.97; sx = 1.03; } }
  const cv = frameCanvas(p.i, poseName(p, tick), p.wand, p.shootCd > 6, p.big);
  ctx.save(); ctx.translate(cx, by); ctx.scale(p.face * sx, sy);
  ctx.drawImage(cv, -OX, -OY, BW, BH); ctx.restore();
  ctx.globalAlpha = 1;
  if (p.shield) {
    const y = by - 17 * K, r = 23 * K;
    ctx.fillStyle = 'rgba(155,231,255,.16)'; circ(ctx, cx, y, r);
    ctx.strokeStyle = 'rgba(76,201,240,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, y, r, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,220,.5)'; ctx.beginPath(); ctx.arc(cx, y, r - 4, tick * 0.05, tick * 0.05 + 1.3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; circ(ctx, cx - r * 0.4, y - r * 0.45, 3);
  }
  if (multi) {
    const ty = by - (p.i ? 62 : 50) * K + Math.sin(tick * 0.1) * 2;
    ctx.fillStyle = HERO[p.i].color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 7, ty); ctx.lineTo(cx + 7, ty); ctx.lineTo(cx, ty + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/** Un erou mare, pentru ecranul de titlu / final (x,y = tălpile). */
export function drawHeroBig(ctx, i, x, y, size, name = 'idle0') {
  const cv = frameCanvas(i, name, false, false, false), k = size / 40;
  ctx.drawImage(cv, x - OX * k, y - OY * k, BW * k, BH * k);
}
