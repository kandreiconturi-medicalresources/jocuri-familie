// Panouri de economie: oraș (ce vrea, ce primește), industrie (ce produce, ce vrea, stoc), gară (așteaptă, îmbunătățiri).
import { h } from '../../../../shared/ui/dom.js';
import { CITY_LEVELS, UPGRADES, STATION_NAMES } from '../sim/consts.js';
import { GOODS, INDUSTRIES, CITY_GOODS, NG, wantOf } from '../sim/goods.js';
import { near } from '../sim/industry.js';
import { industryAdvice } from '../sim/advice.js';
import { lei } from './hud.js';
import { destSection, supplySection } from './destList.js';
import { cityCards } from './plannerCards.js';
import { PROD } from '../sim/consts.js';
import { islandAt } from '../sim/islands.js';
import { industryPrice } from '../sim/land.js';
import { thruInfo, THRU_MAX } from '../sim/thru.js';

const LEVEL = ['Sat', 'Oraș', 'Metropolă'];

export function createEcoPanels(card, ev) {
  const { open, row, goodRow, chip } = card;
  /** Gara mare de trecere: câte linii are, butoane pentru linii în plus (cu preț); la gara normală din oraș, transformarea. */
  const thruRows = (s, st) => {
    const me = ev.me ? ev.me() : 0;
    if (st.port || st.big || st.owner !== me || !ev.thru) return null;
    const opts = [];
    for (let n = st.thru ? st.platforms + 1 : 2; n <= THRU_MAX && opts.length < 4; n++) {
      const r = thruInfo(s, me, st.x, st.y, n, st.thru ? st.dir : undefined);
      if (r.ok) opts.push(h('button', { class: 'opt', onclick: () => { if (st.thru ? ev.thru(st.id, n) : ev.toThru(st.x, st.y, n)) api.station(s, st); } }, `🏙️ ${n} linii · ${lei(r.cost)}`, r.houses.length ? h('small', null, `${r.houses.length} case mutate`) : null));
    }
    const busy = s.trains.filter((t) => t.state === 2 && t.to === st.id).length;
    return st.thru ? [row('🛤️ Linii (trenuri deodată)', `${busy} ocupate din ${st.platforms}`), h('div', { class: 'note' }, '🏙️ Acoperă tot orașul: toți locuitorii, poșta și cererea de marfă.'), ...opts]
      : st.cityId >= 0 && opts.length ? [h('div', null, h('b', null, 'Fă-o gară mare de trecere')), h('div', { class: 'note' }, 'Linii paralele, peroane, pasarelă, clădire mare; acoperă tot orașul.'), ...opts] : null;
  };
  /** „Cumpără industria” (etapa 7.4): industrie de pe insula altuia; marfa ei merge apoi la gările tale. */
  const buyBtn = (s, o) => {
    const k = s.islands ? islandAt(s, o.x, o.y) : -1, me = ev.me ? ev.me() : 0;
    if (k < 0 || s.islands[k].owner < 0 || s.islands[k].owner === me) return o.buyer !== undefined && s.islands && o.buyer === me ? h('div', { class: 'why ok' }, '🏭 E a ta: marfa ei merge la gările tale.') : null;
    if (o.buyer !== undefined) return h('div', { class: 'why' }, `🏭 A fost cumpărată de ${s.companies[o.buyer].name}.`);
    const price = industryPrice(o);
    return h('button', { class: 'opt', onclick: () => { if (ev.buyIndustry && ev.buyIndustry(o.id)) api.industry(s, o); } }, `🏭 Cumpără industria · ${lei(price)}`, h('small', null, 'Primești marfa ei, la gările tale din rază. Banii merg la stăpânul insulei.'));
  };
  const api = {
    city(s, c) {
      const next = CITY_LEVELS[c.level + 1], list = [0, 1, ...CITY_GOODS[c.level]];
      const newer = c.level < 2 ? CITY_GOODS[c.level + 1].filter((g) => !CITY_GOODS[c.level].includes(g)) : [];
      const el = open(h('h3', null, '🏘️ ' + c.name), row('Tip', LEVEL[c.level]), row('Locuitori', c.pop), row('Case', c.buildings.length),
        h('div', null, next ? `Mai are nevoie de ${next - c.pop} locuitori ca să crească.` : 'E cel mai mare oraș posibil!'),
        h('div', null, h('b', null, 'Ce cere orașul luna asta')),
        list.map((g) => goodRow(g, `${c.got[g]} din ${wantOf(c, g)}` + (c.prev ? ` · luna trecută ${c.prev[g]}` : ''), c.got[g] >= wantOf(c, g) ? ' ✅' : '')),
        ev.plan ? cityCards(s, c, (g) => ev.plan({ city: c, g })) : h('div', null, h('b', null, 'Cine îl poate aproviziona')),
        ...(ev.plan ? [] : CITY_GOODS[c.level]).flatMap((g) => [h('div', null, chip(g), ' ' + GOODS[g].name + ` · cere ${wantOf(c, g)}/lună`), supplySection(s, ev, c, g, 2)]),
        newer.length ? h('div', null, 'Când crește, va vrea și: ', newer.map((g) => chip(g))) : null,
        h('div', null, 'Adu-i ce cere și orașul crește mai repede!'));
      el.classList.add('wide');
    },
    industry(s, o) {
      const t = INDUSTRIES[o.type], hasSt = s.stations.some((st) => near(st, o)), atSt = t.out >= 0 ? s.stations.reduce((n, st) => n + (near(st, o) ? st.cargo[t.out] : 0), 0) : 0, adv = industryAdvice(s, o);
      const per = t.in.length ? null : o.boost ? (PROD * 3) >> 1 : PROD;
      const el = open(h('h3', null, `${t.icon} ${o.name}`),
        h('div', { class: adv.ok ? 'why ok' : 'why' }, adv.lines.map((l) => h('div', null, l)),
          adv.goto && ev.show ? h('button', { class: 'opt', onclick: () => ev.show(adv.goto.x, adv.goto.y) }, '📍 Arată pe hartă', h('small', null, adv.goto.name)) : null),
        t.out >= 0 ? h('div', { class: 'prod' }, 'Produce: ', chip(t.out), ' ' + GOODS[t.out].name, per ? ` · ${per} pe lună` : ' · cât primește (câte 1 din fiecare intrare)') : h('div', null, 'Nu produce marfă, dar are nevoie de combustibil ca să meargă.'),
        t.in.length ? h('div', null, 'Vrea: ', t.in.map((g) => chip(g))) : h('div', null, 'Nu are nevoie de nimic: produce singură.'),
        ...t.in.map((g) => goodRow(g, o.in[g], ' în stoc')),
        t.out >= 0 ? goodRow(t.out, o.out[t.out], ' gata în fabrică') : null,
        t.out >= 0 && hasSt ? goodRow(t.out, atSt, ' așteaptă în gară') : null,
        row('A făcut în total', o.made),
        h('div', null, hasSt ? '🚉 O gară e aproape: marfa poate pleca.' : '🚉 Pune o gară lângă ea ca să ia marfa.'),
        buyBtn(s, o),
        t.out >= 0 && ev.plan ? h('button', { class: 'opt go', onclick: () => ev.plan({ industry: o, g: t.out }) }, '🧭 Unde o duc?', h('small', null, 'Planificatorul alege cel mai bun oraș')) : null,
        t.out >= 0 ? [h('h4', null, `Spre ce poate duce ${GOODS[t.out].name.toLowerCase()} (cel mai bun profit întâi)`), destSection(s, ev, o, t.out)] : null,
        t.in.length ? [h('h4', null, 'Cine o poate aproviza'), ...t.in.flatMap((g) => [h('div', null, chip(g), ' ' + GOODS[g].name), supplySection(s, ev, o, g)])] : null);
      el.classList.add('wide');
    },
    station(s, st) {
      const trains = s.trains.filter((t) => t.route.includes(st.id));
      const goods = [];
      for (let g = 2; g < NG; g++) if (st.cargo[g] > 0) goods.push(goodRow(g, st.cargo[g]));
      const ind = s.industries.filter((o) => near(st, o));
      open(h('h3', null, '🚉 ' + st.name), h('div', null, st.big ? 'Terminal mare' : st.thru ? 'Gară mare de trecere' : STATION_NAMES[st.size]), row('👥 Pasageri care așteaptă', st.waiting.pass), row('✉️ Poștă', st.waiting.mail),
        ...goods, row('Trenuri aici', trains.length),
        st.big ? [row('🛤️ Linii terminale', `${s.trains.filter((t) => t.state === 2 && t.to === st.id).length} ocupate din ${st.platforms}`),
          h('div', { class: 'note' }, '🔧 Service: trenul care oprește aici e reparat complet. 🏗️ Macaraua încarcă și descarcă de două ori mai repede. Mai multe linii (până la 6): 🧰 Mai mult → ⬆️ Gară mai mare.')] : null,
        thruRows(s, st),
        ind.length ? h('div', null, 'Industrii în rază: ', ind.map((o) => INDUSTRIES[o.type].icon + ' ' + o.name).join(', ')) : null,
        h('div', null, h('b', null, 'Îmbunătățiri')), h('div', { class: 'note' }, 'Depoul de apă umple locomotivele cu abur (merg mai repede). Atelierul repară trenurile.'),
        UPGRADES.map((u, k) => st.up[k]
          ? h('div', { class: 'upg done' }, `${u.icon} ${u.name} ✅`)
          : h('button', { class: 'opt upg', onclick: () => { if (ev.upgrade(st.id, k)) api.station(s, st); } }, `${u.icon} ${u.name} · ${lei(u.cost)}`, h('small', null, u.text))));
    },
  };
  return api;
}
