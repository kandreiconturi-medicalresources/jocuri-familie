// Editorul de rută al unui tren existent: stare pură (refolosește selecția din assistState.js) și comanda setRoute.
import { dropOf } from './assistState.js';

export const hasFreight = (t) => t.kinds.some((k) => k >= 2);

/** Starea asistentului, precompletată din ruta curentă (și din descărcările alese, dacă trenul are ordine). */
export function editState(t, model) {
  return {
    step: 5, type: hasFreight(t) ? 'freight' : 'pass', good: -1, model, cars: -1, n: 3, full: false, pick: true, edit: t.id,
    stops: t.route.map((id, i) => ({ id, drop: (t.orders && t.orders[i] && t.orders[i].drop) || null })),
  };
}

/** setRoute pentru starea curentă (null dacă ruta nu e bună). Ordine trimitem doar dacă trenul le avea sau s-a ales o descărcare. */
export function routeCommand(a, t) {
  const n = a.stops.length;
  if (n < 2 || a.stops.some((x, i) => x.id === a.stops[(i + 1) % n].id)) return null;
  const cmd = { type: 'setRoute', trainId: t.id, route: a.stops.map((x) => x.id) };
  if (t.orders || a.stops.some((x) => x.drop)) {
    const old = (id) => { const k = t.route.indexOf(id); return (t.orders && t.orders[k]) || null; };
    cmd.orders = a.stops.map((x, i) => { const o = old(x.id); return { load: o ? o.load : null, unload: o ? o.unload : null, drop: hasFreight(t) ? dropOf(a, i) : (o ? o.drop : null) }; });
  }
  return cmd;
}
