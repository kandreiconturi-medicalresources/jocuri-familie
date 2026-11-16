// Catalogul de construcții: categorii (Șine, Gări, Îmbunătățiri, Trenuri). Ce nu poți cumpăra apare gri, cu motivul.
import { h } from '../../../../shared/ui/dom.js';
import { BIG_COST } from '../sim/terminal.js';
import { BRIDGE } from '../sim/consts.js';
import { bridgeCost } from '../sim/bigBridge.js';
import { DEPOT, STATION_NAMES, STATION_COST, STATION_RADIUS, UPGRADES, MODELS, COST, CAR_PRICE } from '../sim/consts.js';
import { lei } from './hud.js';
import { viewer } from '../sim/viewer.js';

const TABS = ['🛤️ Șine', '🚉 Gări', '🔧 Îmbunătățiri', '🚂 Trenuri', '🏭 Depou'];
let tab = 0;

/** Un rând din catalog: gri când `why` (motivul) există. */
function entry({ icon, name, info, price, why, on, pick }) {
  return h('button', { class: 'opt cat' + (why ? ' dis' : '') + (on ? ' on' : ''), 'aria-disabled': why ? 'true' : null, onclick: () => { if (!why) pick(); } },
    h('span', { class: 'ci' }, icon), h('span', { class: 'cn' }, h('b', null, name), price !== undefined ? h('em', null, lei(price)) : null, h('small', null, info), why ? h('small', { class: 'cw' }, why) : null));
}

export function openCatalog(card, s, tools) {
  const co = s.companies[viewer.co] || s.companies[0], cash = s.sandbox ? Infinity : co.cash;
  const need = (cost) => (cash >= cost ? null : `Îți mai trebuie ${lei(cost - cash)}.`);
  const go = (c) => () => { card.close(); tools.choose(c); };
  const st = tools.state;
  const lists = [
    () => [
      entry({ icon: '🛤️', name: 'Șină normală', info: `Atingi punct după punct, apoi „Gata”. Circa ${lei(COST.tile)} pe placă; din șina existentă faci ramificații (macaz).`, on: st.tool === 'track', pick: go({ tool: 'track' }) }),
      entry({ icon: '🛤️🛤️', name: 'Șină paralelă', info: 'Dublează o șină la o placă distanță: linie dublă, trenurile aleg linia liberă.', on: st.tool === 'parallel', pick: go({ tool: 'parallel' }) }),
      entry({ icon: '🌉', name: 'Pod mare', info: `Linie dreaptă sau diagonală de pe uscat pe uscat, până la ${BRIDGE.max} plăci de apă. ${s.islands ? 'Cere oțel în depozitul porturilor tale (aprox. ½ tonă pe placă). ' : ''}Preț: ${lei(BRIDGE.base)} pe placă + ${lei(BRIDGE.sq)} × plăci², deci ${lei(bridgeCost(10))} la 10 plăci și ${lei(bridgeCost(30))} la 30.`, on: st.tool === 'bridge', pick: go({ tool: 'bridge' }) }),
      s.islands ? entry({ icon: '🏠', name: 'Cumpără teren', info: 'Parcele de 4×4 plăci pe insula altuia: prețul e de 3 ori valoarea terenului (depinde de teren, orașe și industrii din jur), iar banii merg la stăpânul insulei. Pe parcela ta poți pune șină, gară, port și capete de pod.', on: st.tool === 'land', pick: go({ tool: 'land' }) }) : null,
      entry({ icon: '🧹', name: 'Demolare', info: 'Șterge o placă de șină sau o gară (gratis).', on: st.tool === 'demolish', pick: go({ tool: 'demolish' }) }),
    ],
    () => STATION_NAMES.map((n, i) => entry({ icon: i === 2 ? '🏛️' : '🚉', name: i === 2 ? 'Terminal mare' : n, info: i === 2 ? `Raza ${STATION_RADIUS[i]} plăci, 4–6 linii terminale, service care repară trenurile și macara care încarcă de două ori mai repede. Ocupă 4×5 plăci.` : `Raza ${STATION_RADIUS[i]} plăci: adună oameni și marfă din jur.`, price: i === 2 ? BIG_COST : STATION_COST[i], why: need(i === 2 ? BIG_COST : STATION_COST[i]), on: st.tool === 'station' && st.size === i, pick: go({ tool: 'station', size: i }) })),
    () => [
      ...UPGRADES.map((u, k) => entry({ icon: u.icon, name: u.name, info: u.text, price: u.cost, why: !s.stations.length ? 'Construiește mai întâi o gară.' : need(u.cost), on: st.tool === 'upgrade' && st.up === k, pick: go({ tool: 'upgrade', up: k }) })),
      h('div', { class: 'note' }, 'Depoul de apă umple locomotivele cu abur (merg mai repede). Atelierul repară trenurile.'),
    ],
    () => MODELS.map((m) => {
      const fut = m.year > s.date.y, cost = m.price + 4 * CAR_PRICE;
      return entry({ icon: '🚂', name: m.name, info: `${m.vmax * 4} km/h · trage ${m.power} vagoane · fiabilitate ${m.rel}%${fut ? '' : ' · ' + lei(m.maint) + '/lună'}`, price: m.price,
        why: fut ? `Apare în anul ${m.year}.` : s.stations.length < 2 ? 'Ai nevoie de două gări legate cu șină.' : need(cost), on: st.tool === 'train' && st.model === m.id, pick: go({ tool: 'train', model: m.id }) });
    }),
    () => [
      entry({ icon: '🏭', name: 'Depou', info: 'La capătul unei linii: coadă, 2 linii de reparații și o macara. Trimite aici trenurile uzate; o remorcă salvează trenurile defecte.', price: DEPOT.cost, why: need(DEPOT.cost), on: st.tool === 'depot', pick: go({ tool: 'depot' }) }),
      entry({ icon: '🚑', name: 'Remorcă', info: 'Vine singură de la depou după o zi (modul simplu) sau o trimiți din panoul trenului defect.', pick: () => {} }),
    ],
  ];
  const draw = () => {
    const el = card.open(h('h3', null, '📋 Ce pot construi'),
      h('div', { class: 'tabs' }, TABS.map((t, i) => h('button', { class: 'opt tab' + (i === tab ? ' on' : ''), onclick: () => { tab = i; draw(); } }, t))),
      lists[tab]());
    el.classList.add('wide');
  };
  draw();
}
