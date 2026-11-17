// Preferințe (sfaturi, muzică, tutorial făcut) și cardul „Meniu” cu setările de joc.
import { h } from '../../../../shared/ui/dom.js';
import { isMuted, setMuted } from '../../../../shared/engine/audio.js';
import { setAmbient, configureTrainSounds } from '../audio.js';

const DEFAULTS = { tips: true, ambient: false, tutorialDone: false, view: '3d', cool: null, trainSnd: true, trainVol: 0.6 }; // cool: null = pornit pe telefon/tabletă

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
    toggle('🚂 Sunete de tren', () => prefs.get('trainSnd'), (v) => { prefs.set('trainSnd', v); configureTrainSounds({ on: v }); }),
    h('label', { class: 'opt vol', style: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' } }, '🔉 Volum trenuri',
      h('input', { type: 'range', style: { flex: '1', minHeight: '32px' }, min: 0, max: 1, step: 0.05, value: prefs.get('trainVol'), 'aria-label': 'Volum sunete tren',
        oninput: (e) => { const v = +e.target.value; prefs.set('trainVol', v); configureTrainSounds({ vol: v }); } })),
    act.cool ? toggle('🔋 Mod răcoros', () => act.cool.get(), (v) => act.cool.set(v)) : null,
    toggle('🎵 Muzică liniștită', () => prefs.get('ambient'), (v) => { prefs.set('ambient', v); setAmbient(v); }),
    h('div', { class: 'btns' },
      h('button', { class: 'opt', onclick: () => { card.close(); act.tutorial(); } }, '🎓 Repetă tutorialul'),
      act.saves ? h('button', { class: 'opt', onclick: () => { card.close(); act.saves(); } }, '💾 Salvează / Încarcă') : null,
      act.restart ? h('button', { class: 'opt', onclick: () => { card.close(); act.restart(); } }, '🔁 De la capăt') : null,
      h('button', { class: 'opt', onclick: () => { card.close(); act.home(); } }, '🏠 Meniul jocului')));
}
