// Steaguri de checkpoint (felinar), platforme mobile, steluțe trase cu bagheta.
import { TS } from '../../tiles.js';
import { ell, circ, rr, star } from './draw.js';

export function drawChecksClassic(c, lv, active, camX, t) {
  lv.checkpoints.forEach((cp, i) => {
    const on = active.has(i), x = cp.tx * TS + 16 - camX, y = cp.ty * TS;
    if (x < -60 || x > 1500) return;
    c.fillStyle = '#5e3814'; c.fillRect(x - 3, y - 62, 6, 62); c.fillRect(x - 3, y - 64, 18, 4); c.fillRect(x + 11, y - 64, 3, 8);
    c.save(); c.translate(x + 12, y - 56); c.rotate(Math.sin(t * 0.05) * 0.12);
    if (on) { const a = 0.25 + Math.sin(t * 0.1) * 0.08; c.fillStyle = `rgba(255,210,90,${a})`; circ(c, 0, 14, 26); c.fillStyle = `rgba(255,230,140,${a})`; circ(c, 0, 14, 15); }
    c.fillStyle = '#3d2a1a'; c.fillRect(-8, 2, 16, 3); c.fillRect(-8, 24, 16, 3);
    c.fillStyle = on ? '#ffe08a' : '#6c6a75'; c.fillRect(-7, 5, 14, 19);
    if (on) { c.fillStyle = '#ff9f1c'; ell(c, 0, 16, 3.5, 5.5 + Math.sin(t * 0.3) * 0.8); c.fillStyle = '#fff3b0'; ell(c, 0, 17, 1.8, 3); }
    c.strokeStyle = '#3d2a1a'; c.lineWidth = 1.5; c.strokeRect(-7, 5, 14, 19); c.beginPath(); c.moveTo(0, 5); c.lineTo(0, 24); c.stroke();
    c.restore();
  });
}

/** Platformele mobile: lespede de pământ cu iarbă (sau nor, în lumea norilor). */
export function drawPlatformsClassic(c, th, list, camX) {
  for (const p of list) {
    const x = p.x - camX, y = p.y - 2;
    rr(c, x, y, p.w, 18, 8); c.fillStyle = th.dirt; c.fill(); c.lineWidth = 2; c.strokeStyle = th.dirtDk; c.stroke();
    c.fillStyle = th.dirt2; for (let k = 10; k < p.w - 6; k += 22) ell(c, x + k, y + 12, 4, 2.2);
    c.save(); rr(c, x, y, p.w, 18, 8); c.clip();
    c.fillStyle = th.grassDk; c.fillRect(x, y, p.w, 8); c.fillStyle = th.grass; c.fillRect(x, y, p.w, 6); c.fillStyle = th.grassHi; c.fillRect(x, y, p.w, 2);
    c.restore();
  }
}

export function drawBulletsClassic(c, list, camX, t) {
  for (const b of list) {
    const y = b.y + Math.sin(b.t * 0.3) * 5, x = b.x - camX;
    c.fillStyle = 'rgba(255,240,150,.4)'; circ(c, x, y, 10);
    c.fillStyle = '#e09f00'; star(c, x, y, 8.5, b.t * 0.35); c.fillStyle = '#ffe066'; star(c, x, y, 6.5, b.t * 0.35);
  }
}
