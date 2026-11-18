// Comanda setRoute { trainId, route: [idGară], orders? }: schimbă ruta unui tren (și, opțional, ordinele pe gări).
// Validare: gări ale companiei, fără două gări identice una după alta, toate perechile vecine (și ultima → prima) legate cu șină.
// Trenul în mers termină drumul început; apoi merge mai departe din locul lui în rută, iar dacă gara spre care mergea
// nu e în ruta nouă, pornește spre prima gară din rută. Marfa din vagoane rămâne.
import { findRail } from './trains.js';
import { validOrders, cleanOrders } from './orders.js';
import { platsOf } from './laneGeo.js';

const fail = (err) => ({ ok: false, err });

export function setRoute(s, cmd, c) {
  const tr = s.trains.find((t) => t.id === cmd.trainId);
  if (!tr) return fail('inexistent');
  if (tr.owner !== c.id) return fail('proprietar');
  const route = cmd.route, n = Array.isArray(route) ? route.length : 0;
  if (n < 1 || n > 8 || route.some((id) => !s.stations.some((st) => st.id === id && st.owner === c.id))) return fail('gara');
  if (n > 1 && route.some((id, i) => id === route[(i + 1) % n])) return fail('drum');
  if (cmd.orders !== undefined && (!validOrders(cmd.orders) || (cmd.orders && cmd.orders.length !== n))) return fail('drum');
  const pos = (id) => platsOf(s, s.stations.find((st) => st.id === id)); // linii independente: oricare peron al gării
  if (n > 1) for (let i = 0; i < (n === 2 ? 1 : n); i++) if (!findRail(s, pos(route[i]), pos(route[(i + 1) % n]))) return fail('legatura');
  if (cmd.orders !== undefined) tr.orders = cleanOrders(cmd.orders);
  else if (tr.orders) { // ordinele rămân la gările lor; gările noi încep „Automat”
    const old = tr.route, prev = tr.orders;
    tr.orders = route.map((id) => { const k = old.indexOf(id); return k >= 0 && prev[k] ? prev[k] : { load: null, unload: null, drop: null }; });
  }
  tr.route = route.slice();
  const k = tr.route.indexOf(tr.to);
  tr.at = k >= 0 ? k : -1; // -1: gara de acum nu e în rută, iar următoarea plecare e spre prima din rută
  tr.lost = 0;
  return { ok: true, cost: 0 };
}
