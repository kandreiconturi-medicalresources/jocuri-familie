// Inamicii și boss-ul în stil vectorial cu contur închis. Fiecare creatură se desenează cu fața spre stânga;
// originea e la tălpi (umblători) sau în centru (zburători, pește, ferăstrău, bloc, bilă de foc).
import { E, ell, circ, rr, blob, TAU } from './draw.js';

const O = '#3d2a1a';
const MID = new Set(['bee', 'fly', 'fish', 'saw', 'block', 'fireball']);
const NOFLIP = new Set(['saw', 'block', 'fireball']);
const eye = (c, x, y, r = 3.4, dx = -0.8) => { c.fillStyle = '#fff'; circ(c, x, y, r); c.fillStyle = '#222'; circ(c, x + dx, y, r * 0.5); c.fillStyle = '#fff'; circ(c, x + dx - 0.5, y - r * 0.3, r * 0.2); };

function snail(c, e, t) {
  const w = Math.sin(t * 0.2) * 1.5; c.lineWidth = 2; c.strokeStyle = O;
  c.fillStyle = '#c6ec7a'; rr(c, -17, -9, 32, 9, 4.5); c.fill(); c.stroke();
  E(c, -13, -11, 6.5, 8.5); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-15, -17); c.lineTo(-18, -25 + w); c.moveTo(-11, -17); c.lineTo(-10, -25 - w); c.stroke();
  eye(c, -18, -26 + w, 3.4, -0.8); eye(c, -10, -26 - w, 3.4, -0.8);
  c.fillStyle = 'rgba(255,120,140,.5)'; ell(c, -15, -8, 2.5, 1.5);
  c.fillStyle = '#f08a4b'; E(c, 3, -15, 12, 12); c.fill(); c.stroke();
  c.fillStyle = '#ffb27a'; circ(c, 1, -18, 6);
  c.strokeStyle = '#a34f1e'; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < Math.PI * 4.2; a += 0.3) { const r = 1 + a * 0.72; c.lineTo(3 + Math.cos(a) * r, -15 + Math.sin(a) * r); } c.stroke();
}

function bee(c, e, t) {
  const f = Math.sin(t * 0.9) * 0.5; c.lineWidth = 2; c.strokeStyle = '#2b2d42';
  c.fillStyle = 'rgba(255,255,255,.75)'; E(c, 2, -11, 6, 9.5, -0.4 + f); c.fill(); c.stroke(); E(c, 9, -10, 5, 8, 0.4 - f); c.fill(); c.stroke();
  c.fillStyle = '#ffd23f'; E(c, 0, 0, 14, 10.5); c.fill();
  c.save(); E(c, 0, 0, 14, 10.5); c.clip(); c.fillStyle = '#2b2d42'; c.fillRect(-1, -11, 4, 22); c.fillRect(6, -11, 4, 22); c.restore();
  E(c, 0, 0, 14, 10.5); c.stroke();
  c.fillStyle = '#2b2d42'; c.beginPath(); c.moveTo(13, -2); c.lineTo(19, 0); c.lineTo(13, 2); c.fill();
  eye(c, -7, -2, 3.8, -1);
  c.strokeStyle = '#2b2d42'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-10, -8); c.quadraticCurveTo(-13, -15, -16, -14); c.stroke();
}

function ladybug(c, e, t) {
  const w = Math.sin(t * 0.25) * 1.5; c.lineWidth = 2; c.strokeStyle = O;
  c.beginPath(); for (const k of [-7, 1, 9]) { c.moveTo(k, -5); c.lineTo(k - 3 + w * (k > 0 ? 1 : -1), 0); } c.stroke();
  c.fillStyle = '#2b2d42'; E(c, -14, -9, 6.5, 6); c.fill(); c.stroke();
  eye(c, -16, -11, 2.6, -0.6);
  c.beginPath(); c.moveTo(-17, -14); c.lineTo(-21, -20); c.moveTo(-13, -14); c.lineTo(-12, -21); c.stroke();
  c.fillStyle = '#e63946'; c.beginPath(); c.ellipse(3, -4, 15, 15, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(3, -19); c.lineTo(3, -4); c.stroke();
  c.fillStyle = '#2b2d42'; circ(c, -4, -11, 3); circ(c, 10, -11, 3); circ(c, 3, -6, 2.4);
  c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -5, -15, 3, 1.6, -0.5);
}

