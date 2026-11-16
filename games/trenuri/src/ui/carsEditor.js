// Editorul de vagoane din panoul trenului: scoți (atingi vagonul), adaugi din paletă, „potrivite pentru rută”, apoi Aplică.
import { h } from '../../../../shared/ui/dom.js';
import { MODELS, MAX_CARS } from '../sim/consts.js';
import { CAR_TYPES, GOODS } from '../sim/goods.js';
import { suggestKinds } from '../sim/advice.js';
import { carsCost, canSwapNow } from '../sim/consist.js';
import { lei } from './hud.js';

const bg = (k) => ({ background: GOODS[CAR_TYPES[k].goods[0]].color });

/** Întoarce un bloc DOM: butonul „🚃 Schimbă vagoanele” care se desface în editor. */
export function carsEditor(s, t, apply) {
  const box = h('div', { class: 'cars-ed' });
  let draft = null;
  const m = MODELS[t.model], base = () => t.nk || t.kinds;

  function draw() {
    box.textContent = '';
    if (!draft) {
      box.append(h('button', { class: 'opt', onclick: () => { draft = base().slice(); draw(); } }, '🚃 Schimbă vagoanele',
        h('small', null, t.nk ? '⏳ Se schimbă la următoarea gară' : 'Adaugi sau scoți vagoane')));
      return;
    }
    const cost = carsCost(base(), draft), now = canSwapNow(t);
    box.append(
      h('div', null, h('b', null, 'Vagoanele trenului'), ` (${draft.length}/${MAX_CARS}) — atinge un vagon ca să-l scoți`),
      h('div', { class: 'chips' }, draft.map((k, i) => h('button', { class: 'gchip btn on', style: bg(k), title: 'Scoate ' + CAR_TYPES[k].name, disabled: draft.length <= 1, onclick: () => { draft.splice(i, 1); draw(); } }, CAR_TYPES[k].icon + '➖'))),
      h('div', null, 'Adaugă:'),
      h('div', { class: 'chips' }, CAR_TYPES.map((c, k) => h('button', { class: 'gchip btn on', style: bg(k), title: `${c.name} (${c.cap} locuri)`, disabled: draft.length >= MAX_CARS, onclick: () => { draft.push(k); draw(); } }, c.icon + '➕'))),
      h('button', { class: 'opt', onclick: () => { draft = suggestKinds(s, t.route, m.power); draw(); } }, '🤖 Potrivite pentru rută', h('small', null, 'Vagoanele pentru marfa din gările rutei')),
      h('div', { class: 'why', style: { display: draft.length > m.power ? '' : 'none' } }, `⚠️ Locomotiva trage bine doar ${m.power} vagoane: cu mai multe merge mai încet.`),
      h('div', null, cost > 0 ? `Costă ${lei(cost)}` : cost < 0 ? `Primești înapoi ${lei(-cost)}` : 'Fără cost'),
      h('div', { class: 'btns' },
        h('button', { class: 'opt go', onclick: () => { apply(draft.slice()); draft = null; draw(); } }, '✅ Aplică', h('small', null, now ? 'Acum, în gară' : 'La următoarea gară')),
        h('button', { class: 'opt', onclick: () => { draft = null; draw(); } }, 'Anulează')));
  }
  draw();
  return box;
}
