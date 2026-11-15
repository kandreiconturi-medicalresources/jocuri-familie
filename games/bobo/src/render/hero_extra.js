// Personajele 3 și 4 din co-op-ul în rețea: vulpiță și pinguin, în același stil ca Bobo și Mimi (tălpile la origine, fața spre +x).
import { starPath, circ } from './sprites.js';

export const EXTRA = [
  { body: '#f08a24', belly: '#fff1dc', inner: '#ffc58a', feet: '#8a4a12', out: '#4a230a', name: 'Vulpiță', color: '#ff8a3c' },
  { body: '#33477d', belly: '#ffffff', inner: '#ff9f2e', feet: '#ff9f2e', out: '#141d3a', name: 'Pinguin', color: '#5b8cff' },
];

const E = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.2832); };
const ell = (c, x, y, rx, ry, rot) => { E(c, x, y, rx, ry, rot); c.fill(); };
const part = (c, x, y, rx, ry, rot) => { E(c, x, y, rx, ry, rot); c.fill(); c.stroke(); };
const tri = (c, pts) => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke(); };

function face(c, f, bob, nose) {
  const { air = 0, hurt = false, blink = false } = f;
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
  c.fillStyle = nose; ell(c, 13, -14 - bob, 2.4, 1.9);
  if (air === 'up' || hurt) { c.fillStyle = '#6a1b1b'; ell(c, 9.5, -10.5 - bob, 2.2, 2.6); }
  else { c.strokeStyle = '#3b2314'; c.lineWidth = 1.3; c.beginPath(); c.arc(9.5, -12 - bob, 2.6, 0.2, Math.PI - 0.4); c.stroke(); }
  c.fillStyle = 'rgba(255,100,140,.45)'; ell(c, 4, -12.5 - bob, 2.8, 1.7);
}

function wandOf(c, wand, wandUp, bob) {
  if (!wand) return;
  c.save(); c.translate(10, -8 - bob); c.rotate(0.55 + (wandUp ? -0.5 : 0));
  c.strokeStyle = '#5a2ba0'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -13); c.stroke();
  c.fillStyle = '#c98a00'; starPath(c, 0, -16, 6.5, 0.3); c.fill(); c.fillStyle = '#ffd23f'; starPath(c, 0, -16, 5, 0.3); c.fill();
  c.restore();
}

/** i = 2 (vulpiță) sau 3 (pinguin). f = { step, bob, arm, air, hurt, blink, wig, ear }. */
export function drawExtraPose(c, i, f, wand, wandUp) {
  const C = EXTRA[i - 2], { step = 0, bob = 0, arm = 0.1, air = 0, wig = 0, ear = 0 } = f;
  c.lineWidth = 2.2; c.strokeStyle = C.out; c.lineJoin = 'round';
  if (i === 2) {
    // coadă mare cu vârf alb
    c.fillStyle = C.body; part(c, -17, -14 - bob, 9, 5.5, -0.9 + wig * 0.05);
    c.fillStyle = '#fff'; part(c, -22, -20 - bob, 4.2, 3.2, -0.9 + wig * 0.05);
  }
  c.fillStyle = C.feet; part(c, -8, -12 - bob, 3.6, 6.5, -arm + 0.3);
  c.fillStyle = C.feet; part(c, -6 + step, -3.5, 6.5, 4.2); part(c, 6 - step, -3.5, 6.5, 4.2);
  if (i === 2) {
    const er = air === 'up' ? -0.1 : air === 'down' ? -0.4 : ear;
    c.save(); c.translate(0, -bob); c.rotate(er);
    c.fillStyle = C.body; tri(c, [[-11, -25], [-8, -40], [-1, -27]]); tri(c, [[1, -27], [8, -40], [11, -24]]);
    c.fillStyle = C.inner; tri(c, [[-9, -27], [-8, -35], [-4, -28]]); tri(c, [[3, -28], [8, -35], [9, -26]]);
    c.restore();
  }
  c.fillStyle = C.body; part(c, 0, -15 - bob, 13.5, 13);
  c.fillStyle = C.belly; ell(c, 3, -10 - bob, 8.5, 7);
  if (i === 2) {
    // bot alungit
    c.fillStyle = C.belly; part(c, 11, -13 - bob, 6, 4.5);
    c.fillStyle = C.body; c.fillRect(-1, -26 - bob, 9, 3);
  } else {
    c.fillStyle = C.body; part(c, -7, -26 - bob, 7, 4);
    c.fillStyle = '#fff'; ell(c, 8, -19 - bob, 8, 7.5); // fața albă
    c.fillStyle = C.inner; tri(c, [[12, -17 - bob], [20, -14 - bob], [12, -12 - bob]]); // cioc
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#c98a00'; c.lineWidth = 1.4; tri(c, [[-3, -27 - bob], [-1, -34 - bob], [2, -27 - bob]]);
    c.strokeStyle = C.out; c.lineWidth = 2.2;
  }
  c.fillStyle = 'rgba(255,255,255,.3)'; ell(c, -5, -22 - bob, 4.5, 3, -0.5);
  face(c, f, bob, i === 2 ? '#2a1408' : 'rgba(0,0,0,0)');
  c.lineWidth = 2.2; c.strokeStyle = C.out; c.fillStyle = C.body; part(c, 8, -11 - bob, 3.6, 6.5, arm + 0.3);
  wandOf(c, wand, wandUp, bob);
}
