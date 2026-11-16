// Panoul depoului: coada, cele 2 linii de reparații, macaraua și jobul curent. Se reîmprospătează singur cât timp cardul e deschis.
import { h } from '../../../../shared/ui/dom.js';
import { DEPOT } from '../sim/consts.js';

const PHASE = { lift: '🏗️ Macaraua ridică locomotiva', repair: '🔧 Se repară', lower: '🏗️ Macaraua o coboară' };

export function openDepotPanel(card, s, dep) {
  const { open, row } = card;
  const draw = () => {
    const d = s.depots.find((q) => q.id === dep.id) || dep, crane = d.jobs.find((j) => j.phase !== 'repair');
    return open(h('h3', null, '🏭 ' + d.name),
      row('Linii de reparații', `${d.jobs.length} din ${d.repairTracks} ocupate`), row('Macara', crane ? PHASE[crane.phase].slice(3) : 'liberă'),
      h('div', null, h('b', null, 'În lucru')),
      d.jobs.length ? d.jobs.map((j) => h('div', { class: 'news' }, `Trenul ${j.trainId}: ${PHASE[j.phase]}`, h('div', { class: 'bar' }, h('i', { style: { width: Math.round((100 * j.t) / Math.max(1, j.d)) + '%' } })))) : h('div', { class: 'news' }, 'Nicio locomotivă la reparat.'),
      h('div', null, h('b', null, `La coadă (${d.queue.length})`)),
      d.queue.length ? d.queue.map((id, k) => h('div', { class: 'row' }, h('span', null, `${k + 1}. Trenul ${id}`), h('small', null, 'așteaptă un loc'))) : h('div', { class: 'news' }, 'Nimeni la coadă.'),
      h('div', { class: 'note' }, `Reparația durează după uzură (circa ${DEPOT.repairBase / 10}–${((DEPOT.repairBase + 70 * DEPOT.repairPer) / 10) | 0} zile). Trenul reparat își reia ruta singur.`));
  };
  let el = draw();
  const timer = setInterval(() => { if (!el.isConnected) { clearInterval(timer); return; } el = draw(); }, 600);
}
