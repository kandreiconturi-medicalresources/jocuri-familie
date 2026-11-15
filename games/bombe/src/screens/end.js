// Pauza și ecranul de final de meci.
import { h } from '../../../../shared/ui/dom.js';
import { makeScreen, btn, playerCard } from './ui.js';

export function createPause(app) {
  const note = h('p', { class: 'sub' });
  const s = makeScreen([h('h2', null, '⏸ Pauză'), note,
    h('div', { class: 'btns' }, btn('▶ Continuă', () => app.resume()), btn('🏠 Ieși din meci', () => app.quit(), 'alt'))]);
  s.fill = () => { note.textContent = app.net ? 'În rețea jocul merge mai departe pentru ceilalți!' : 'Jocul e oprit.'; };
  return s;
}

export function createEnd(app) {
  const title = h('h2');
  const board = h('div', { class: 'score' });
  const btns = h('div', { class: 'btns' });
  const s = makeScreen([title, board, btns]);
  s.fill = (play) => {
    const st = play.state, w = st.players.find((p) => p.id === st.matchWinner);
    title.textContent = w ? `🏆 ${w.name} a câștigat meciul!` : 'Meci terminat!';
    board.replaceChildren(...st.players.slice().sort((a, b) => b.score - a.score).map((p) =>
      playerCard(p, p.id === st.matchWinner ? 'win' : '', h('span', { class: 'st' }, '★ ' + p.score), h('small', null, `💣 ${p.bestB} bombe · 🔥 rază ${p.bestR}`))));
    const canRematch = !app.net || play.isHost;
    btns.replaceChildren(
      canRematch ? btn('🔁 Revanșă', () => app.rematch()) : h('p', { class: 'sub' }, 'Așteptăm gazda…'),
      btn(app.net ? '🚪 În cameră' : '🏠 Meniu', () => app.quit(), 'alt'));
  };
  return s;
}
