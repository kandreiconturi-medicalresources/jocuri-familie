// Podium la final: locurile 1–3 pe trepte, restul dedesubt, confetti pe un canvas 2D.
import { h } from '../../../../shared/ui/dom.js';
import { makeScreen, btn, carIcon, fmtTime } from './ui.js';

const MEDAL = ['🥇', '🥈', '🥉'];
const CONF = ['#ffd23f', '#ff5a6a', '#4cc9f0', '#6bd66b', '#ff8fc8', '#c77dff', '#ffb066'];

function confetti(cv) {
  const g = cv.getContext('2d');
  const w = cv.width = innerWidth, hh = cv.height = innerHeight;
  const P = Array.from({ length: 90 }, () => ({
    x: Math.random() * w, y: -Math.random() * hh, vy: 120 + Math.random() * 180, vx: (Math.random() - 0.5) * 80,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, c: CONF[(Math.random() * CONF.length) | 0], s: 6 + Math.random() * 8,
  }));
  let raf = 0, last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, w, hh);
    for (const p of P) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > hh + 20) { p.y = -20; p.x = Math.random() * w; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export function createPodium(app) {
  const cv = h('canvas', { class: 'confetti' });
  const body = h('div');
  const s = makeScreen([h('h2', null, '🏁 Gata cursa!'), body], 'wide podium');
  s.el.prepend(cv);
  let stop = null;
  const prevShow = s.show;
  s.show = (on = true) => { prevShow(on); if (!on && stop) { stop(); stop = null; } };

  /** `list` = mașinile în ordinea sosirii; `mine` = ids ale oamenilor; `info` = { record, unlocked }. */
  s.fill = (list, mine, info = {}) => {
    const step = (i, cls) => {
      const c = list[i];
      if (!c) return h('div', { class: 'step empty' });
      return h('div', { class: 'step ' + cls + (mine.includes(c.id) ? ' me' : '') },
        h('div', { class: 'who' }, carIcon(c.color, 70), h('b', null, c.name), h('small', null, c.finished ? fmtTime(c.finishT) : 'nu a terminat')),
        h('div', { class: 'block' }, h('span', null, MEDAL[i])));
    };
    body.replaceChildren(
      h('div', { class: 'steps' }, step(1, 's2'), step(0, 's1'), step(2, 's3')),
      list.length > 3 ? h('div', { class: 'rest' }, list.slice(3).map((c, i) => h('span', null, (i + 4) + '. ', c.name))) : null,
      info.record ? h('p', { class: 'sub gold' }, '⭐ Cel mai bun timp: ' + fmtTime(info.record / 1000) + '!') : null,
      info.unlocked ? h('p', { class: 'sub gold' }, '🔓 Pistă nouă deblocată!') : null,
      h('div', { class: 'btns' }, btn('🔄 Din nou', () => app.restart()), btn('🗺 Altă pistă', () => app.go('setup'), 'alt'), btn('🏠 Meniu', () => app.quit(), 'alt')));
    stop = confetti(cv);
  };
  return s;
}
