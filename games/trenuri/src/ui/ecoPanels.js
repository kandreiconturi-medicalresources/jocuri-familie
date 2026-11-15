// Panouri de economie: oraș (ce vrea, ce primește), industrie (ce produce, ce vrea, stoc), gară (așteaptă, îmbunătățiri).
import { h } from '../../../../shared/ui/dom.js';
import { CITY_LEVELS, UPGRADES, STATION_NAMES } from '../sim/consts.js';
import { GOODS, INDUSTRIES, CITY_GOODS, NG, wantOf } from '../sim/goods.js';
import { near } from '../sim/industry.js';
import { lei } from './hud.js';

const LEVEL = ['Sat', 'Oraș', 'Metropolă'];

export function createEcoPanels(card, ev) {
  const { open, row, goodRow, chip } = card;
  const api = {
    city(s, c) {
      const next = CITY_LEVELS[c.level + 1], list = [0, 1, ...CITY_GOODS[c.level]];
      const newer = c.level < 2 ? CITY_GOODS[c.level + 1].filter((g) => !CITY_GOODS[c.level].includes(g)) : [];
      open(h('h3', null, '🏘️ ' + c.name), row('Tip', LEVEL[c.level]), row('Locuitori', c.pop), row('Case', c.buildings.length),
        h('div', null, next ? `Mai are nevoie de ${next - c.pop} locuitori ca să crească.` : 'E cel mai mare oraș posibil!'),
        h('div', null, h('b', null, 'Ce vrea orașul luna asta')),
        list.map((g) => goodRow(g, `${c.got[g]} din ${wantOf(c, g)}`, c.got[g] >= wantOf(c, g) ? ' ✅' : '')),
        newer.length ? h('div', null, 'Când crește, va vrea și: ', newer.map((g) => chip(g))) : null,
        h('div', null, 'Adu-i ce cere și orașul crește mai repede!'));
    },
    industry(s, o) {
      const t = INDUSTRIES[o.type], hasSt = s.stations.some((st) => near(st, o));
      open(h('h3', null, `${t.icon} ${o.name}`),
        t.out >= 0 ? h('div', null, 'Produce: ', chip(t.out), ' ' + GOODS[t.out].name) : h('div', null, 'Nu produce marfă, dar are nevoie de combustibil ca să meargă.'),
        t.in.length ? h('div', null, 'Vrea: ', t.in.map((g) => chip(g))) : h('div', null, 'Nu are nevoie de nimic: produce singură.'),
        ...t.in.map((g) => goodRow(g, o.in[g], ' în stoc')),
        t.out >= 0 ? goodRow(t.out, o.out[t.out], ' gata de dus') : null,
        row('A făcut în total', o.made),
        h('div', null, hasSt ? '🚉 O gară e aproape: marfa poate pleca.' : '🚉 Pune o gară lângă ea ca să ia marfa.'));
    },
    station(s, st) {
      const trains = s.trains.filter((t) => t.route.includes(st.id));
      const goods = [];
      for (let g = 2; g < NG; g++) if (st.cargo[g] > 0) goods.push(goodRow(g, st.cargo[g]));
      const ind = s.industries.filter((o) => near(st, o));
      open(h('h3', null, '🚉 ' + st.name), h('div', null, STATION_NAMES[st.size]), row('👥 Pasageri care așteaptă', st.waiting.pass), row('✉️ Poștă', st.waiting.mail),
        ...goods, row('Trenuri aici', trains.length),
        ind.length ? h('div', null, 'Industrii în rază: ', ind.map((o) => INDUSTRIES[o.type].icon + ' ' + o.name).join(', ')) : null,
        h('div', null, h('b', null, 'Îmbunătățiri')),
        UPGRADES.map((u, k) => st.up[k]
          ? h('div', { class: 'upg done' }, `${u.icon} ${u.name} ✅`)
          : h('button', { class: 'opt upg', onclick: () => { if (ev.upgrade(st.id, k)) api.station(s, st); } }, `${u.icon} ${u.name} · ${lei(u.cost)}`, h('small', null, u.text))));
    },
  };
  return api;
}
