// Butoane pe ecran: multi-touch + alunecarea degetului de la un buton la altul.
// Stilurile sunt în theme.css (.tp, .tp-btn). Apare doar pe dispozitive tactile.
import { isTouch } from '../engine/screen.js';
import { unlockAudio } from '../engine/audio.js';

const SLOP = 14; // toleranță în pixeli în jurul butonului

/** layout = [{ player, btn, side: 'left'|'right', label }] */
export function createTouchpad(input, layout, { force = false } = {}) {
  const root = document.createElement('div');
  root.className = 'tp';
  const sides = { left: document.createElement('div'), right: document.createElement('div') };
  for (const s in sides) { sides[s].className = 'tp-side'; root.appendChild(sides[s]); }

  const items = layout.map((d) => {
    const el = document.createElement('div');
    el.className = `tp-btn p${d.player} ${d.btn}`;
    el.textContent = d.label || '';
    (sides[d.side] || sides.left).appendChild(el);
    return { el, player: d.player, btn: d.btn, key: d.player + ':' + d.btn };
  });

  const ptrs = new Map(); // pointerId -> cheia butonului apăsat (sau null)
  let rects = [];
  const measure = () => { rects = items.map((it) => it.el.getBoundingClientRect()); };

  function hit(x, y) {
    if (!rects.length) measure();
    let best = null, bd = 1e9;
    items.forEach((it, i) => {
      const r = rects[i];
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d <= SLOP && d < bd) { bd = d; best = it.key; }
    });
    return best;
  }

  function recalc() {
    const active = new Set(ptrs.values());
    for (const it of items) {
      const on = active.has(it.key);
      input.setTouch(it.player, it.btn, on);
      it.el.classList.toggle('on', on);
    }
  }

  const onDown = (e) => {
    e.preventDefault();
    unlockAudio();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    measure();
    ptrs.set(e.pointerId, hit(e.clientX, e.clientY));
    recalc();
  };
  const onMove = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const k = hit(e.clientX, e.clientY);
    if (k !== ptrs.get(e.pointerId)) { ptrs.set(e.pointerId, k); recalc(); }
  };
  const onEnd = (e) => { if (ptrs.delete(e.pointerId)) recalc(); };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => root.addEventListener(ev, onEnd));
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  const onResize = () => { rects = []; };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);

  const visible = force || isTouch;
  root.classList.toggle('hidden', !visible);
  document.body.appendChild(root);

  return {
    show(on = true) { root.classList.toggle('hidden', !(on && visible)); rects = []; },
    clear() { ptrs.clear(); recalc(); },
    destroy() {
      ptrs.clear(); recalc();
      removeEventListener('resize', onResize);
      removeEventListener('orientationchange', onResize);
      root.remove();
    },
  };
}
