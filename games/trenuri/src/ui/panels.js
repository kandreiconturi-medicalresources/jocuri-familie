// Panouri informative mari: oraș, gară, tren, ziar + finanțe.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS, CITY_LEVELS } from '../sim/consts.js';
import { tileDist, capacity } from '../sim/trains.js';
import { lei } from './hud.js';

const LEVEL = ['Sat', 'Oraș', 'Metropolă'];

export function createPanels(root, ev) {
  let el = null;
  const close = () => { if (el) { el.remove(); el = null; } };
  const open = (...kids) => {
    if (el) el.remove();
    el = h('div', { class: 'card' }, h('button', { class: 'rb x', onclick: close, 'aria-label': 'Închide' }, '✖'), ...kids);
    root.append(el);
    return el;
  };
  const row = (a, b) => h('div', { class: 'row' }, h('span', null, a), h('b', null, b));

  return {
    close,
    city(c) {
      const next = CITY_LEVELS[c.level + 1];
      open(h('h3', null, '🏘️ ' + c.name), row('Tip', LEVEL[c.level]), row('Locuitori', c.pop), row('Case', c.buildings.length),
        h('div', null, next ? `Mai are nevoie de ${next - c.pop} locuitori ca să crească.` : 'E cel mai mare oraș posibil!'),
        h('div', null, 'Orașele cu gară și trenuri pline cresc mai repede.'));
    },
    station(s, st) {
      const trains = s.trains.filter((t) => t.route.includes(st.id));
      open(h('h3', null, '🚉 ' + st.name), row('👥 Pasageri care așteaptă', st.waiting.pass), row('✉️ Poștă', st.waiting.mail),
        row('Trenuri aici', trains.length), h('div', null, 'Gara ia oameni din orașele apropiate.'));
    },
    train(s, t) {
      const m = MODELS[t.model], cap = capacity(t);
      const pass = t.load.reduce((n, b) => n + (b.c === 0 ? b.n : 0), 0), mail = t.load.reduce((n, b) => n + (b.c === 1 ? b.n : 0), 0);
      const names = t.route.map((id) => (s.stations.find((q) => q.id === id) || { name: '?' }).name).join(' ⇄ ');
      const dest = s.stations.find((q) => q.id === t.to);
      open(h('h3', null, `🚂 Trenul ${t.id}`), h('div', null, m.name + ' · ' + t.cars + ' vagoane'), h('div', null, names),
        row('Merge spre', dest ? dest.name : '—'), row('👥 Pasageri', `${pass} / ${cap[0]}`), row('✉️ Poștă', `${mail} / ${cap[1]}`), row('A câștigat', lei(t.money)),
        t.route.length < 2 ? h('div', null, 'Trenul nu are încă o rută. Folosește 🚂 și alege două gări.') : null,
        t.lost ? h('div', null, '🤔 Nu găsește drum: leagă gările cu șină!') : null,
        h('div', { class: 'btns' }, h('button', { class: 'opt no', onclick: () => { ev.sell(t.id); close(); } }, 'Vinde trenul')));
    },
    news(s) {
      const co = s.companies[0], last = co.history.slice(-6).reverse();
      open(h('h3', null, '📰 Ziarul orașelor'), row('Bani', lei(co.cash)), row('Trenuri', s.trains.length), row('Gări', s.stations.length),
        h('div', null, h('b', null, 'Ultimele luni')), last.length ? last.map((v, i) => row(`Luna -${i + 1}`, (v >= 0 ? '+' : '') + lei(v))) : h('div', null, 'Prima lună nu s-a încheiat încă.'),
        h('div', null, h('b', null, 'Știri')), s.news.slice(-8).reverse().map((n) => h('div', { class: 'news' }, n.icon + ' ' + n.text)));
    },
    cityNear: (s, x, y) => s.cities.find((c) => tileDist(c, { x, y }) <= 3),
  };
}
