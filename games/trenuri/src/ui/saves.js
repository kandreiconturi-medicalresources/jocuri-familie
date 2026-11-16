// Meniul „Salvează / Încarcă”: 3 sloturi (pe NAS când serverul e disponibil, altfel local). În rețea doar gazda poate salva sau încărca.
import { h } from '../../../../shared/ui/dom.js';
import { saveName } from '../net/saves.js';

const kb = (n) => Math.max(1, Math.round(n / 1024)) + ' KB';
const when = (t) => { if (!t) return ''; const d = new Date(t < 1e12 ? t * 1000 : t); return `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ERR = { mare: 'Salvarea e prea mare.', plin: 'Nu mai e loc pe dispozitiv.', gol: 'Slotul e gol.', veche: 'Salvarea asta e din altă versiune.' };

/** o = { saves, where: 'NAS'|'local', canUse: bool, why?: text, state: () => s, speed: () => n, onLoad: ({state, speed}) => void } */
export function openSaves(card, o) {
  let msg = '', busy = false, rows = null;
  const say = (t) => { msg = t; draw(); };
  const run = async (fn, ok) => {
    if (busy) return;
    busy = true; say('Un moment…');
    try { await fn(); if (ok === null) { busy = false; return; } msg = ok; } catch (e) { msg = ERR[e && e.message] || 'N-a mers. Încearcă iar.'; }
    busy = false; await refresh();
  };
  async function refresh() { try { rows = await o.saves.list(); } catch (e) { rows = [null, null, null]; msg = msg || 'Nu pot citi salvările.'; } draw(); }

  function slot(i) {
    const r = rows && rows[i], slotNo = i + 1, can = o.canUse && !busy;
    const btn = (label, fn, off) => h('button', { class: 'opt', disabled: off || !can, onclick: fn }, label);
    return h('div', { class: 'svrow' },
      h('div', { class: 'sl-info' }, h('b', null, `Slot ${slotNo}`), h('small', null, r ? `${r.name} · ${kb(r.size)} · ${when(r.updatedAt)}` : rows ? 'gol' : '…')),
      h('div', { class: 'sl-btns' },
        btn('💾', () => run(() => o.saves.save(slotNo, saveName(o.state()), o.state(), o.speed()), 'Salvat!')),
        btn('📂', () => run(async () => { o.onLoad(await o.saves.load(slotNo)); card.close(); }, null), !r),
        btn('🗑️', () => run(() => o.saves.remove(slotNo), 'Șters.'), !r)));
  }
  function draw() {
    card.open(h('h3', null, '💾 Salvează / Încarcă'), h('small', null, o.where === 'NAS' ? 'Salvările stau pe serverul de acasă.' : 'Salvările stau pe acest dispozitiv.'),
      o.canUse ? null : h('div', { class: 'warnrow' }, o.why || 'Nu merge acum.'),
      [0, 1, 2].map(slot), msg ? h('div', { class: 'news' }, msg) : null);
  }
  draw();
  refresh();
}
