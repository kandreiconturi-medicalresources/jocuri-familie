// Pauza.
import { h } from '../../../../shared/ui/dom.js';
import { makeScreen, btn } from './ui.js';

export function createPause(app) {
  return makeScreen([
    h('h2', null, 'Pauză ⏸'),
    h('div', { class: 'btns', style: { marginBottom: 0 } },
      btn('Continuă ▶', () => app.resume()),
      btn('↻ De la capăt', () => app.startLevel(app.game.index), 'alt'),
      btn('⚙️', () => app.openSettings('pause'), 'alt'),
      btn('🗺️ Harta', () => app.openMap(app.game.index), 'alt')),
  ]);
}
