// Pauza. În rețea jocul merge mai departe: doar „Continuă” și ieșirea din cameră.
import { h } from '../../../../shared/ui/dom.js';
import { makeScreen, btn } from './ui.js';

export function createPause(app) {
  const solo = h('div', { class: 'btns', style: { marginBottom: 0 } },
    btn('Continuă ▶', () => app.resume()),
    btn('↻ De la capăt', () => app.startLevel(app.game.index), 'alt'),
    btn('⚙️', () => app.openSettings('pause'), 'alt'),
    btn('🗺️ Harta', () => app.openMap(app.game.index), 'alt'));
  const online = h('div', { class: 'btns hidden', style: { marginBottom: 0 } },
    btn('Continuă ▶', () => app.resume()),
    btn('🚪 Ieși din cameră', () => app.netLeave(), 'alt'));
  const s = makeScreen([h('h2', null, 'Pauză ⏸'), solo, online]);
  const show = s.show;
  s.show = (on = true) => { solo.classList.toggle('hidden', !!app.net); online.classList.toggle('hidden', !app.net); show(on); };
  return s;
}
