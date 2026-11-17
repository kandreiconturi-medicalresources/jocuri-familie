// Butonul „🧰 Mai multe” din bara de jos: deschide uneltele 6.6 (semnal, nivelare, tunel, peroane) ca opțiuni sub bară.
import { h } from '../../../../shared/ui/dom.js';
import { EXTRA_TOOLS } from '../input/extraTools.js';

/** hud: obiectul din createHud (hud.el[3] = bara de unelte); tools: createTools(...). */
export function mountExtraTools(hud, tools) {
  const isl = () => !!(tools.world && tools.world() && tools.world().islands);
  const open = () => hud.setSub(EXTRA_TOOLS.filter((q) => !q.island || isl()).map((q) => ({ label: q.e + ' ' + q.t, on: tools.state.tool === q.id, fn: () => tools.setTool(q.id) })));
  const btn = h('button', { class: 'tool', 'aria-label': 'Mai multe unelte', onclick: open }, h('span', { class: 'e' }, '🧰'), 'Mai mult');
  hud.el[3].append(btn);
  return btn;
}
