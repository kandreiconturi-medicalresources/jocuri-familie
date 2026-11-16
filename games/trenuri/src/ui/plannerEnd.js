// Pașii 5 și 6 ai planificatorului: „Mai e cineva care vrea aceeași marfă?” (ocol, același tren sau tren nou) și rezumatul final cu „Fă tot”.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS, CAR_TYPES, CAR_OF } from '../sim/goods.js';
import { otherTakers, NEAR_PCT } from '../sim/planner.js';
import { nm, money, line } from './plannerView.js';
import { lei } from './hud.js';

/** Pasul 5: caută alte orașe care cer aceeași marfă și calculează ocolul. */
export function othersStep(c) {
  const { p, s } = c, pl = c.plan(), out = [];
  out.push(h('div', { class: 'note' }, `Poți duce ${GOODS[p.g].icon} ${GOODS[p.g].name.toLowerCase()} și la alt oraș, pe același tren dacă e aproape de drum (ocol sub ${NEAR_PCT}%), altfel cu un tren nou.`));
  out.push(h('button', { class: 'opt go pl-next', onclick: () => c.set({ looked: true }, 5) }, '🔎 Mai e cineva care vrea aceeași marfă?'));
  if (p.looked) {
    const list = otherTakers(s, c.req(), pl);
    if (!list.length) out.push(h('div', { class: 'note' }, 'Nu mai e niciun alt oraș care cere marfa asta.'));
    list.forEach((e) => out.push(h('div', { class: 'pl-opt' + (e.onRoad && !e.noStock ? ' best' : '') },
      h('div', { class: 'pl-txt' }, h('b', null, nm(e.o)), h('span', null, `📏 ${e.d} plăci de la ${pl.stops[0].o.name} · cere ~${e.want} t/lună`), h('span', null, `↪️ ocol +${e.extra} plăci (${e.pct}% din traseu)`),
        e.noStock ? h('span', { class: 'pl-no' }, `🚫 N-ar mai rămâne marfă pentru el: ${pl.stops[0].o.name} face doar ~${pl.prod} t/lună și le duci deja pe toate.`) : null,
        e.noStock ? null : e.onRoad ? h('span', { class: 'pl-yes' }, `✅ E pe drum (+${e.gain} t/lună). Adaugă-l pe același tren: ${e.addCars ? `+${e.addCars} ${e.addCars === 1 ? 'vagon' : 'vagoane'}` : 'fără vagoane în plus'}, descărcare după cerere.`) : h('span', { class: 'pl-no' }, `🛑 E departe: e mai bine un tren nou (+${e.gain} t/lună).`)),
      e.noStock ? null : e.onRoad ? h('button', { class: 'opt go', onclick: () => c.set({ stops: e.stops, looked: false }, 5) }, '➕ Adaugă pe același tren')
        : h('button', { class: 'opt', onclick: () => c.newTrain(e.o) }, `🚂 Tren nou pentru ${e.o.name}`),
      h('button', { class: 'opt', onclick: () => c.env.show(e.o.x, e.o.y) }, '📍 Arată'))));
  }
  if (pl.stops.length > 2) out.push(h('button', { class: 'opt', onclick: () => c.set({ stops: pl.stops.slice(0, 2).map((x) => x.o), looked: false }, 5) }, '↩ Scoate orașele adăugate'));
  out.push(h('button', { class: 'opt go pl-next', onclick: () => c.go(6) }, 'Mai departe ➜ Rezumat'));
  return out;
}

/** Tonele descărcate la fiecare oprire (după cerere; ultima ia restul). */
export function drops(pl) {
  let left = pl.flow;
  return pl.stops.map((x, i) => { if (!i) return pl.flow; const t = i === pl.stops.length - 1 ? left : Math.min(left, x.want); left -= t; return t; });
}

