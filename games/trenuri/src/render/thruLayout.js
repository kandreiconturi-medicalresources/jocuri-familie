// Geometria gării mari de trecere (coordonate locale: v = peste linii, spre clădire; u = de-a lungul liniei; 0 = centrul plăcii gării).
// Folosită de desen (thru.js, thruHall.js), de trenuri (bays.js) și de oameni (stationLayout.js).
import { lane10, halfLen, rowsOf, THRU_MAX } from '../sim/thru.js';
import { frameOf } from '../sim/terminal.js';

export const SLOPE = 1.5, PHW = 0.17, TOP = 0.1, DECK = 0.74, UNDER = -0.32;
export const nOf = (st) => Math.max(2, Math.min(THRU_MAX, st.platforms | 0));
export const laneV = (k) => lane10(k) / 10;
/** Capătul gării de-a lungul liniei și începutul porțiunii drepte a liniei k (după scara de macaze). */
export const edgeOf = (n) => halfLen(n) + 0.5;
export const straightU = (n, k) => edgeOf(n) - 0.1 - laneV(k) / SLOPE;

const cache = new Map();
/** { n, E, lanes: [v], plats: [{ v, hw, u0, u1, lanes }], vB0, vB1, uB (pasarela), uU (pasajul), rows } */
export function thruGeo(n) {
  let G = cache.get(n);
  if (G) return G;
  const E = edgeOf(n), lanes = [], plats = [];
  for (let k = 0; k < n; k++) lanes.push(laneV(k));
  const span = (ks) => { const m = Math.min(...ks.map((k) => straightU(n, k))) - 0.12; return [-m, m]; };
  for (let j = 0; 2 * j + 1 < n; j++) { const [u0, u1] = span([2 * j, 2 * j + 1]); plats.push({ v: (lanes[2 * j] + lanes[2 * j + 1]) / 2, hw: PHW, u0, u1, lanes: [2 * j, 2 * j + 1] }); }
  const last = lanes[n - 1], [s0, s1] = span([n - 1]);
  plats.push({ v: last + 0.3, hw: PHW, u0: s0, u1: s1, lanes: [n - 1], side: true }); // peronul clădirii
  const rows = rowsOf(n), vB0 = last + 0.5, vB1 = rows + 0.45;
  G = { n, E, lanes, plats, vB0, vB1, rows, uB: 0.85, uU: -0.85 };
  cache.set(n, G);
  return G;
}

/** Cadrul în lume: W(v, u) → [x, z]; yaw pentru rădăcina rotită (x local = v, z local = u). */
export function thruFrame(st) {
  const f = frameOf(st.dir), ox = st.x + 0.5, oz = st.y + 0.5;
  return { f, ox, oz, W: (v, u) => [ox + f.cx * v + f.ax * u, oz + f.cy * v + f.ay * u], yaw: Math.atan2(-f.cy, f.cx) };
}

/** Drumul unui om de pe peronul pl spre peronul q (sau spre clădire dacă q = null), pe pasarelă sau prin pasaj: [[u, v, z], ...]. */
export function walkPath(G, pl, q, under) {
  const vT = q ? q.v : G.vB0 + 0.22, uX = under ? G.uU : G.uB, z = under ? UNDER : DECK, d = under ? 0.28 : -0.3; // scările coboară spre mijlocul peronului
  const out = [[uX + d, pl.v, 0], [uX, pl.v, z], [uX, vT, z]];
  if (q) out.push([uX + d, vT, 0]);
  return out;
}