function fly(c, e, t) {
  const f = Math.sin(t * 1.1) * 0.6; c.lineWidth = 2; c.strokeStyle = '#1d2a3a';
  c.fillStyle = 'rgba(200,230,255,.8)'; E(c, 2, -10, 5, 10, -0.5 + f); c.fill(); c.stroke(); E(c, 8, -9, 4.5, 8.5, 0.5 - f); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-3, 6); c.lineTo(-5, 11); c.moveTo(3, 6); c.lineTo(5, 11); c.stroke();
  c.fillStyle = '#4a5a6e'; E(c, 4, 0, 10, 8); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(2, -6, 2.5, 12); c.fillRect(8, -5, 2.5, 10);
  c.fillStyle = '#4a5a6e'; E(c, -7, 0, 7, 7); c.fill(); c.stroke();
  c.fillStyle = '#e63946'; circ(c, -9, -3, 4.2); circ(c, -5, -4, 3.4); c.fillStyle = '#fff'; circ(c, -10, -4.5, 1.1);
  c.strokeStyle = '#1d2a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-11, 3); c.lineTo(-14, 6); c.stroke();
}

function worm(c, e, t) {
  c.lineWidth = 2; c.strokeStyle = O;
  const xs = [11, 4, -3, -10], cols = ['#f4a3c0', '#ff9ec0', '#f4a3c0', '#ff9ec0'];
  for (let i = 0; i < 4; i++) { const y = -7 + Math.sin(t * 0.2 + i * 1.2) * 2.2; c.fillStyle = cols[i]; E(c, xs[i], y, 6.6, 6.6 + (i === 3 ? 0.8 : 0)); c.fill(); c.stroke(); }
  const hy = -7 + Math.sin(t * 0.2 + 3.6) * 2.2;
  c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, -12, hy - 4, 2.5, 1.4);
  eye(c, -12, hy - 1, 3, -0.8); c.strokeStyle = O; c.lineWidth = 1.5; c.beginPath(); c.arc(-11, hy + 3, 2.6, 0.2, Math.PI - 0.2); c.stroke();
}

function saw(c, e, t) {
  c.rotate(e.t * 0.3); c.lineWidth = 2; c.strokeStyle = '#4a5560';
  c.fillStyle = '#cfd8e0'; c.beginPath();
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = i % 2 ? 12 : 17; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#9aa8b4'; circ(c, 0, 0, 10); c.stroke();
  c.fillStyle = '#6a7884'; for (let i = 0; i < 3; i++) circ(c, Math.cos(i * 2.094) * 5.5, Math.sin(i * 2.094) * 5.5, 2); c.fillStyle = '#4a5560'; circ(c, 0, 0, 2.2);
}

function fish(c, e, t) {
  const w = Math.sin(t * 0.3) * 4; c.lineWidth = 2; c.strokeStyle = '#143a5a';
  c.fillStyle = '#2a9ad0'; c.beginPath(); c.moveTo(11, 0); c.lineTo(20, -8 + w); c.lineTo(20, 8 + w); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#2a9ad0'; c.beginPath(); c.moveTo(-2, -8); c.lineTo(3, -15); c.lineTo(8, -7); c.closePath(); c.fill(); c.stroke();
  blob(c, 0, 0, 14, 9, '#4cc9f0');
  c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, 0, 4, 9, 3);
  c.strokeStyle = '#143a5a'; c.lineWidth = 1.5; c.beginPath(); c.arc(-4, 0, 6, -0.9, 0.9); c.stroke();
  eye(c, -8, -2, 3.2, -0.8);
}

function slime(c, e, t, kind) {
  const k = Math.sin(t * 0.15) * 0.07, rx = 13 * (1 + k), h = 17 * (1 - k);
  const col = kind === 'fire' ? '#ff7b2a' : kind === 'spike' ? '#b57cf0' : '#7ed957', hi = kind === 'fire' ? '#ffb070' : kind === 'spike' ? '#d8b8ff' : '#b8f090';
  c.lineWidth = 2; c.strokeStyle = O;
  if (kind === 'spike') {
    c.fillStyle = '#6a3fb0'; for (let i = -2; i <= 2; i++) { const bx = i * 5.5; c.beginPath(); c.moveTo(bx - 3, -h * 0.75 + Math.abs(i)); c.lineTo(bx, -h - 6 + Math.abs(i) * 2); c.lineTo(bx + 3, -h * 0.75 + Math.abs(i)); c.closePath(); c.fill(); c.stroke(); }
  }
  c.fillStyle = col; c.beginPath(); c.moveTo(-rx, 0); c.bezierCurveTo(-rx - 1, -h * 0.95, -rx * 0.5, -h * 1.05, 0, -h * 1.05); c.bezierCurveTo(rx * 0.5, -h * 1.05, rx + 1, -h * 0.95, rx, 0); c.closePath(); c.fill(); c.stroke();
  if (kind === 'fire') {
    c.fillStyle = '#ffd23f'; for (const bx of [-5, 1, 6]) { c.beginPath(); c.moveTo(bx - 3, -h * 0.95); c.quadraticCurveTo(bx - 2, -h - 6, bx + Math.sin(t * 0.3 + bx) * 2, -h - 11); c.quadraticCurveTo(bx + 3, -h - 4, bx + 3, -h * 0.95); c.closePath(); c.fill(); c.stroke(); }
  }
  c.fillStyle = hi; ell(c, -6, -h * 0.7, 3.5, 2, -0.5);
  eye(c, -5, -h * 0.45, 3.2, -0.6); eye(c, 3.5, -h * 0.45, 3.2, -0.6);
  c.strokeStyle = O; c.lineWidth = 1.5; c.beginPath(); c.arc(-1, -h * 0.28, 2.6, 0.2, Math.PI - 0.2); c.stroke();
}