/** Pasul 6: tot planul pe un ecran, apoi „Fă tot”. */
export function summaryStep(c) {
  const { p } = c, pl = c.plan(), car = CAR_TYPES[CAR_OF[p.g]], out = [], tons = drops(pl), poor = pl.cashLeft < 0 && !c.sandbox, bad = !pl.ok;
  const newSt = pl.stops.filter((x) => !x.st && x.spot), legsNew = pl.legs.filter((l) => !l.link);
  out.push(h('div', { class: 'pl-sec' }, h('b', null, '🏗️ Ce construiești'),
    legsNew.length ? line('🛤️', `Șină nouă: ${money(pl.build.track)}`) : line('✅', 'Șina există deja', 'ok'),
    newSt.length ? newSt.map((x) => line('🚉', `${['Haltă', 'Gară', 'Terminal'][x.size]} la ${x.o.name}: ${money(x.cost)}`)) : line('✅', 'Gările există deja', 'ok')));
  out.push(h('div', { class: 'pl-sec' }, h('b', null, '🚂 Ce tren cumperi'),
    line('🚂', `${pl.nd.trains > 1 ? pl.nd.trains + ' trenuri ' : ''}${pl.model.name} · ${pl.nd.carsPer} vagoane de ${car.name.toLowerCase()} ${car.icon}${pl.nd.trains > 1 ? ' fiecare' : ''}`), line(GOODS[p.g].icon, `Marfa: ${GOODS[p.g].name.toLowerCase()}`),
    line('💵', `Tren: ${money(pl.build.train)}`)));
  out.push(h('div', { class: 'pl-sec' }, h('b', null, '🗺️ Ruta'),
    ...pl.stops.map((x, i) => h('div', { class: 'srow' }, h('span', { class: 'num' }, String(i + 1)), h('div', { class: 'sinfo' }, h('b', null, nm(x.o)), h('small', null, i ? `descarcă ~${tons[i]} t${i < pl.stops.length - 1 ? ' (după cerere)' : ''}` : `încarcă ~${pl.flow} t pe lună`))))));
  out.push(h('div', { class: 'pl-sec tot' }, h('b', null, '💰 Banii'), line('🧾', `Cost total: ${money(pl.total)}`), line('👛', `Bani rămași: ${c.sandbox ? 'fără limită' : lei(pl.cashLeft)}`, poor ? 'bad' : ''),
    line('📈', `Profit estimat: ${money(pl.profit)} pe lună`)));
  if (bad) out.push(h('div', { class: 'note pl-warn' }, 'Planul nu e gata: lipsește un loc de gară sau nu se poate trage șina. Întoarce-te la traseu.'));
  if (c.p.result) {
    const r = c.p.result;
    out.push(h('div', { class: 'pl-res' + (r.ok ? ' ok' : ' bad') }, h('b', null, r.ok ? '🎉 Gata! Trenul pleacă.' : '⚠️ Ceva n-a mers:'),
      r.steps.map((q) => h('div', null, (q.ok ? '✅ ' : q.skipped ? '⏭️ ' : '❌ ') + q.text + (q.err ? ` — ${q.err}` : q.skipped ? ' (nefăcut)' : '')))));
    if (!r.ok) out.push(h('div', { class: 'note' }, 'Nu s-a schimbat nimic: banii și harta sunt ca înainte. Repară ce scrie mai sus și apasă din nou „Fă tot”.'));
  }
  const done = c.p.result && c.p.result.ok;
  out.push(done ? h('button', { class: 'opt go pl-next', onclick: () => c.finish() }, c.p.queue.length ? `➜ Următorul plan (${c.p.queue.length})` : '👍 Închide')
    : h('button', { class: 'opt go pl-next pl-stick', disabled: poor || bad || c.p.busy ? true : null, onclick: () => c.run() }, c.p.busy ? '⏳ Se aplică…' : poor ? '💸 Nu ai destui bani' : '✅ Fă tot', poor || c.p.busy ? null : h('small', null, money(pl.total))));
  if (c.p.queue.length && !done) out.push(h('div', { class: 'note' }, `📋 Mai ai ${c.p.queue.length} plan pus deoparte: vine după acesta.`));
  return out;
}
