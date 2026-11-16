// Ce fel de tren e: „🚂 Tren de marfă · ⛽ Combustibil”, „🚃 Tren de pasageri”, „✉️ Tren de poștă”. Folosit în panou, listă și etichete.
import { GOODS, CAR_TYPES, CAR_OF, NG } from '../sim/goods.js';
import { routeGoods } from '../sim/advice.js';
import { carried } from '../sim/cargo.js';

/** Marfa principală: cea mai multă încărcată, altfel cea de pe rută potrivită vagoanelor, altfel numele primului vagon de marfă. */
export function mainGood(s, t) {
  let best = -1, bn = 0;
  for (let g = 2; g < NG; g++) { const n = carried(t, g); if (n > bn) { bn = n; best = g; } }
  if (best >= 0) return best;
  if (t.route.length > 1) { const rg = routeGoods(s, t.route).filter((g) => t.kinds.includes(CAR_OF[g])); if (rg.length) return rg[0]; }
  const k = t.kinds.find((q) => q >= 2);
  return k === undefined ? -1 : CAR_TYPES[k].goods[0];
}

/** { icon, text, full }: full = textul întreg de afișat. */
export function trainKind(s, t) {
  const freight = t.kinds.some((k) => k >= 2);
  if (!freight) {
    const pass = t.kinds.includes(0), mail = t.kinds.includes(1);
    const r = pass && mail ? ['🚃', 'Tren de pasageri și poștă'] : mail ? ['✉️', 'Tren de poștă'] : ['🚃', 'Tren de pasageri'];
    return { icon: r[0], text: r[1], full: `${r[0]} ${r[1]}` };
  }
  const g = mainGood(s, t), more = new Set(t.kinds.filter((k) => k >= 2)).size > 1;
  const tail = g >= 0 ? ` · ${GOODS[g].icon} ${GOODS[g].name}${more ? ' și altele' : ''}` : '';
  return { icon: '🚂', text: 'Tren de marfă' + tail, full: '🚂 Tren de marfă' + tail };
}
