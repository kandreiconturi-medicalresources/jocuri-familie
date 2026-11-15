// Ecranul de titlu: 1 sau 2 jucători, setări, ajutor.
import { h } from '../../../../shared/ui/dom.js';
import { isTouch } from '../../../../shared/engine/screen.js';
import { makeScreen, btn } from './ui.js';
import { onlineNow } from '../../../../shared/net/api.js';
import { playerName, loadProgress, setTwoPlayers, totalStars } from '../progress.js';

export function createTitle(app) {
  const who = h('p', { class: 'who' });
  const keys = h('div', null,
    h('b', null, 'Bobo: '), h('kbd', null, 'A'), ' ', h('kbd', null, 'D'), ' merge, ', h('kbd', null, 'W'), ' sau ', h('kbd', null, 'Spațiu'), ' sare, ', h('kbd', null, 'F'), ' trage', h('br'),
    h('b', null, 'Mimi: '), h('kbd', null, '←'), ' ', h('kbd', null, '→'), ' merge, ', h('kbd', null, '↑'), ' sare, ', h('kbd', null, '↓'), ' trage', h('br'),
    '🎮 Merge și cu controllere (gamepad).');
  const touch = h('div', null,
    h('b', null, '1 jucător: '), 'butoanele ◀ ▶ din stânga merg, ⬆ din dreapta sare, ★ trage cu bagheta.', h('br'),
    h('b', null, '2 jucători: '), 'Bobo are butoanele din stânga, Mimi pe cele din dreapta.');
  const help = h('details', null,
    h('summary', null, '❓ Cum se joacă?'),
    isTouch ? touch : keys,
    h('div', null, '🍓 Adună căpșuni · 🎁 lovește cutiile cu capul · 🐌🐝 sari pe inamici', h('br'),
      '🧁 Brioșa te face mare și spargi cărămizi · 🪄 Bagheta trage cu steluțe · 🫧 Bula te apără', h('br'),
      '🏮 Steagul salvează locul · 🌈 Curcubeul termină nivelul · În 2 jucători vă puteți urca unul pe altul!'));
  const netBtn = h('div', { class: 'btns hidden' }, btn('🌐 Joacă în rețea', () => app.openLobby(), 'alt'));
  const s = makeScreen([
    h('h1', null, 'Aventura lui Bobo și Mimi'),
    h('p', { class: 'sub' }, 'Un joc de sărituri pentru toată familia 🐻🐰🌈'),
    who,
    h('div', { class: 'btns' }, btn('🐻 1 Jucător', () => pick(1)), btn('🐻🐰 2 Jucători', () => pick(2), 'alt')),
    netBtn,
    h('div', { class: 'btns' }, btn('⚙️ Setări', () => app.openSettings('title'), 'alt sm')),
    help,
  ]);
  function pick(n) { app.n = n; setTwoPlayers(n === 2); app.openMap(); }
  s.refresh = () => {
    const pr = loadProgress();
    who.textContent = `Salut, ${playerName()}! ⭐ ${totalStars(pr)} steluțe`;
    app.n = pr.twoPlayers ? 2 : 1;
    netBtn.classList.toggle('hidden', !onlineNow()); // doar în modul NAS
  };
  return s;
}