function mouse(c, e, t) {
  const w = Math.sin(t * 0.3) * 1.2; c.lineWidth = 2; c.strokeStyle = O;
  c.strokeStyle = '#d98aa0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(12, -6); c.quadraticCurveTo(21, -6 + w * 3, 19, -16); c.stroke();
  c.strokeStyle = O; c.lineWidth = 2;
  c.fillStyle = '#9aa3b2'; E(c, 1, -8, 13, 8); c.fill(); c.stroke();
  c.fillStyle = '#c4cad6'; ell(c, 3, -5, 8, 4);
  c.fillStyle = '#9aa3b2'; E(c, -7, -17, 5.5, 6); c.fill(); c.stroke(); c.fillStyle = '#ffb0c0'; circ(c, -7, -17, 3.2);
  E(c, -13, -10, 8, 7); c.fill(); c.stroke();
  c.fillStyle = '#ff7a9a'; circ(c, -20, -9, 2);
  eye(c, -14, -12, 2.6, -0.7);
  c.strokeStyle = '#555'; c.lineWidth = 1; c.beginPath(); c.moveTo(-19, -8); c.lineTo(-25, -10); c.moveTo(-19, -7); c.lineTo(-25, -6); c.stroke();
  c.strokeStyle = O; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, 0); c.lineTo(-3 + w, -2); c.moveTo(8, 0); c.lineTo(8 - w, -2); c.stroke();
}

function frog(c, e, t) {
  const air = !e.onGround; c.lineWidth = 2; c.strokeStyle = '#1d4a1d';
  if (air) {
    c.fillStyle = '#4fb050'; c.beginPath(); c.moveTo(4, -6); c.lineTo(15, 2); c.lineTo(11, 3); c.lineTo(2, -2); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-10, -12); c.lineTo(-17, -4); c.lineTo(-14, -2); c.lineTo(-8, -8); c.closePath(); c.fill(); c.stroke();
  } else {
    c.fillStyle = '#4fb050'; E(c, 8, -4, 8, 4.5); c.fill(); c.stroke(); E(c, -9, -2, 5, 2.6); c.fill(); c.stroke();
  }
  const hy = air ? -16 : -10;
  blob(c, 0, hy, 12, air ? 11 : 9, '#5cc45a');
  c.fillStyle = '#b8f0a0'; ell(c, -1, hy + 4, 8, 4);
  blob(c, -6, hy - 9, 4.8, 4.8, '#5cc45a'); blob(c, 6, hy - 9, 4.8, 4.8, '#5cc45a');
  eye(c, -6.5, hy - 9.5, 3.2, -0.5); eye(c, 5.5, hy - 9.5, 3.2, -0.5);
  c.strokeStyle = '#1d4a1d'; c.lineWidth = 1.6; c.beginPath(); c.arc(-1, hy + 1, 6, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = 'rgba(255,120,140,.5)'; ell(c, -9, hy + 2, 2.2, 1.3);
}

function block(c, e, t) {
  const st = e.state; c.lineWidth = 2.5; c.strokeStyle = '#3b3f4d';
  rr(c, -17, -17, 34, 34, 6); c.fillStyle = '#8a8f9e'; c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-14, -14, 28, 3); c.fillRect(-14, -14, 3, 28);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-14, 11, 28, 3);
  c.fillStyle = '#5a5f70'; for (const [x, y] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) circ(c, x, y, 1.8);
  if (st === 'rest') {
    c.strokeStyle = '#222'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-10, -2); c.lineTo(-3, -2); c.moveTo(3, -2); c.lineTo(10, -2); c.stroke();
    c.beginPath(); c.moveTo(-5, 8); c.lineTo(5, 8); c.stroke();
  } else {
    c.fillStyle = '#fff'; E(c, -6.5, -3, 4.8, st === 'fall' ? 5.6 : 4.2); c.fill(); E(c, 6.5, -3, 4.8, st === 'fall' ? 5.6 : 4.2); c.fill();
    c.fillStyle = '#c0182c'; circ(c, -6.5, -2, 2.2); circ(c, 6.5, -2, 2.2);
    c.strokeStyle = '#222'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-12, -10); c.lineTo(-3, -6); c.moveTo(12, -10); c.lineTo(3, -6); c.stroke();
    c.fillStyle = '#222'; c.beginPath(); c.moveTo(-7, 9); for (let i = 0; i < 5; i++) c.lineTo(-7 + i * 3.5 + 1.75, i % 2 ? 9 : 6); c.lineTo(7, 9); c.closePath(); c.fill();
  }
}

