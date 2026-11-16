// Panouri informative mari: tren (încărcătură, mod Automat/Manual), ziar, stratul Mărfuri + panourile de economie.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS } from '../sim/consts.js';
import { GOODS, CAR_TYPES, CAR_OF, NG } from '../sim/goods.js';
import { tileDist, capacity, carried } from '../sim/cargo.js';
import { goodsLinks } from '../sim/links.js';
import { createCard } from './card.js';
import { viewer } from '../sim/viewer.js';
import { createEcoPanels } from './ecoPanels.js';
import { lei } from './hud.js';

export function createPanels(root, ev) {
  const card = createCard(root), { open, close, row, goodRow, chip } = card;
  const eco = createEcoPanels(card, ev);

  /** Mărfurile pe care le poate duce un tren (după vagoanele lui). */
  const carriable = (t) => GOODS.map((_, g) => g).filter((g) => t.kinds.includes(CAR_OF[g]));

  function orderRows(s, t, api) {
    if (!t.orders) return h('button', { class: 'opt', onclick: () => { ev.orders(t.id, t.route.map(() => ({ load: carriable(t), unload: null }))); api.train(s, t); } }, '🤖 Mod: Automat', h('small', null, 'Atinge ca să alegi tu ce încarcă'));
    return [
      h('button', { class: 'opt on', onclick: () => { ev.orders(t.id, null); api.train(s, t); } }, '🛠️ Mod: Manual', h('small', null, 'Atinge ca să revii la Automat')),
      ...t.route.map((id, i) => h('div', { class: 'stop' }, h('div', null, `${i + 1}. ` + (s.stations.find((q) => q.id === id) || { name: '?' }).name + ' — încarcă:'),
        h('div', { class: 'chips' }, carriable(t).map((g) => {
          const on = t.orders[i] && t.orders[i].load && t.orders[i].load.includes(g);
          return h('button', { class: 'gchip btn' + (on ? ' on' : ''), style: { background: GOODS[g].color }, title: GOODS[g].name, onclick: () => {
            const o = t.orders.map((x) => ({ load: x.load ? x.load.slice() : [], unload: x.unload })), l = o[i].load, k = l.indexOf(g);
            if (k >= 0) l.splice(k, 1); else l.push(g);
            ev.orders(t.id, o); api.train(s, t);
          } }, GOODS[g].icon);
        })))),
    ];
  }

  const api = {
    card, isOpen: card.isOpen, close, city: eco.city, industry: eco.industry, station: eco.station,
    train(s, t) {
      const m = MODELS[t.model], cap = capacity(t);
      const names = t.route.map((id) => (s.stations.find((q) => q.id === id) || { name: '?' }).name).join(' ⇄ ');
      const dest = s.stations.find((q) => q.id === t.to);
      const loadRows = [];
      for (let g = 0; g < NG; g++) if (carried(t, g)) loadRows.push(goodRow(g, carried(t, g)));
      open(h('h3', null, `🚂 Trenul ${t.id}`), h('div', null, `${m.name} · ${t.cars} vagoane: ` + t.kinds.map((k) => CAR_TYPES[k].icon).join('')), h('div', null, names),
        row('Merge spre', dest ? dest.name : '—'), row('Viteză', `${m.vmax * 4} km/h`), row('Trage bine', `${m.power} vagoane`), row('Fiabilitate', `${m.rel}%`), row('Întreținere', lei(m.maint) + '/lună'),
        t.cars > m.power ? h('div', null, '⚠️ Are prea multe vagoane pentru locomotivă, așa că merge mai încet.') : null,
        t.broken ? h('div', null, '🔧 S-a stricat puțin. Se repară într-o zi!') : null,
        h('div', null, h('b', null, 'Încărcătură')), loadRows.length ? loadRows : h('div', null, 'Gol deocamdată.'),
        row('Locuri', cap.map((c, k) => (c ? CAR_TYPES[k].icon + c : '')).join(' ')), row('A câștigat', lei(t.money)),
        t.route.length < 2 ? h('div', null, 'Trenul nu are încă o rută. Folosește 🚂 și alege două gări.') : null,
        t.lost ? h('div', null, '🤔 Nu găsește drum: leagă gările cu șină!') : null,
        orderRows(s, t, api),
        h('div', { class: 'btns' }, h('button', { class: 'opt no', onclick: () => { ev.sell(t.id); close(); } }, 'Vinde trenul')));
    },
    news(s) {
      const co = s.companies[viewer.co] || s.companies[0], last = co.history.slice(-6).reverse();
      open(h('h3', null, '📰 Ziarul orașelor'), row('Bani', lei(co.cash)), row('Trenuri', s.trains.length), row('Gări', s.stations.length),
        h('div', null, h('b', null, 'Ultimele luni')), last.length ? last.map((v, i) => row(`Luna -${i + 1}`, (v >= 0 ? '+' : '') + lei(v))) : h('div', null, 'Prima lună nu s-a încheiat încă.'),
        h('div', null, h('b', null, 'Știri')), s.news.slice(-8).reverse().map((n) => h('div', { class: 'news' }, n.icon + ' ' + n.text)));
    },
    layer(s) {
      const used = [...new Set(goodsLinks(s).map((l) => l.good))];
      open(h('h3', null, '📦 Mărfuri'), h('div', null, 'Săgețile arată ce se poate lega: marfa pleacă de la industrie spre cine o vrea (altă industrie sau un oraș).'),
        used.map((g) => h('div', { class: 'row' }, h('span', null, chip(g), ' ' + GOODS[g].name), h('b', null, '➜'))),
        h('div', null, 'Pune gări lângă amândouă și leagă-le cu șină. Apoi cumpără un tren cu vagoanele potrivite!'));
    },
    cityNear: (s, x, y) => s.cities.find((c) => tileDist(c, { x, y }) <= 3),
    industryNear: (s, x, y) => s.industries.find((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1),
  };
  return api;
}
