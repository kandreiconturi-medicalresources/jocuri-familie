// Ecranul 2: grila de jocuri.
import { h as el } from '../shared/ui/dom.js';
import { avatarCanvas } from './avatar.js';

const GAMES = [
  { id: 'bobo', href: 'games/bobo/', icon: '🐻', name: 'Aventura lui Bobo și Mimi', desc: 'Sari, strânge stelele și salvează prietenii!', grad: ['#ffb347', '#e0631c'] },
  { id: 'bombe', icon: '💣', name: 'Bum-Bum Arena', desc: 'Bombe, explozii și mult haos în arenă.', grad: ['#ff7eb6', '#b5179e'] },
  { id: 'curse', icon: '🏎️', name: 'Turbo Curse', desc: 'Pornește motoarele și ajunge primul!', grad: ['#4cc9f0', '#3a6fd8'] },
  { id: 'orasel', icon: '🏘️', name: 'Orășelul', desc: 'Construiește, cumpără și fii primar.', grad: ['#6bd66b', '#2e9e6b'] },
];

export function gamesScreen({ profile, onSwitch }) {
  const grid = el('div', { class: 'games' }, GAMES.map((g) => {
    const live = !!g.href;
    const body = [
      el('span', { class: 'gicon' }, g.icon),
      el('span', { class: 'gtext' }, el('span', { class: 'gname' }, g.name), el('span', { class: 'gdesc' }, g.desc)),
      live ? el('span', { class: 'play' }, '▶') : el('span', { class: 'soon' }, 'În curând'),
    ];
    const attrs = { class: 'game' + (live ? '' : ' locked'), style: { '--g1': g.grad[0], '--g2': g.grad[1] } };
    return live ? el('a', { ...attrs, href: g.href }, body) : el('div', { ...attrs, 'aria-disabled': 'true' }, body);
  }));
  return el('main', { class: 'screen' },
    el('div', { class: 'who' },
      el('div', { class: 'chip' }, avatarCanvas(profile.avatar, profile.color, 44), el('span', null, 'Salut, ', el('b', null, profile.name), '!')),
      el('button', { class: 'btn small alt', onclick: onSwitch }, '🔄 Schimbă')),
    el('h1', null, 'Alege un joc!'),
    grid);
}
