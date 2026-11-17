// Meniul de la clic dreapta / apăsare lungă: butoane mari lângă locul atins. Se închide la Esc, la atingere în afară sau după o acțiune.
import { h } from '../../../../shared/ui/dom.js';

export function createContextMenu(root) {
  let el = null, off = null, outAt = -1e9;
  const close = () => { if (!el) return; el.remove(); el = null; if (off) { off(); off = null; } };
  /** options: [{ id, icon, label, sub?, danger?, off? }] (off = motivul pentru care nu merge) · onPick(id). Butoanele „Vinde” cer o a doua atingere. */
  function open(x, y, title, options, onPick) {
    close();
    if (!options.length) return false;
    const btns = options.map((o) => {
      const b = h('button', { class: 'cm-b' + (o.danger ? ' no' : '') + (o.off ? ' off' : ''), type: 'button', title: o.off || '', 'aria-disabled': o.off ? 'true' : null }, h('span', { class: 'cm-i' }, o.icon), h('span', { class: 'cm-t' }, o.label), o.off || o.sub ? h('small', null, o.off || o.sub) : null);
      let armed = false;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (o.off) return; // nu se poate: motivul e scris pe buton
        if (o.danger && !armed) { armed = true; b.classList.add('arm'); b.querySelector('.cm-t').textContent = 'Sigur?'; setTimeout(() => { armed = false; b.classList.remove('arm'); b.querySelector('.cm-t').textContent = o.label; }, 2500); return; }
        close(); onPick(o.id);
      });
      return b;
    });
    el = h('div', { class: 'cm', role: 'menu' }, title ? h('div', { class: 'cm-h' }, title) : null, h('div', { class: 'cm-g' }, btns));
    root.append(el);
    const w = el.offsetWidth, hh = el.offsetHeight, W = innerWidth, H = innerHeight;
    el.style.left = Math.max(6, Math.min(W - w - 6, x - w / 2)) + 'px';
    el.style.top = Math.max(6, Math.min(H - hh - 6, y + 12 + hh > H - 6 ? y - hh - 12 : y + 12)) + 'px';
    const down = (e) => { if (el && !el.contains(e.target)) { outAt = performance.now(); close(); } }, key = (e) => { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    // în faza de capturare, ca atingerea pe hartă să închidă meniul; ignorăm primul eveniment ca eliberarea apăsării lungi să nu-l închidă
    const t0 = setTimeout(() => { addEventListener('pointerdown', down, true); }, 0);
    addEventListener('keydown', key, true);
    off = () => { clearTimeout(t0); removeEventListener('pointerdown', down, true); removeEventListener('keydown', key, true); };
    return true;
  }
  /** Atingerea care a închis meniul nu mai face și ea ceva pe hartă. */
  const swallow = () => performance.now() - outAt < 500;
  return { open, close, swallow, isOpen: () => !!el };
}
