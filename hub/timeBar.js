// Bara „timp rămas azi” din hub (modul NAS).
import { h as el } from '../shared/ui/dom.js';
import { fmtMinutes } from '../shared/net/util.js';

const WHY = { limit: 'Gata timpul de joc pe azi 🌙', hours: 'Acum nu e ora de joc ⏰', disabled: 'Contul e oprit 🔒' };

export function createTimeBar(time) {
  if (!time || time.minutesPerDay == null) return el('div', { class: 'timebar' }, el('div', { class: 'tt' }, el('span', null, '⏱ Timp de joc'), el('span', null, 'fără limită')));
  const total = (time.minutesPerDay + (time.bonusToday || 0)) * 60;
  const left = Math.max(0, time.remainingSec || 0);
  const pct = total > 0 ? Math.min(100, Math.round((left / total) * 100)) : 0;
  const stop = time.allowedNow === false;
  const cls = 'timebar' + (stop ? ' stop' : '') + (pct < 20 ? ' low' : '');
  return el('div', { class: cls },
    el('div', { class: 'tt' }, el('span', null, stop ? (WHY[time.reason] || WHY.limit) : '⏱ Timp rămas azi'), el('span', null, fmtMinutes(left))),
    el('div', { class: 'track' }, el('div', { class: 'fill', style: { width: pct + '%' } })));
}
