// Ecranul de final: medalia, rezultatele, confetti (canvas). Se închide cu butoanele sau cu tap în afara panoului.
import { h } from '../../../../shared/ui/dom.js';
import { evaluate, MEDAL_NAMES, MEDAL_ICONS } from '../sim/index.js';
import { sfx } from '../audio.js';

const COLORS = ['#ff5a6a', '#ffd23f', '#5bd66f', '#4cc9f0', '#c77dff', '#ff9f43'];

/** Confetti simplu pe un canvas de ecran; întoarce funcția de oprire. */
export function confetti(root) {
  const cv = h('canvas', { class: 'confetti' });
  root.append(cv);
  const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const bits = Array.from({ length: 90 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * 2 * dpr, vy: (1.5 + Math.random() * 2.5) * dpr, r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: COLORS[(Math.random() * COLORS.length) | 0] }));
  let raf = 0, alive = true;
  const frame = () => {
    if (!alive) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.a += b.va;
      if (b.y > cv.height + 20) { b.y = -20; b.x = Math.random() * cv.width; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => { alive = false; cancelAnimationFrame(raf); cv.remove(); };
}

/**
 * Afișează rezultatul scenariului. `ev` = evaluate(...) la final, `best` = cea mai bună medalie din timpul jocului.
 * Acțiuni: again, menu, next (sau null), keep (continuă să joci).
 */
export function showEnd(root, { sc, s, best, act }) {
  const ev = evaluate(s, sc), tier = Math.max(best, ev.medal);
  const stop = tier ? confetti(root) : () => {};
  if (tier) sfx('fanfare');
  const close = () => { stop(); el.remove(); };
  const go = (fn) => () => { close(); if (fn) fn(); };
  const el = h('div', { class: 'menu end', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'mp' },
      h('div', { class: 'medal' + (tier ? ' pop' : '') }, tier ? MEDAL_ICONS[tier] : '🚂'),
      h('h2', null, tier ? `${MEDAL_NAMES[tier]}! Bravo!` : 'Mai încearcă o dată!'),
      h('p', null, tier === 3 ? 'Ai făcut tot ce se putea. Ești un adevărat mecanic!' : tier ? 'Ai primit medalia. Mai poți face și mai bine!' : 'Nu ai ajuns încă la bronz, dar știi acum cum merge.'),
      ev.goals.map((g) => h('div', { class: 'gl' }, `${g.goal.text}: `, h('b', null, String(g.value)), ' ', g.tier ? MEDAL_ICONS[g.tier] : '')),
      h('div', { class: 'rowb' },
        act.next && tier ? h('button', { class: 'opt go', onclick: go(act.next) }, '➡️ Următorul scenariu') : null,
        h('button', { class: 'opt', onclick: go(act.again) }, '🔁 Din nou'),
        h('button', { class: 'opt', onclick: go(act.keep) }, '🚂 Mai joc'),
        h('button', { class: 'opt', onclick: go(act.menu) }, '🎯 Scenarii'))));
  root.append(el);
  return { close, el };
}
