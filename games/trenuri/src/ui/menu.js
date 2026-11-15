// Meniul de titlu (peste harta care se rotește singură): Continuă, Scenarii, Construcție liberă, Tutorial, Joc nou.
// Sub-meniurile (Joc nou, Scenarii) se închid cu tap în afara panoului.
import { h } from '../../../../shared/ui/dom.js';
import { SCENARIOS, isUnlocked, MEDAL_ICONS } from '../sim/index.js';

const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function createMenu(root, { hasSave, medals, firstTime, onContinue, onNew, onScenario, onFree, onTutorial, onHome }) {
  let el = null, year = 1840;
  const mount = (node) => { if (el) el.remove(); el = node; root.append(el); };
  const back = (fn) => (e) => { if (e.target === e.currentTarget) fn(); }; // tap pe fundal

  function title() {
    mount(h('div', { class: 'menu' },
      h('h1', null, '🚂 Orașe pe Șine'),
      h('p', null, 'Leagă orașele cu trenuri și ajută-le să crească!'),
      h('div', { class: 'rowb' },
        hasSave ? h('button', { class: 'opt go', onclick: onContinue }, '▶️ Continuă jocul') : null,
        h('button', { class: 'opt' + (hasSave ? '' : ' go'), onclick: scenarios }, '🎯 Scenarii'),
        h('button', { class: 'opt', onclick: onFree }, '🧱 Construcție liberă'),
        h('button', { class: 'opt' + (firstTime ? ' glow' : ''), onclick: onTutorial }, '🎓 Tutorial')),
      h('div', { class: 'rowb' },
        h('button', { class: 'opt', onclick: newGame }, '🌍 Joc nou'),
        h('button', { class: 'opt', onclick: onHome }, '🏠 La meniu'))));
  }

  function newGame() {
    const size = (k, t, sub) => h('button', { class: 'opt', onclick: () => onNew(k, year) }, t, h('small', null, sub));
    const ys = [[1840, 'Începuturile', 'locomotive cu abur'], [1900, 'Epoca aburului', 'abur rapid'], [1950, 'Epoca nouă', 'diesel și electrice']];
    const yb = ys.map(([y, t, sub]) => h('button', { class: 'opt' + (y === year ? ' on' : ''), onclick: () => { year = y; yb.forEach((b, i) => b.classList.toggle('on', ys[i][0] === y)); } }, y + ' · ' + t, h('small', null, sub)));
    mount(h('div', { class: 'menu', onclick: back(title) }, h('div', { class: 'mp' },
      h('h2', null, '🌍 Joc nou'), h('p', null, 'Alege anul'), h('div', { class: 'rowb' }, yb), h('p', null, 'și harta'),
      h('div', { class: 'rowb' }, size('S', 'Hartă mică', '6–8 orașe'), size('M', 'Hartă medie', '8–11 orașe'), size('L', 'Hartă mare', '10–14 orașe')),
      h('button', { class: 'opt', onclick: title }, '⬅️ Înapoi'))));
  }

  function scenarios() {
    mount(h('div', { class: 'menu', onclick: back(title) }, h('div', { class: 'mp wide' },
      h('h2', null, '🎯 Scenarii'), h('p', null, 'Ia medalii ca să deblochezi următorul scenariu!'),
      h('div', { class: 'grid' }, SCENARIOS.map((sc, i) => {
        const open = isUnlocked(medals, i), m = medals[sc.id] | 0;
        return h('button', { class: 'opt sc' + (open ? '' : ' locked') + (m ? ' won' : ''), disabled: !open, onclick: () => detail(sc, i) },
          h('span', { class: 'ic' }, open ? sc.icon : '🔒'), h('span', { class: 'nm' }, `${i + 1}. ${sc.name}`), h('small', null, m ? MEDAL_ICONS[m] : open ? 'fără medalie' : 'blocat'));
      })),
      h('button', { class: 'opt', onclick: title }, '⬅️ Înapoi'))));
  }

  function detail(sc, i) {
    const m = medals[sc.id] | 0;
    mount(h('div', { class: 'menu', onclick: back(scenarios) }, h('div', { class: 'mp' },
      h('h2', null, `${sc.icon} ${i + 1}. ${sc.name}`), h('p', { class: 'story' }, sc.story),
      sc.goals.map((g) => h('div', { class: 'gl' }, g.text, h('br'), g.t.map((v, k) => MEDAL_ICONS[k + 1] + num(v)).join('   '))),
      h('div', { class: 'gl' }, `⏳ ${sc.years} ani · începe în ${sc.year} · 💰 ${num(sc.cash)} lei`), m ? h('div', { class: 'gl' }, 'Medalia ta: ' + MEDAL_ICONS[m]) : null,
      h('div', { class: 'rowb' }, h('button', { class: 'opt go', onclick: () => onScenario(sc.id) }, '▶️ Începe'), h('button', { class: 'opt', onclick: scenarios }, '⬅️ Înapoi')))));
  }

  title();
  return { close() { if (el) el.remove(); el = null; } };
}
