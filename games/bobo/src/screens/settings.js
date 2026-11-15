// Setări: sunet, calitate grafică, ecran complet, ștergerea progresului.
import { h } from '../../../../shared/ui/dom.js';
import { setMuted, isMuted } from '../../../../shared/engine/audio.js';
import { perf } from '../../../../shared/engine/perf.js';
import { toggleFullscreen } from '../../../../shared/engine/screen.js';
import { makeScreen, btn } from './ui.js';
import { resetProgress } from '../progress.js';
import { gfxStyle, setGfxStyle } from '../render/style.js';

export function createSettings(app) {
  const body = h('div');
  const s = makeScreen([h('h2', null, 'Setări ⚙️'), body]);
  let confirm = false, q = 'auto';
  const row = (label, ...ctrls) => h('div', { class: 'row' }, h('span', null, label), h('div', { class: 'btns', style: { margin: 0 } }, ...ctrls));
  function render() {
    const names = ['Mică', 'Medie', 'Mare'];
    body.replaceChildren(
      row('Sunet', btn(isMuted() ? '🔇 Oprit' : '🔊 Pornit', () => { setMuted(!isMuted()); app.syncMute(); render(); }, 'sm')),
      row('Grafică', btn('Auto', () => { perf.auto(); q = 'auto'; render(); }, 'sm alt' + (q === 'auto' ? ' on' : '')),
        ...names.map((n, i) => btn(n, () => { perf.set(i); q = i; render(); }, 'sm alt' + (q === i ? ' on' : '')))),
      row('Stil grafic', btn('Clasic', () => { setGfxStyle('classic'); render(); }, 'sm alt' + (gfxStyle() === 'classic' ? ' on' : '')),
        btn('Modern', () => { setGfxStyle('modern'); render(); }, 'sm alt' + (gfxStyle() === 'modern' ? ' on' : ''))),
      row('Ecran', btn('⛶ Ecran complet', () => toggleFullscreen(), 'sm alt')),
      row('Progres', confirm
        ? btn('Sigur? Se șterge tot!', () => { resetProgress(); confirm = false; render(); }, 'sm')
        : btn('🗑️ Șterge progresul', () => { confirm = true; render(); }, 'sm alt')),
      h('div', { class: 'btns', style: { margin: '12px 0 0' } }, btn('← Înapoi', () => app.closeSettings())),
    );
  }
  s.refresh = () => { confirm = false; render(); };
  return s;
}
