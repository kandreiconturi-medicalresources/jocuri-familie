// Ecranul blând de faliment: fără vină, cu opțiunea de a continua în modul simplu.
import { h } from '../../../../shared/ui/dom.js';

/** act = { simple(), menu() }. Întoarce { close }. */
export function showOver(root, co, act) {
  const close = () => el.remove();
  const go = (fn) => () => { close(); fn(); };
  const el = h('div', { class: 'menu end' }, h('div', { class: 'mp' },
    h('div', { class: 'medal' }, '🌧️'),
    h('h2', null, 'Casa de bani e goală'),
    h('p', null, `${co.name} are banii pe minus de 6 luni. Se întâmplă! Orașele te așteaptă, iar trenurile nu au plecat nicăieri.`),
    h('p', null, 'Poți continua în modul simplu: fără împrumuturi și dobânzi, cu niște bani de reînceput.'),
    h('div', { class: 'rowb' },
      h('button', { class: 'opt go', onclick: go(act.simple) }, '🎈 Continuă în modul simplu'),
      h('button', { class: 'opt', onclick: go(act.menu) }, '🏠 Meniul jocului'))));
  root.append(el);
  return { close };
}
