// Particule (puncte, stele, praf, text plutitor). update() se cheamă la pas fix.
import { perf } from './perf.js';

const SCALE = [0.35, 0.7, 1]; // multiplicator de număr după calitate
const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

/** Stea cu 5 colțuri (conturul se umple de apelant). */
export function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (rot || 0) + i * Math.PI / 5 - Math.PI / 2;
    const q = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  ctx.closePath();
  ctx.fill();
}

export function createParticles(max = 300) {
  const parts = [], pops = [];
  const R = Math.random;
  const count = (n) => Math.max(1, Math.round(n * SCALE[perf.quality()]));
  const add = (p) => { if (parts.length < max) parts.push(p); };

  return {
    burst(x, y, color, n = 8) {
      for (let k = 0, m = count(n); k < m; k++) {
        const a = R() * Math.PI * 2, s = 1 + R() * 3.5;
        add({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
          life: 30 + R() * 20, max: 50, color, r: 2 + R() * 3 });
      }
    },
    sparkle(x, y, n = 8) {
      for (let k = 0, m = count(n); k < m; k++) {
        const a = R() * Math.PI * 2, s = 1 + R() * 2.5;
        add({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
          life: 28 + R() * 14, max: 42, color: k % 2 ? '#fff6a8' : '#ffd23f',
          r: 4 + R() * 3, rot: R() * 6 });
      }
    },
    dust(x, y, n = 3, dir) {
      for (let k = 0, m = count(n); k < m; k++) {
        add({ kind: 'dust', x: x + (R() - 0.5) * 10, y: y - 3,
          vx: (dir || (R() - 0.5) * 2) * (0.4 + R() * 0.8), vy: -0.3 - R() * 0.4,
          life: 20, max: 20, color: 'rgba(255,255,255,.75)', r: 3 + R() * 2 });
      }
    },
    text(x, y, str, color) {
      if (pops.length < 30) pops.push({ x, y, t: 0, text: String(str), color: color || '#fff' });
    },
    update() {
      for (let k = parts.length - 1; k >= 0; k--) {
        const q = parts[k];
        q.x += q.vx; q.y += q.vy;
        if (q.kind === 'dust') { q.r += 0.22; q.vx *= 0.95; } else {
          q.vy += 0.18;
          if (q.kind === 'star') q.rot += 0.15;
        }
        if (--q.life <= 0) parts.splice(k, 1);
      }
      for (let k = pops.length - 1; k >= 0; k--) if (++pops[k].t > 45) pops.splice(k, 1);
    },
    draw(ctx, camX = 0, camY = 0) {
      for (const q of parts) {
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillStyle = q.color;
        if (q.kind === 'star') star(ctx, q.x - camX, q.y - camY, q.r, q.rot);
        else {
          ctx.beginPath();
          ctx.arc(q.x - camX, q.y - camY, q.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.lineJoin = 'round';
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,10,60,.7)';
      for (const p of pops) {
        ctx.globalAlpha = Math.max(0, 1 - p.t / 45);
        const x = p.x - camX, y = p.y - camY - p.t * 0.9;
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, x, y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
