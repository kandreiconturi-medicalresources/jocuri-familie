// Preferințe (sfaturi, muzică, tutorial făcut) și cardul „Meniu” cu setările de joc.
import { h } from '../../../../shared/ui/dom.js';
import { isMuted, setMuted } from '../../../../shared/engine/audio.js';
import { setAmbient } from '../audio.js';

const DEFAULTS = { tips: true, ambient: false, tutorialDone: false };

export function createPrefs(save) {
  const p = { ...DEFAULTS, ...(save.get('prefs', {}) || {}) };
  return { get: (k) => p[k], set(k, v) { p[k] = v; save.set('prefs', p); } };
}

/** Cardul ☰: comutatoare mari (≥ 44 px) + acțiuni. */
export function openSettings(card, prefs, act) {
  const toggle = (label, get, set) => {
    const b = h('button', { class: 'opt tg', role: 'switch' });
    const paint = () => { b.classList.toggle('on', get()); b.setAttribute('aria-checked', String(get())); b.textContent = label + (get() ? ': pornit' : ': oprit'); };
    b.onclick = () => { set(!get()); paint(); };
    paint();
    return b;
  };
  card.open(h('h3', null, '☰ Meniu'),
    toggle('💡 Sfaturile Ajutorului', () => prefs.get('tips'), (v) => prefs.set('tips', v)),
    toggle('🔊 Sunete', () => !isMuted(), (v) => setMuted(!v)),
    toggle('🎵 Muzică liniștită', () => prefs.get('ambient'), (v) => { prefs.set('ambient', v); setAmbient(v); }),
    h('div', { class: 'btns' },
      h('button', { class: 'opt', onclick: () => { card.close(); act.tutorial(); } }, '🎓 Repetă tutorialul'),
      act.saves ? h('button', { class: 'opt', onclick: () => { card.close(); act.saves(); } }, '💾 Salvează / Încarcă') : null,
      act.restart ? h('button', { class: 'opt', onclick: () => { card.close(); act.restart(); } }, '🔁 De la capăt') : null,
      h('button', { class: 'opt', onclick: () => { card.close(); act.home(); } }, '🏠 Meniul jocului')));
}
