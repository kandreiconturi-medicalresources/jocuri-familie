// Sfaturile Ajutorului: reguli pure pe starea jocului (fără DOM). `findTip(s, shown)` întoarce { key, text } sau null.
import { MODELS, availableModels } from '../sim/consts.js';
import { INDUSTRIES, GOODS, wantOf } from '../sim/goods.js';
import { cityNear } from './nearby.js';
import { viewer } from '../sim/viewer.js';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const low = (t) => t.toLowerCase();

/** Un oraș care nu primește o marfă pe care o cere, deși o industrie care o face e aproape. */
function hungryCity(s, shown) {
  let best = null;
  for (const c of s.cities) for (const o of s.industries) {
    const g = INDUSTRIES[o.type].out;
    if (g < 2 || wantOf(c, g) <= 0 || c.got[g] > 0 || c.prev[g] > 0) continue;
    const d = cheb(c, o), key = `want:${c.id}:${o.id}`;
    if (d > 22 || shown.has(key) || !cityNear(s, c)) continue;
    if (!best || d < best.d) best = { d, key, c, o, g };
  }
  if (!best) return null;
  return { key: best.key, text: `Orașul ${best.c.name} vrea ${low(GOODS[best.g].name)}, iar ${INDUSTRIES[best.o.type].icon} ${best.o.name} e aproape!` };
}

export function findTip(s, shown, clock = 0) {
  const co = s.companies[viewer.co] || s.companies[0];
  if (!s.stations.length && clock > 40 && !shown.has('nostation')) return { key: 'nostation', text: 'Pune o gară 🚉 lângă un oraș, ca să poată urca oamenii!' };
  const idle = s.trains.find((t) => t.route.length < 2 && !shown.has('idle:' + t.id));
  if (idle) return { key: 'idle:' + idle.id, text: `Trenul ${idle.id} stă degeaba, dă-i o rută! Alege 🚂 și atinge două gări.` };
  const lost = s.trains.find((t) => t.lost && !shown.has('lost:' + t.id));
  if (lost) return { key: 'lost:' + lost.id, text: `Trenul ${lost.id} nu găsește drumul. Leagă gările cu șină!` };
  if (!s.sandbox) {
    const best = availableModels(s.date.y).slice(-1)[0], owned = s.trains.reduce((m, t) => Math.max(m, t.model), -1);
    if (s.trains.length && best.id > owned && co.cash >= best.price + 3000 && !shown.has('loco:' + best.id)) return { key: 'loco:' + best.id, text: `Ai bani pentru o locomotivă nouă: ${MODELS[best.id].name}! 🚂` };
    if (co.cash < 0 && !shown.has('debt')) return { key: 'debt', text: 'Banii s-au terminat. Lasă trenurile să lucreze sau vinde unul vechi.' };
  }
  const city = hungryCity(s, shown);
  if (city) return city;
  if (s.trains.length === 1 && s.stations.length >= 2 && !shown.has('second') && clock > 120) return { key: 'second', text: 'Merge bine! Un al doilea tren aduce și mai mulți bani.' };
  return null;
}
