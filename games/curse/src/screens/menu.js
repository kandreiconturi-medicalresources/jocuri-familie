// Titlu, alegerea mașinii/pistei/opțiunilor, pauză. Fiecare ecran e un overlay DOM peste scena 3D.
import { h } from '../../../../shared/ui/dom.js';
import { isTouch } from '../../../../shared/engine/screen.js';
import { TRACKS, CAR_COLORS } from '../tracks/tracks.js';
import { makeScreen, btn, optRow, carIcon, fmtTime } from './ui.js';

export const DEFAULTS = { color: 'Red', color2: 'Green', track: 0, laps: 3, bots: 3, level: 'mid', auto: isTouch, tilt: false };

export function createMenu(app) {
  const title = makeScreen([
    h('h1', null, '🏎️ Turbo Curse'),
    h('p', { class: 'sub' }, 'Pornește motoarele și ajunge primul!'),
    h('div', { class: 'btns' },
      btn('▶ Joacă', () => app.openSetup('solo')),
      isTouch ? null : btn('👥 Doi jucători', () => app.openSetup('duo'), 'alt'),
      btn('🌐 În rețea', () => app.openLobby(), 'alt')),
    h('details', null, h('summary', null, 'Cum se joacă'), h('div', null,
      h('p', null, '⬅️➡️ virezi · ⬆️ accelerezi · ⬇️ frânezi'),
      h('p', null, h('kbd', null, 'Space'), ' = drift (umple nitro) · ', h('kbd', null, 'Shift'), ' = nitro · ', h('kbd', null, 'R'), ' = înapoi pe pistă'),
      h('p', null, 'Pe telefon: butoanele de pe ecran. Tasta F3 arată FPS-ul.'))),
  ]);

  const setup = makeScreen([], 'wide');
  const body = h('div');
  setup.card.append(h('h2', null, 'Pregătește cursa'), body);
  function paintSetup() {
    const c = app.cfg, unlocked = app.save.get('unlocked', 1);
    const t = TRACKS[c.track], locked = c.track >= unlocked, best = (app.save.get('best', {}) || {})[t.id];
    const colors = (key) => h('div', { class: 'colors' }, CAR_COLORS.map((k) => h('button', {
      class: 'swatch' + (c[key] === k.id ? ' on' : ''), title: k.name,
      onclick: () => { c[key] = k.id; if (key === 'color' && c.color2 === k.id) c.color2 = CAR_COLORS.find((x) => x.id !== k.id).id; paintSetup(); },
    }, carIcon(k.id, 62))));
    const step = (d) => { c.track = (c.track + d + TRACKS.length) % TRACKS.length; paintSetup(); };
    const set = (k) => (v) => { c[k] = v; paintSetup(); };
    body.replaceChildren(...[
      h('div', { class: 'row' }, h('span', { class: 'lab' }, app.mode === 'duo' ? 'Mașina 1' : 'Mașina ta'), colors('color')),
      app.mode === 'duo' ? h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Mașina 2'), colors('color2')) : null,
      h('div', { class: 'row' }, btn('◀', () => step(-1), 'alt sm'),
        h('div', { class: 'trk' + (locked ? ' locked' : '') }, h('b', null, (c.track + 1) + '. ' + t.name),
          h('small', null, locked ? '🔒 Termină pe podium pista dinainte' : best ? '🏆 Cel mai bun: ' + fmtTime(best / 1000) : 'Încă n-ai alergat aici')),
        btn('▶', () => step(1), 'alt sm')),
      optRow('Ture', [1, 2, 3, 4, 5].map((n) => [n, String(n)]), c.laps, set('laps')),
      optRow('Boți', [0, 1, 2, 3].map((n) => [n, String(n)]).filter(([n]) => n <= (app.mode === 'duo' ? 2 : 3)), Math.min(c.bots, app.mode === 'duo' ? 2 : 3), set('bots')),
      optRow('Boții sunt', [['easy', 'Ușori'], ['mid', 'Medii'], ['hard', 'Grei']], c.level, set('level')),
      isTouch ? optRow('Accelerare', [[true, 'Automată'], [false, 'Cu buton']], c.auto, set('auto')) : null,
      isTouch ? optRow('Volan', [[false, 'Butoane'], [true, 'Înclinare']], c.tilt, set('tilt')) : null,
      h('div', { class: 'btns' }, btn('← Înapoi', () => app.go('title'), 'alt sm'), btn(locked ? '🔒 Blocat' : '🏁 Start!', () => app.startSolo(), locked ? 'off' : ''))].filter(Boolean));
    const off = body.querySelector('button.off'); if (off) off.disabled = true;
  }
  setup.paint = paintSetup;

  const pause = makeScreen([
    h('h2', null, '⏸ Pauză'),
    h('div', { class: 'btns' }, btn('▶ Continuă', () => app.resume()), btn('🔄 De la capăt', () => app.restart(), 'alt'), btn('🚪 Ieși', () => app.quit(), 'alt')),
  ]);

  return { title, setup, pause };
}