function fireball(c, e, t) {
  const dir = e.vy < 0 ? 1 : -1, fl = Math.sin(t * 0.6) * 2;
  c.fillStyle = 'rgba(255,140,40,.3)'; circ(c, 0, 0, 14 + fl * 0.5);
  c.fillStyle = '#ff5a14'; c.beginPath(); c.moveTo(-7, 0); c.quadraticCurveTo(-5, 12 * dir, 0, 22 * dir + fl * dir); c.quadraticCurveTo(5, 12 * dir, 7, 0); c.closePath(); c.fill();
  c.lineWidth = 2; c.strokeStyle = '#a02800'; c.fillStyle = '#ff7a1a'; E(c, 0, 0, 9, 9); c.fill(); c.stroke();
  c.fillStyle = '#ffd23f'; circ(c, 0, 0, 5.5); c.fillStyle = '#fff6c0'; circ(c, -1, -1, 2.4);
}

const DRAW = {
  snail, bee, ladybug, fly, worm, saw, fish, mouse, frog, block, fireball,
  slime_normal: (c, e, t) => slime(c, e, t, 'normal'), slime_fire: (c, e, t) => slime(c, e, t, 'fire'), slime_spike: (c, e, t) => slime(c, e, t, 'spike'),
};

/** Desenează o creatură; `e` are x,y,w,h,dir,t,state,onGround,vy,knock,rot,squashed. k = mărirea (boss). */
export function drawCreature(c, type, e, camX, t, k = 1) {
  const fn = DRAW[type] || snail, mid = MID.has(type);
  const cx = e.x + e.w / 2 - camX, cy = mid ? e.y + e.h / 2 : e.y + e.h;
  c.save(); c.translate(cx, cy);
  if (e.knock) { if (!mid) c.translate(0, -e.h / 2); c.rotate(e.rot || 0); c.scale(1, -1); if (!mid) c.translate(0, e.h / 2); }
  else if (e.squashed) c.scale(1.25, 0.35);
  if (k !== 1) c.scale(k, k);
  if (e.dir > 0 && !NOFLIP.has(type)) c.scale(-1, 1);
  c.lineJoin = 'round'; c.lineCap = 'round';
  fn(c, e, t);
  c.restore();
}

export function drawEnemyClassic(c, e, camX, t) { drawCreature(c, e.type, e, camX, t, 1); }

function crown(c, x, y) {
  c.save(); c.translate(x, y); c.lineWidth = 2; c.strokeStyle = '#a86c00'; c.lineJoin = 'round';
  c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-16, -16); c.lineTo(-7, -8); c.lineTo(0, -20); c.lineTo(7, -8); c.lineTo(16, -16); c.lineTo(14, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e63946'; circ(c, 0, -6, 2.6); c.fillStyle = '#4cc9f0'; circ(c, -8, -5, 1.8); circ(c, 8, -5, 1.8);
  c.restore();
}

export function drawBossClassic(c, b, camX, t) {
  if (b.dead && b.dead % 6 < 3) return;
  if (b.inv > 0 && (b.inv >> 2) % 2 === 0) c.globalAlpha = 0.5;
  const mid = MID.has(b.type), k = 2.15;
  const e = { x: b.x, y: b.y, w: b.w, h: b.h, dir: b.face, t, state: b.state === 'dive' ? 'fall' : b.state === 'rest' ? 'rest' : 'idle', onGround: b.onGround, vy: b.vy || 0 };
  const squash = b.state === 'sleep' ? 1 + Math.sin(t * 0.06) * 0.03 : 1;
  const cx = b.x + b.w / 2 - camX, base = mid ? b.y + b.h / 2 : b.y + b.h + 4;
  c.save(); c.translate(cx, base); c.scale(1, squash); c.translate(-cx, -base);
  drawCreature(c, b.type, { ...e, y: e.y + (mid ? 0 : 4) }, camX, t, k);
  c.restore();
  crown(c, cx, b.y - 2);
  c.globalAlpha = 1;
  for (const w of b.waves) {
    const x = w.x - camX, r = 13 + Math.sin(w.t * 0.5) * 2;
    c.fillStyle = 'rgba(255,230,120,.35)'; c.beginPath(); c.arc(x, w.y, r + 8, Math.PI, 0); c.fill();
    c.fillStyle = '#fff4b0'; c.beginPath(); c.arc(x, w.y, r, Math.PI, 0); c.fill();
    c.strokeStyle = '#ff9a3c'; c.lineWidth = 3; c.beginPath(); c.arc(x, w.y, r, Math.PI, 0); c.stroke();
  }
}
