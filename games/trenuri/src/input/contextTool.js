// Meniul de clic dreapta / apăsare lungă (7.6): ce găsim la placă și ce opțiuni oferim. Logică pură, fără DOM.
import { dockOf } from '../sim/ports.js';
import { depotSpot } from '../sim/depots.js';
import { parcelInfo, tileOwner } from '../sim/land.js';
import { INDUSTRIES } from '../sim/goods.js';

/** Ce e la placa t: { train, ship, depot, station, industry, city } (primul găsit în ordinea din unealta Info). `find` = căutători din interfață. */
export function resolveHit(s, t, find) {
  const hit = {};
  const tr = find.train ? find.train(t.fx, t.fz) : null;
  if (tr) { hit.train = tr; return hit; }
  const sh = s.ships && find.ship ? find.ship(s, t.fx, t.fz) : null;
  if (sh) { hit.ship = sh; return hit; }
  hit.depot = s.depots.find((d) => d.x === t.x && d.y === t.y) || null;
  hit.station = s.stations.find((q) => q.x === t.x && q.y === t.y) || null;
  if (hit.depot || hit.station) return hit;
  hit.industry = find.industry ? find.industry(s, t.x, t.y) || null : null;
  hit.city = hit.industry || !find.city ? null : find.city(s, t.x, t.y) || null;
  return hit;
}

const O = (id, icon, label, sub) => ({ id, icon, label, sub: sub || '' });

/** Opțiunile de pe teren liber (și lângă oraș/industrie, pe plăci neocupate). */
function landOptions(s, t, me) {
  const i = t.y * s.w + t.x, out = [];
  if (s.water[i]) return out;
  out.push(O('track', '🛤️', 'Șină de aici'), O('station', '🚉', 'Gară'), O('terminal', '🏛️', 'Terminal mare'));
  if (s.islands && dockOf(s, t.x, t.y) >= 0 && tileOwner(s, t.x, t.y) === me) out.push(O('port', '⚓', 'Port'));
  if (depotSpot(s, i)) out.push(O('depot', '🏭', 'Depou', 'capăt de linie'));
  out.push(O('level', '⛏️', 'Nivelare'));
  if (s.islands) { const p = parcelInfo(s, { id: me }, t.x >> 2, t.y >> 2); if (p.ok) out.push(O('land', '🏠', 'Cumpără teren')); }
  return out;
}

/** Lista de opțiuni { id, icon, label, sub } pentru ce e la placă. `me` = id-ul companiei jucătorului. Gol = nimic de oferit (apă). */
export function contextOptions(s, t, hit, me) {
  const out = [];
  if (hit.train) {
    const tr = hit.train, mine = tr.owner === me;
    out.push(O('infoTrain', 'ℹ️', 'Info'));
    if (mine) {
      out.push(O(tr.paused ? 'resume' : 'pause', tr.paused ? '▶' : '⏸', tr.paused ? 'Continuă' : 'Pauză'));
      if (tr.state !== 3 && !tr.tow) out.push(O('cars', '🚃', 'Vagoane'));
      if (!tr.dead && s.depots.some((d) => d.owner === me)) out.push(O('toDepot', '🏭', 'Depou', 'la reparat'));
      out.push({ ...O('sell', '💲', 'Vinde'), danger: true });
    }
    return out;
  }
  if (hit.ship) {
    out.push(O('infoShip', 'ℹ️', 'Info'));
    if (hit.ship.owner === me) out.push({ ...O('sellShip', '💲', 'Vinde'), danger: true });
    return out;
  }
  if (hit.depot) return [O('infoDepot', 'ℹ️', 'Info')];
  if (hit.station) {
    const st = hit.station, mine = st.owner === me;
    if (mine) out.push(O('trainFrom', '🚂', 'Tren de aici'));
    if (mine && st.port) out.push(O('shipFrom', '🚢', 'Vapor de aici'));
    if (mine) out.push(O('platform', '⬆️', 'Mărește'));
    out.push(O('infoStation', 'ℹ️', 'Info'));
    return out;
  }
  if (hit.industry || hit.city) {
    out.push(O(hit.industry ? 'infoIndustry' : 'infoCity', 'ℹ️', 'Info'));
    if (hit.city || INDUSTRIES[hit.industry.type].out >= 0) out.push(O('plan', '🧭', 'Planifică ruta'));
    if (!s.occ[t.y * s.w + t.x]) out.push(...landOptions(s, t, me));
    return out;
  }
  return landOptions(s, t, me);
}
