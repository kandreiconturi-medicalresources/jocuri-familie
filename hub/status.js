// Insigna online/local + mesajul „Adaugă pe ecranul principal” pentru iOS Safari.
import { h as el } from '../shared/ui/dom.js';
import { store } from '../shared/engine/save.js';

export function createBadge() {
  const dot = el('span', { class: 'dot' });
  const txt = el('span', null, 'Local');
  const badge = el('div', { class: 'badge', title: 'Starea serverului' }, dot, txt);
  async function check() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    let ok = false;
    try {
      const r = await fetch('api/health', { cache: 'no-store', signal: ctrl.signal });
      const j = r.ok ? await r.json().catch(() => null) : null;
      ok = !!(j && j.app === 'jocuri-familie' && j.ok); // alt server pe același port nu contează
    } catch (e) { ok = false; }
    clearTimeout(t);
    badge.classList.toggle('on', ok);
    txt.textContent = ok ? 'Online' : 'Local';
  }
  check();
  setInterval(check, 30000);
  window.addEventListener('online', check);
  return badge;
}

export function createIosTip() {
  const ua = navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios || navigator.standalone !== false) return null;
  const s = store('hub');
  if (s.get('iosTipClosed', false)) return null;
  const tip = el('div', { class: 'tip', role: 'note' },
    el('div', { class: 'tip-text' },
      el('b', null, 'Joacă pe tot ecranul! '),
      'Apasă ', el('b', null, 'Partajare'), ' ⬆️ → ', el('b', null, 'Adaugă pe ecranul principal'), '.'),
    el('button', { class: 'tip-x', 'aria-label': 'Închide', onclick: () => { s.set('iosTipClosed', true); tip.remove(); } }, '✕'));
  return tip;
}
