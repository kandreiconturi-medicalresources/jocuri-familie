// Sfaturi pure (fără DOM): de ce nu produce o industrie, de ce stă un tren, ce vagoane se potrivesc rutei.
import { INDUSTRIES, GOODS, CAR_TYPES, CAR_OF, NG } from './goods.js';
import { near } from './industry.js';
import { accepts, stockOf, tileDist } from './cargo.js';
import { MAX_CARS } from './consts.js';
import { relOf } from './wear.js';

const stOf = (s, id) => s.stations.find((q) => q.id === id);
const low = (g) => GOODS[g].name.toLowerCase();

/** Cea mai apropiată industrie care produce marfa g. */
export function nearestSource(s, from, g) {
  let best = null, bd = 1e9;
  for (const q of s.industries) if (INDUSTRIES[q.type].out === g) { const d = tileDist(from, q); if (d < bd) { bd = d; best = q; } }
  return best ? { o: best, d: bd } : null;
}

/** Mărfurile (fără pasageri/poștă) de dus pe o rută: ce se adună sau se produce lângă o gară și e cerut de alta. */
export function routeGoods(s, route) {
  const sts = route.map((id) => stOf(s, id)).filter(Boolean), out = [];
  for (let g = 2; g < NG; g++) {
    const made = (st) => stockOf(st, g) > 0 || s.industries.some((o) => INDUSTRIES[o.type].out === g && near(st, o));
    if (sts.some((a) => made(a) && sts.some((q) => q !== a && accepts(s, q, g)))) out.push(g);
  }
  return out;
}

/** Vagoane potrivite rutei: tipurile care duc marfa din gări (maxim 3 tipuri), altfel pasageri + poștă. */
export function suggestKinds(s, route, power = 4) {
  const freight = [];
  for (const g of routeGoods(s, route)) if (!freight.includes(CAR_OF[g])) freight.push(CAR_OF[g]);
  if (!freight.length) return [0, 0, 1];
  const n = Math.max(2, Math.min(MAX_CARS, power)), kinds = freight.slice(0, 3), out = [];
  for (let i = 0; i < n; i++) out.push(kinds[i % kinds.length]);
  return out.sort((a, b) => a - b);
}

/** Ce lipsește unei industrii: { lines: [text], goto: {x,y,name}|null, ok }. */
export function industryAdvice(s, o) {
  const t = INDUSTRIES[o.type], lines = [];
  let goto = null;
  const hasSt = s.stations.some((st) => near(st, o));
  const missing = t.in.filter((g) => o.in[g] <= 0);
  if (missing.length) {
    const g = missing[0], src = nearestSource(s, o, g);
    lines.push(`${o.name} are nevoie de ${missing.map(low).join(' și ')}.`);
    if (src) {
      lines.push(`Cea mai apropiată sursă de ${low(g)}: ${src.o.name}, la ${src.d} plăci. Leag-o cu șina!`);
      goto = { x: src.o.x, y: src.o.y, name: src.o.name };
      if (!hasSt) lines.push('Pune o gară lângă ' + o.name + '.');
      else if (!s.stations.some((st) => near(st, src.o))) lines.push('Pune o gară și lângă ' + src.o.name + '.');
      else {
        const car = CAR_TYPES[CAR_OF[g]];
        const tr = s.trains.find((q) => q.route.some((id) => { const st = stOf(s, id); return st && near(st, src.o); }) && q.route.some((id) => { const st = stOf(s, id); return st && near(st, o); }));
        if (!tr) lines.push(`Cumpără un tren cu vagoane de ${car.name.toLowerCase()} între cele două gări.`);
        else if (!tr.kinds.includes(CAR_OF[g])) lines.push(`Trenul ${tr.id} nu are vagoane de ${car.name.toLowerCase()}. Schimbă-le!`);
      }
    } else lines.push(`Pe hartă nu e nicio sursă de ${low(g)}.`);
    return { lines, goto, ok: false };
  }
  if (t.out >= 0) {
    if (!hasSt) { lines.push('Produce, dar nicio gară nu e aproape: marfa nu pleacă. Pune o gară lângă ea.'); return { lines, goto: { x: o.x, y: o.y, name: o.name }, ok: false }; }
    const want = s.industries.find((q) => INDUSTRIES[q.type].in.includes(t.out)), cityWants = s.cities.some((c) => c.level >= 0 && (t.out === 3 || t.out === 5 || t.out === 9 || t.out === 11 || t.out === 13));
    if (!want && !cityWants) lines.push(`Nimeni nu cere ${low(t.out)} pe hartă.`);
  }
  lines.push(t.in.length ? 'Are tot ce-i trebuie: lucrează.' : 'Produce singură.');
  return { lines, goto: null, ok: true };
}

/** De ce un tren nu câștigă acum: [text] (gol dacă merge bine). */
export function trainAdvice(s, t) {
  const out = [];
  if (t.paused) out.push(t.state === 2 ? '⏸ E în pauză, stă în gară.' : '⏸ Pauză: se oprește la gara următoare.');
  if (t.route.length < 2) out.push('Nu are rută: alege două gări.');
  else if (t.lost) out.push('Nu găsește drum: leagă gările cu șină.');
  if (t.broken > 0) out.push('🔧 E stricat, se repară.');
  else if (t.state === 1 && t.speed === 0 && t.hold > 0) out.push('Așteaptă linia liberă.');
  if (relOf(t) < 60) out.push(`Fiabilitate mică (${relOf(t)}%): du-l la un atelier.`);
  if (t.route.length >= 2 && !t.lost) {
    const sts = t.route.map((id) => stOf(s, id)).filter(Boolean);
    const have = [], noCar = [];
    for (const st of sts) for (let g = 0; g < NG; g++) {
      if (stockOf(st, g) <= 0 || !sts.some((q) => q !== st && accepts(s, q, g))) continue;
      if (t.kinds.includes(CAR_OF[g])) have.push(g); else if (!noCar.includes(g)) noCar.push(g);
    }
    if (noCar.length) out.push(`Nu are vagoane de ${noCar.map((g) => CAR_TYPES[CAR_OF[g]].name.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(' și ')}.`);
    else if (!have.length && !t.load.length && !sts.some((st) => st.waiting.pass + st.waiting.mail > 0)) out.push('Gara nu are marfă de dus încă.');
  }
  return out;
}
