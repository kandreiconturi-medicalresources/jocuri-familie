// Meniul principal și ecranul de alegeri (jucători, boți, arenă, runde, mod blând).
import { h } from '../../../../shared/ui/dom.js';
import { serverInfo } from '../../../../shared/engine/profiles.js';
import { ARENAS } from '../logic/arenas.js';
import { makeScreen, btn, optRow } from './ui.js';
import { loadSetup, saveSetup, fixCounts, localConfig } from '../setup.js';

const HELP = h('details', null, h('summary', null, '❓ Cum se joacă'),
  h('div', null, 'Pune bombe 💣, sparge lăzile și fugi din calea flăcărilor! Ultimul rămas câștigă runda.'),
  h('div', null, 'Jucătorul 1: ', h('kbd', null, 'W A S D'), ' + ', h('kbd', null, 'Spațiu'), ' · Jucătorul 2: ', h('kbd', null, '← ↑ ↓ →'), ' + ', h('kbd', null, 'Enter')),
  h('div', null, 'Pe ecran tactil: crucea și butonul 💣. Cu 3–4 jucători folosiți manete (gamepad).'),
  h('div', null, 'Bonusuri: 💣 încă o bombă · 🔥 rază mai mare · ⚡ viteză · 👟 împingi bombe · 🛡 scut.'));

export function createMenu(app) {
  const st = loadSetup();
  const title = makeScreen([
    h('h1', null, '💣 Bum-Bum Arena'),
    h('p', { class: 'sub' }, 'Bombe, explozii și mult haos! 2–4 jucători.'),
    h('div', { class: 'btns' },
      btn('▶ Joacă', () => app.go('setup')),
      serverInfo() ? btn('🌐 În rețea', () => app.openLobby(), 'alt') : null),
    HELP.cloneNode(true),
  ]);

  const body = h('div');
  const setup = makeScreen([h('h2', null, 'Alege jocul'), body]);

  function paint() {
    fixCounts(st);
    const a = ARENAS[st.arena];
    const step = (d) => { st.arena = (st.arena + d + ARENAS.length) % ARENAS.length; paint(); };
    body.replaceChildren(
      optRow('Jucători', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], st.humans, (v) => { st.humans = v; paint(); }),
      optRow('Boți', [[0, '0'], [1, '1'], [2, '2'], [3, '3']], st.bots, (v) => { st.bots = v; paint(); }),
      optRow('Boți sunt', [['easy', 'Ușori'], ['mid', 'Medii'], ['hard', 'Grei']], st.level, (v) => { st.level = v; paint(); }),
      h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Arena'), btn('◀', () => step(-1), 'alt sm'),
        h('span', { class: 'val' }, a.name, h('small', null, a.desc)), btn('▶', () => step(1), 'alt sm')),
      optRow('Runde', [[1, '1'], [3, '3'], [5, '5']], st.rounds, (v) => { st.rounds = v; paint(); }),
      optRow('Mod blând', [[true, 'Pornit'], [false, 'Oprit']], st.gentle, (v) => { st.gentle = v; paint(); }),
      h('p', { class: 'sub', style: { fontSize: '14px', margin: '0 0 8px' } }, st.gentle ? 'Ai un scut la început, iar bombele tale nu te rănesc.' : 'Mod pentru cei mari: o singură atingere și ieși!'),
      h('div', { class: 'btns', style: { marginBottom: 0 } }, btn('← Înapoi', () => app.go('title'), 'alt sm'),
        btn('💥 Start!', () => { saveSetup(st); app.startLocal(localConfig(st)); })));
  }
  setup.paint = paint;
  return { title, setup };
}
