// Pe ce linie stă fiecare tren oprit într-un terminal mare sau într-o gară de trecere (doar vizual).
// Liniile se țin minte: un tren care sosește ia cea mai mică linie liberă, iar trenurile care rămân nu sar pe altă linie.
// Linia 0 e linia principală (trenul rămâne pe traseul lui); celelalte sunt liniile curții / ale gării.
// Gările cu linii independente (`st.ln`): trenul stă chiar pe peronul liniei lui (capătul drumului), deci linia se citește din placă.
import { laneOfTile } from '../sim/laneGeo.js';

const memo = new Map(); // id gară → Map(id tren → { lane, sg })

/** Map(id tren → { st, lane, sg }) pentru trenurile oprite (state 2) în gări cu mai multe linii; sg = sensul (±1) față de axa gării. */
export function bayMap(s, headingOf = null) {
  const out = new Map();
  for (const st of s.stations) {
    if (!st.big && !st.thru) continue;
    const n = Math.max(1, st.platforms | 0), prev = memo.get(st.id) || new Map(), next = new Map(), used = new Set();
    const here = s.trains.filter((t) => t.state === 2 && t.to === st.id);
    if (st.ln) { // linia reală: placa pe care stă trenul
      for (const t of here) { const i = t.org ? t.org - 1 : t.path.length ? t.path[t.path.length - 1] : -1, k = i >= 0 ? laneOfTile(s, st, i) : -1; next.set(t.id, { lane: Math.max(0, k), sg: headingOf ? headingOf(t, st) : 1, real: true }); }
      memo.set(st.id, next);
      for (const [id, b] of next) out.set(id, { st, lane: b.lane, sg: b.sg, real: true });
      continue;
    }
    for (const t of here) { const p = prev.get(t.id); if (p && p.lane < n && !used.has(p.lane)) { next.set(t.id, p); used.add(p.lane); } }
    for (const t of here) {
      if (next.has(t.id)) continue;
      let k = 0; while (used.has(k) && k < n - 1) k++;
      if (used.has(k)) continue; // mai multe trenuri decât linii (n-ar trebui): rămâne pe traseu
      used.add(k);
      next.set(t.id, { lane: k, sg: headingOf ? headingOf(t, st) : 1 });
    }
    memo.set(st.id, next);
    for (const [id, b] of next) out.set(id, { st, lane: b.lane, sg: b.sg });
  }
  return out;
}
/** Linia trenului t în gara st (0 dacă nu e știută încă). */
export function laneOf(st, t) {
  const m = memo.get(st.id), b = m && m.get(t.id);
  return b ? b.lane : 0;
}
export function sgOf(st, t) {
  const m = memo.get(st.id), b = m && m.get(t.id);
  return b ? b.sg : 1;
}
