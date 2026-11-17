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
  if (missing.length && !(o.made > 0 && t.out >= 0)) {
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
    const out = outAdvice(s, o);
    if (out.length) return { lines: out, goto: null, ok: false };
    if (missing.length) return { lines: [`A prelucrat tot ce a primit (${o.made} în total). Mai adu ${missing.map(low).join(' și ')} ca să lucreze mai departe.`], goto: null, ok: true };
  }
  lines.push(t.in.length ? 'Are tot ce-i trebuie: lucrează.' : 'Produce singură.');
  return { lines, goto: null, ok: true };
}

/** Marfa gata de dus a unei industrii (cu gară aproape): de ce nu ajunge la nimeni. [] dacă totul e în regulă. */
export function outAdvice(s, o) {
  const g = INDUSTRIES[o.type].out, lines = [], sts = s.stations.filter((st) => near(st, o));
  if (g < 0 || !sts.length) return lines;
  const stock = sts.reduce((n, st) => n + st.cargo[g], 0), takers = s.stations.filter((q) => !sts.includes(q) && accepts(s, q, g));
  if (!takers.length) {
    lines.push(`Nicio gară a ta nu e lângă cineva care cere ${low(g)} (oraș sau fabrică). Pune o gară la un oraș care o vrea.`);
    return lines;
  }
  const trs = s.trains.filter((q) => q.route.some((id) => sts.some((st) => st.id === id)) && q.route.some((id) => takers.some((st) => st.id === id)));
  if (!trs.length) lines.push(`${stock > 0 ? `${stock} t de ${low(g)} așteaptă în gară, dar ` : ''}niciun tren nu o duce la ${takers[0].name}. Fă o rută între cele două gări!`);
  else if (!trs.some((q) => q.kinds.includes(CAR_OF[g]))) lines.push(`Trenul ${trs[0].id} nu are vagoane de ${CAR_TYPES[CAR_OF[g]].name.toLowerCase()}, deci nu poate duce ${low(g)}. Schimbă-i vagoanele!`);
  else if (stock > 0 && trs.every((q) => q.orders && !q.orders.some((x) => x.load && x.load.includes(g)))) lines.push(`Trenul ${trs[0].id} e pe Manual și nu încarcă ${low(g)}. Pune-l pe Automat!`);
  return lines;
}

/** De ce un tren nu câștigă acum: [text] (gol dacă merge bine). */
export function trainAdvice(s, t) {
  const out = [];
  if (t.tow) return ['🚑 Remorcă: merge după un tren defect.'];
  if (t.state === 3) return [t.cpl ? '🚑 E remorcat spre depou.' : '🏭 E la depou: așteaptă la coadă sau se repară.'];
  if (t.dead) return [t.resc ? '🚨 E defect pe traseu. Remorca vine.' : '🚨 E defect pe traseu și blochează linia: trimite remorcă (🚑).'];
  if (t.toDepot) out.push('🏭 Merge la depou, la reparat.');
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
