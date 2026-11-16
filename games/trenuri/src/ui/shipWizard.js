// Asistentul 🚢 Vapor (etapa 7.2): portul tău → destinația → ce duci de acasă → ce faci acolo (bani / schimb / cumpăr) → vaporul.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS, NG } from '../sim/goods.js';
import { SHIP_MODELS } from '../sim/consts.js';
import { islandAt, portsOf, matMissing, missingText } from '../sim/islands.js';
import { priceOf } from '../sim/market.js';
import { seaPath } from '../sim/seaPath.js';
import { lei } from './hud.js';

/** Ruta trimisă simulării din alegerile asistentului (funcție pură, folosită și în teste). */
export function wizardRoute(o) {
  const home = { p: o.from, a: 'sell', g: [] };
  if (o.take && o.take.length) home.l = o.take.slice();
  const there = o.mode === 'swap' ? { p: o.to, a: 'swap', g: [], w: o.w } : o.mode === 'load' ? { p: o.to, a: 'load', g: [o.w] } : { p: o.to, a: 'sell', g: [] };
  return [home, there];
}

/** ctx = { card, state(), me(), exec(cmd), hint(text, warn) }, preset = { from?, to?, shipId? } */
export function openShipWizard(ctx, preset = {}) {
  const { open } = ctx.card, s0 = ctx.state(), me = ctx.me();
  const o = { from: preset.from || null, to: preset.to || null, take: [], mode: 'sell', w: -1, model: -1, shipId: preset.shipId || null, step: 0 };
  const mineP = portsOf(s0, me);
  if (!mineP.length) { open(h('h3', null, '🚢 Vapor nou'), h('div', { class: 'news' }, 'Ai nevoie întâi de un port ⚓ pe insula ta (pe coastă, lângă apă).')); return; }
  if (!o.from || !mineP.some((p) => p.id === o.from)) o.from = mineP.length === 1 ? mineP[0].id : null;
  o.step = o.from ? (o.to ? 2 : 1) : 0;
  const S = () => ctx.state(), port = (id) => S().stations.find((q) => q.id === id);
  const btn = (label, fn, cls, small) => h('button', { class: 'opt ' + (cls || ''), onclick: fn }, label, small ? h('small', null, small) : null);
  const go = (k) => { o.step = k; draw(); };
  const stockIcons = (p) => { const out = []; for (let g = 2; g < NG; g++) if (p.cargo[g] > 0) out.push(GOODS[g].icon + p.cargo[g]); return out.join(' ') || 'depozit gol'; };

  function step0() {
    return [h('p', null, '1. De unde pleacă vaporul?'), mineP.map((p) => btn('⚓ ' + p.name, () => { o.from = p.id; go(1); }, o.from === p.id ? 'on' : '', stockIcons(p)))];
  }
  function step1() {
    const s = S(), A = port(o.from), list = s.stations.filter((q) => q.port && q.id !== o.from);
    return [h('p', null, '2. Unde merge?'), list.length ? list.map((p) => {
      const k = islandAt(s, p.x, p.y), ok = !!seaPath(s, A.dock, p.dock);
      return btn(`${p.owner === me ? '⚓' : '🏝️'} ${p.name}`, ok ? () => { o.to = p.id; go(2); } : () => ctx.hint('Nu se ajunge pe apă până acolo.', true), o.to === p.id ? 'on' : '', `${k >= 0 ? s.islands[k].name : ''} · ${p.owner === me ? 'al tău' : s.companies[p.owner].name} · ${stockIcons(p)}`);
    }) : h('div', { class: 'news' }, 'Nu există alt port încă. Concurenții au porturi pe insulele lor.')];
  }
  function step2() {
    const A = port(o.from), have = [];
    for (let g = 2; g < NG; g++) if (A.cargo[g] > 0) have.push(g);
    return [h('p', null, '3. Ce duci de acasă? (poți să nu duci nimic)'),
      have.length ? have.map((g) => btn(`${o.take.includes(g) ? '✅' : '⬜'} ${GOODS[g].icon} ${GOODS[g].name}`, () => { o.take = o.take.includes(g) ? o.take.filter((x) => x !== g) : o.take.concat([g]); draw(); }, o.take.includes(g) ? 'on' : '', `${A.cargo[g]} t în depozit`)) : h('div', { class: 'news' }, 'Depozitul tău e gol: vaporul pleacă gol și cumpără acolo.'),
      btn('Mai departe ➡️', () => go(3), 'go')];
  }
  function step3() {
    const s = S(), B = port(o.to), k = islandAt(s, B.x, B.y), there = [];
    for (let g = 2; g < NG; g++) if (B.cargo[g] > 0) there.push(g);
    const pick = (mode) => there.map((g) => btn(`${GOODS[g].icon} ${GOODS[g].name}`, () => { o.mode = mode; o.w = g; go(4); }, o.mode === mode && o.w === g ? 'on' : '', `${B.cargo[g]} t · ${lei(priceOf(s, k, g))}/t`));
    return [h('p', null, `4. La ${B.name}:`),
      o.take.length && B.owner !== me ? btn('💰 Vinde pe bani', () => { o.mode = 'sell'; o.w = -1; go(4); }, o.mode === 'sell' ? 'on' : '', 'la prețul pieței de acolo') : null,
      B.owner === me ? btn('📦 Descarcă în depozit', () => { o.mode = 'sell'; o.w = -1; go(4); }, o.mode === 'sell' ? 'on' : '') : null,
      there.length && o.take.length ? [h('div', null, h('b', null, '🔁 Schimbă ce duci pe:')), pick('swap')] : null,
      there.length ? [h('div', null, h('b', null, '📥 Cumpără și adu acasă:')), pick('load')] : h('div', { class: 'news' }, 'Depozitul de acolo e gol acum.')];
  }
  function step4() {
    const s = S(), owned = s.ships.some((q) => q.owner === me);
    const route = wizardRoute(o);
    if (o.shipId) return [h('p', null, '5. Gata?'), btn('✅ Schimbă ruta', () => { if (ctx.exec({ type: 'setShipRoute', shipId: o.shipId, route }).ok) { ctx.hint('🚢 Ruta nouă e pusă!'); ctx.card.close(); } }, 'go')];
    return [h('p', null, '5. Alege vaporul'), SHIP_MODELS.filter((m) => m.year <= s.date.y).map((m) => {
      const miss = owned ? matMissing(s, me, m.mat) : [];
      return btn(`🚢 ${m.name}`, () => {
        if (miss.length) { ctx.hint(missingText(s, s.companies[me], miss), true); return; }
        const r = ctx.exec({ type: 'buyShip', portId: o.from, model: m.id, route });
        if (r.ok) { ctx.hint(`🚢 ${m.name} pleacă spre ${port(o.to).name}!`); ctx.card.close(); }
      }, miss.length ? 'locked' : '', `${lei(m.price)} · ${m.cap} t · întreținere ${lei(m.maint)}/lună${owned ? ' · 🧱 ' + m.mat.map(([g, n]) => n + ' t ' + GOODS[g].name.toLowerCase()).join(', ') : ' · primul e fără materiale'}`);
    })];
  }
  function draw() {
    const steps = [step0, step1, step2, step3, step4];
    open(h('h3', null, o.shipId ? '🧭 Rută nouă pentru vapor' : '🚢 Vapor nou'), ...steps[o.step](),
      o.step > 0 && !(o.step === 1 && mineP.length === 1) ? btn('⬅️ Înapoi', () => go(o.step - 1)) : null);
  }
  draw();
}
