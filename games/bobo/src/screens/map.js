// Harta lumilor: 10 lumi × 15 niveluri, cu steluțe și lacăte.
import { h } from '../../../../shared/ui/dom.js';
import { WORLDS, LEVELS_PER_WORLD, LEVEL_COUNT } from '../levels/index.js';
import { WORLD_ICON } from '../render/themes.js';
import { makeScreen, btn } from './ui.js';
import { loadProgress, totalStars, setTwoPlayers } from '../progress.js';

export function createMap(app) {
  const head = h('div', { class: 'mapHead' });
  const chips = h('div', { class: 'chips' });
  const grid = h('div', { class: 'grid' });
  const foot = h('div', { class: 'btns', style: { margin: '10px 0 0' } });
  const s = makeScreen([head, chips, grid, foot]);
  let world = 0;

  function render() {
    const pr = loadProgress();
    head.replaceChildren(
      btn('←', () => app.go('title'), 'alt sm'),
      h('h2', null, WORLD_ICON[world] + ' ' + WORLDS[world].name),
      h('div', { class: 'stat', style: { margin: 0 } }, '⭐ ' + totalStars(pr)),
    );
    chips.replaceChildren(...WORLDS.map((w, i) => {
      const locked = i * LEVELS_PER_WORLD >= pr.unlocked;
      return h('button', { class: 'chip' + (i === world ? ' cur' : '') + (locked ? ' lock' : ''), title: w.name, onclick: () => { world = i; render(); } }, locked ? '🔒' : WORLD_ICON[i]);
    }));
    grid.replaceChildren(...Array.from({ length: LEVELS_PER_WORLD }, (_, k) => {
      const i = world * LEVELS_PER_WORLD + k, locked = i >= pr.unlocked, st = pr.stars[i] || 0;
      const cls = 'lv' + (locked ? ' lock' : '') + (i === pr.unlocked - 1 ? ' next' : '') + (k === LEVELS_PER_WORLD - 1 ? ' boss' : '');
      return h('button', { class: cls, onclick: locked ? null : () => app.startLevel(i) },
        locked ? '🔒' : (k === LEVELS_PER_WORLD - 1 ? '👑' : k + 1),
        h('small', null, locked ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)));
    }));
    foot.replaceChildren(
      btn(app.n === 1 ? '🐻 1 jucător' : '🐻🐰 2 jucători', () => { app.n = app.n === 1 ? 2 : 1; setTwoPlayers(app.n === 2); render(); }, 'alt sm'),
      btn('⚙️', () => app.openSettings('map'), 'alt sm'),
    );
    app.setBackdrop(WORLDS[world].key);
  }
  s.refresh = (focus) => {
    const pr = loadProgress();
    const idx = Math.min(focus == null ? pr.unlocked - 1 : focus, LEVEL_COUNT - 1);
    world = Math.min(WORLDS.length - 1, Math.floor(idx / LEVELS_PER_WORLD));
    render();
  };
  return s;
}
