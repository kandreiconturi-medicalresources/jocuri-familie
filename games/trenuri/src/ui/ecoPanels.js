// Panouri de economie: oraș (ce vrea, ce primește), industrie (ce produce, ce vrea, stoc), gară (așteaptă, îmbunătățiri).
import { h } from '../../../../shared/ui/dom.js';
import { CITY_LEVELS, UPGRADES, STATION_NAMES } from '../sim/consts.js';
import { GOODS, INDUSTRIES, CITY_GOODS, NG, wantOf } from '../sim/goods.js';
import { near } from '../sim/industry.js';
import { industryAdvice } from '../sim/advice.js';
import { lei } from './hud.js';
import { destSection, supplySection } from './destList.js';
import { PROD } from '../sim/consts.js';

const LEVEL = ['Sat', 'Oraș', 'Metropolă'];

export function createEcoPanels(card, ev) {
  const { open, row, goodRow, chip } = card;
  const api = {
    city(s, c) {
      const next = CITY_LEVELS[c.level + 1], list = [0, 1, ...CITY_GOODS[c.level]];
      const newer = c.level < 2 ? CITY_GOODS[c.level + 1].filter((g) => !CITY_GOODS[c.level].includes(g)) : [];
      const el = open(h('h3', null, '🏘️ ' + c.name), row('Tip', LEVEL[c.level]), row('Locuitori', c.pop), row('Case', c.buildings.length),
        h('div', null, next ? `Mai are nevoie de ${next - c.pop} locuitori ca să crească.` : 'E cel mai mare oraș posibil!'),
        h('div', null, h('b', null, 'Ce vrea orașul luna asta')),
        list.map((g) => goodRow(g, `${c.got[g]} din ${wantOf(c, g)}`, c.got[g] >= wantOf(c, g) ? ' ✅' : '')),
        h('div', null, h('b', null, 'Cine îl poate aproviziona')),
        ...CITY_GOODS[c.level].flatMap((g) => [h('div', null, chip(g), ' ' + GOODS[g].name + ` · cere ${wantOf(c, g)}/lună`), supplySection(s, ev, c, g, 2)]),
        newer.length ? h('div', null, 'Când crește, va vrea și: ', newer.map((g) => chip(g))) : null,
        h('div', null, 'Adu-i ce cere și orașul crește mai repede!'));
      el.classList.add('wide');
    },
    industry(s, o) {
      const t = INDUSTRIES[o.type], hasSt = s.stations.some((st) => near(st, o)), adv = industryAdvice(s, o);
      const per = t.in.length ? null : o.boost ? (PROD * 3) >> 1 : PROD;
      const el = open(h('h3', null, `${t.icon} ${o.name}`),
        h('div', { class: adv.ok ? 'why ok' : 'why' }, adv.lines.map((l) => h('div', null, l)),
          adv.goto && ev.show ? h('button', { class: 'opt', onclick: () => ev.show(adv.goto.x, adv.goto.y) }, '📍 Arată pe hartă', h('small', null, adv.goto.name)) : null),
        t.out >= 0 ? h('div', { class: 'prod' }, 'Produce: ', chip(t.out), ' ' + GOODS[t.out].name, per ? ` · ${per} pe lună` : ' · cât primește (câte 1 din fiecare intrare)') : h('div', null, 'Nu produce marfă, dar are nevoie de combustibil ca să meargă.'),
        t.in.length ? h('div', null, 'Vrea: ', t.in.map((g) => chip(g))) : h('div', null, 'Nu are nevoie de nimic: produce singură.'),
        ...t.in.map((g) => goodRow(g, o.in[g], ' în stoc')),
        t.out >= 0 ? goodRow(t.out, o.out[t.out], ' gata de dus') : null,
        row('A făcut în total', o.made),
        h('div', null, hasSt ? '🚉 O gară e aproape: marfa poate pleca.' : '🚉 Pune o gară lângă ea ca să ia marfa.'),
        t.out >= 0 ? [h('h4', null, `Spre ce poate duce ${GOODS[t.out].name.toLowerCase()} (cel mai bun profit întâi)`), destSection(s, ev, o, t.out)] : null,
        t.in.length ? [h('h4', null, 'Cine o poate aproviza'), ...t.in.flatMap((g) => [h('div', null, chip(g), ' ' + GOODS[g].name), supplySection(s, ev, o, g)])] : null);
      el.classList.add('wide');
    },
    station(s, st) {
      const trains = s.trains.filter((t) => t.route.includes(st.id));
      const goods = [];
      for (let g = 2; g < NG; g++) if (st.cargo[g] > 0) goods.push(goodRow(g, st.cargo[g]));
      const ind = s.industries.filter((o) => near(st, o));
      open(h('h3', null, '🚉 ' + st.name), h('div', null, STATION_NAMES[st.size]), row('👥 Pasageri care așteaptă', st.waiting.pass), row('✉️ Poștă', st.waiting.mail),
        ...goods, row('Trenuri aici', trains.length),
        ind.length ? h('div', null, 'Industrii în rază: ', ind.map((o) => INDUSTRIES[o.type].icon + ' ' + o.name).join(', ')) : null,
        h('div', null, h('b', null, 'Îmbunătățiri')), h('div', { class: 'note' }, 'Depoul de apă umple locomotivele cu abur (merg mai repede). Atelierul repară trenurile.'),
        UPGRADES.map((u, k) => st.up[k]
          ? h('div', { class: 'upg done' }, `${u.icon} ${u.name} ✅`)
          : h('button', { class: 'opt upg', onclick: () => { if (ev.upgrade(st.id, k)) api.station(s, st); } }, `${u.icon} ${u.name} · ${lei(u.cost)}`, h('small', null, u.text))));
    },
  };
  return api;
}
