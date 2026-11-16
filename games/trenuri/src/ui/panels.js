// Panouri informative mari: ziar, stratul Mărfuri + panourile de economie și de tren.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';
import { tileDist } from '../sim/cargo.js';
import { goodsLinks } from '../sim/links.js';
import { createCard } from './card.js';
import { viewer } from '../sim/viewer.js';
import { createEcoPanels } from './ecoPanels.js';
import { createTrainPanel } from './trainPanel.js';
import { lei } from './hud.js';

export function createPanels(root, ev) {
  const card = createCard(root), { open, close, row, goodRow, chip } = card;
  const eco = createEcoPanels(card, ev);

  const trainPanel = createTrainPanel(card, ev);

  const api = {
    card, isOpen: card.isOpen, close, city: eco.city, industry: eco.industry, station: eco.station, train: trainPanel,
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
