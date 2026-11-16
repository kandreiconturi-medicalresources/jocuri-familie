// Panoul portului (depozit + piața insulei + vapoare) și panoul vaporului (etapa 7.2).
import { h } from '../../../../shared/ui/dom.js';
import { GOODS, NG } from '../sim/goods.js';
import { SHIP_MODELS, MATS } from '../sim/consts.js';
import { islandAt, matHave } from '../sim/islands.js';
import { priceOf, basePrice } from '../sim/market.js';
import { portCap } from '../sim/ports.js';
import { shipLoad } from '../sim/shipTrade.js';
import { lei } from './hud.js';

const ACT = { load: '📥 încarcă', sell: '💰 vinde / descarcă', swap: '🔁 schimbă pe' };
const pname = (s, id) => { const p = s.stations.find((q) => q.id === id); return p ? p.name : '?'; };

/** ctx = { card, state(), me(), exec(cmd), show(x,y), wizard(preset), ship(sh) } */
export function openPortPanel(ctx, st0) {
  const { open, row, goodRow } = ctx.card;
  const draw = () => {
    const s = ctx.state(), st = s.stations.find((q) => q.id === st0.id);
    if (!st) return null;
    const me = ctx.me(), mine = st.owner === me, k = islandAt(s, st.x, st.y);
    const goods = [];
    for (let g = 2; g < NG; g++) if (st.cargo[g] > 0) goods.push(goodRow(g, `${st.cargo[g]} t`));
    const prices = [];
    for (let g = 2; g < NG; g++) { const p = priceOf(s, k, g), b = basePrice(g); prices.push(goodRow(g, `${lei(p)}/t ${p > b * 1.15 ? '⬆️' : p < b * 0.85 ? '⬇️' : ''}`)); }
    const ships = s.ships.filter((q) => q.dest === st.id || (q.owner === me && q.route.some((r) => r.p === st.id)));
    return open(h('h3', null, '⚓ ' + st.name),
      row('Al cui', mine ? 'al tău' : s.companies[st.owner].name), row('Insula', k >= 0 ? s.islands[k].name : '—'),
      row('Depozit', `cel mult ${portCap(st)} t din fiecare marfă`),
      h('div', null, h('b', null, '📦 În depozit')), goods.length ? goods : h('div', { class: 'news' }, 'Depozitul e gol. Adu marfă cu trenul sau cu vaporul.'),
      mine ? h('div', { class: 'note' }, 'Trenurile care aduc aici marfă de pe insula ta primesc bani în plus (export). Marfa din depozit o pot lua trenurile spre fabrici și orașe.')
        : h('div', { class: 'note' }, `Aici cumperi din depozit la prețul pieței (banii merg la ${s.companies[st.owner].name}) și vinzi ce aduci. Taxa de port e mică.`),
      mine ? h('div', { class: 'note' }, '🧱 Materiale: ' + [...new Set([...MATS.port, ...MATS.big, ...MATS.up].map((m) => m[0]))].map((g) => `${GOODS[g].icon} ${matHave(s, me, g)} t`).join(' · ')) : null,
      h('div', null, h('b', null, '⚖️ Piața insulei (preț pe tonă)')), prices,
      h('div', null, h('b', null, `🚢 Vapoare (${ships.length})`)),
      ships.map((q) => h('button', { class: 'opt', onclick: () => ctx.ship(q) }, `🚢 ${SHIP_MODELS[q.model].name} ${q.id} · ${q.state ? 'în port: ' + pname(s, q.dest) : 'spre ' + pname(s, q.dest)}`)),
      h('div', { class: 'rowb' }, h('button', { class: 'opt go', onclick: () => ctx.wizard(mine ? { from: st.id } : { to: st.id }) }, mine ? '🚢 Vapor nou de aici' : '🚢 Trimite un vapor aici'),
        h('button', { class: 'opt', onclick: () => ctx.show(st.x, st.y) }, '📍 Arată')));
  };
  let el = draw();
  const timer = setInterval(() => { if (!el || !el.isConnected) { clearInterval(timer); return; } el = draw(); }, 1500);
}

export function openShipPanel(ctx, sh0) {
  const { open, row, goodRow } = ctx.card;
  const draw = () => {
    const s = ctx.state(), sh = s.ships.find((q) => q.id === sh0.id);
    if (!sh) return open(h('h3', null, '🚢 Vaporul nu mai există'));
    const m = SHIP_MODELS[sh.model], mine = sh.owner === ctx.me(), dest = s.stations.find((q) => q.id === sh.dest);
    return open(h('h3', null, `🚢 ${m.name} ${sh.id}`),
      row('Al cui', s.companies[sh.owner].name), row('Unde', sh.state ? 'în ' + pname(s, sh.dest) : 'pe mare, spre ' + pname(s, sh.dest)),
      row('Cala', `${shipLoad(sh)} / ${m.cap} t`), sh.load.map((b) => goodRow(b.c, `${b.n} t`)),
      row('A câștigat', lei(sh.money)), row('Întreținere', lei(m.maint) + ' / lună'),
      h('div', null, h('b', null, 'Ruta')),
      sh.route.map((r, i) => h('div', { class: 'news' }, `${i + 1}. ${pname(s, r.p)}: ${ACT[r.a]}${r.a === 'swap' ? ' ' + GOODS[r.w].name.toLowerCase() : ''}${r.g.length ? ' (' + r.g.map((g) => GOODS[g].icon).join('') + ')' : ''}${r.l ? ' + încarcă ' + r.l.map((g) => GOODS[g].icon).join('') : ''}`)),
      mine ? h('div', { class: 'rowb' },
        h('button', { class: 'opt go', onclick: () => ctx.wizard({ shipId: sh.id, from: sh.route[0] ? sh.route[0].p : sh.dest }) }, '🧭 Rută nouă'),
        h('button', { class: 'opt', onclick: () => { if (ctx.exec({ type: 'sellShip', shipId: sh.id }).ok) ctx.card.close(); } }, `💲 Vinde (${lei(m.price >> 1)})`),
        dest ? h('button', { class: 'opt', onclick: () => ctx.show(dest.x, dest.y) }, '📍 Arată') : null) : null);
  };
  let el = draw();
  const timer = setInterval(() => { if (!el || !el.isConnected) { clearInterval(timer); return; } el = draw(); }, 1000);
}
