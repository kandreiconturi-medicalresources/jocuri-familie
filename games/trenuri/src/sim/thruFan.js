// Intrările gării mari de trecere: la fiecare capăt, din linia principală se desfac în evantai mai multe linii scurte
// (prin macaze pe diagonală), fiecare cu un capăt liber de care legi șina venită din altă parte. Așa intră în aceeași gară
// trenuri de pe 5, 6 sau mai multe linii diferite. Totul e șină obișnuită (rutele și semnalele merg ca peste tot).
// Casele din cale se mută (cu despăgubire), iar pe deal intrările urcă/coboară treptat (cel mult o treaptă pe placă), cu nivelare.
import { WATER_H, T_PRESENT, T_OWNER_SHIFT } from './consts.js';
import { frameOf } from './terminal.js';

const STUB = 2; // plăci drepte la capătul fiecărei intrări
const FAN_AT = 5; // evantaiul începe la 5 plăci de gară: gara (max ±4) poate crește fără să-l atingă

/** { paths: [[ [x,y], ... ]], levels: [[i, h]] } — căile pornesc din capătul liniei principale; ramurile blocate (apă, industrie, șina altuia) se sar. */
export function fanPaths(s, x, y, dir, A, rows, by, h0, opt = {}) {
  const house = opt.house || (() => false), center = opt.center || new Set(), lmax = opt.levelMax || 1;
  const f = frameOf(dir), w = s.w, R = Math.min(3, rows), paths = [], lv = new Map();
  const at = (a, c) => [x + f.ax * a + f.cx * c, y + f.ay * a + f.cy * c];
  /** Înălțimea la care pui placa după cea de înălțime `prev`, sau -1 dacă nu se poate. */
  const fit = ([tx, ty], prev) => {
    if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) return -1;
    const i = ty * w + tx, t = s.track[i], hh = s.height[i];
    if (s.water[i] || hh <= WATER_H || s.stm[i] || center.has(i)) return -1;
    if (s.occ[i] && !house(i)) return -1; // casele se mută; industriile și alte gări nu
    if (t & T_PRESENT) return ((t >> T_OWNER_SHIFT) & 7) === by && Math.abs(hh - prev) <= 1 ? hh : -1; // sub șină nu se nivelează
    const to = Math.max(prev - 1, Math.min(prev + 1, hh));
    return Math.abs(hh - to) <= lmax && to > WATER_H ? to : -1;
  };
  const walk = (p) => { // înălțimile de-a lungul căii; null dacă undeva nu merge
    const hs = [h0];
    for (let k = 1; k < p.length; k++) { const to = fit(p[k], hs[k - 1]); if (to < 0) return null; hs.push(to); }
    return hs;
  };
  for (const e of [-1, 1]) {
    const a0 = e * FAN_AT, lead = [];
    for (let a = A; a <= FAN_AT; a++) lead.push(at(e * a, 0)); // linia principală merge drept până la evantai (dincolo de cea mai lungă gară)
    if (!walk(lead)) continue;
    for (let r = 0; r <= R; r++) {
      const p = lead.slice();
      for (let i = 1; i <= r; i++) p.push(at(a0 + e * i, i)); // diagonala macazelor
      for (let k = 1; k <= STUB; k++) p.push(at(a0 + e * (r + k), r)); // capătul drept, de legat
      const hs = walk(p);
      if (!hs) continue;
      paths.push(p);
      p.forEach(([tx, ty], k) => { const i = ty * w + tx; if (k && hs[k] !== s.height[i] && !lv.has(i)) lv.set(i, hs[k]); });
    }
  }
  return { paths, levels: [...lv.entries()].sort((a, b) => a[0] - b[0]) };
}

/** Capetele libere ale intrărilor (unde legi șina), pentru indicii pe hartă. */
export const fanEnds = (paths) => paths.map((p) => p[p.length - 1]);
