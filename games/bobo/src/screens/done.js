// Final de nivel: steluțe, căpșuni, mai departe.
import { h } from '../../../../shared/ui/dom.js';
import { LEVEL_COUNT } from '../levels/index.js';
import { makeScreen, btn, stars } from './ui.js';

export function createDone(app) {
  const body = h('div');
  const s = makeScreen([body]);
  s.fill = (res, info) => {
    const last = res.index >= LEVEL_COUNT - 1;
    body.replaceChildren(
      h('h2', null, last ? 'Ai terminat toată aventura! 🎉' : 'Bravo! 🎉'),
      stars(res.stars),
      h('p', { class: 'stat' }, '🍓 ' + res.fruits + ' căpșuni' + (info.newBest && res.stars > 0 ? ' · record nou!' : '')),
      res.stars < 3 ? h('p', { class: 'sub' }, 'Mai sunt steluțe ascunse. Încerci din nou?') : h('p', { class: 'sub' }, 'Toate cele 3 steluțe! Ești grozav!'),
      app.net ? h('div', { class: 'btns', style: { marginBottom: 0 } }, btn('↩ Înapoi în cameră', () => app.netBack())) :
      h('div', { class: 'btns', style: { marginBottom: 0 } },
        last ? null : btn('Nivelul următor ▶', () => app.startLevel(res.index + 1)),
        btn('↻ Din nou', () => app.startLevel(res.index), 'alt'),
        btn('🗺️ Harta', () => app.openMap(res.index), 'alt')),
    );
  };
  return s;
}
