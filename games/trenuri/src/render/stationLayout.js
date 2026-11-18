// Geometria peroanelor unei gări, în coordonate (u = de-a lungul liniei, v = spre clădire/curte): un singur loc pentru desenare și pentru oameni.
import { frameOf } from '../sim/terminal.js';
import { LANE, END, laneC, laneStart } from './terminalLayout.js';
import { planOf, platformsOf, STEP } from './stationPlan.js';
import { thruGeo, nOf, TOP, walkPath } from './thruLayout.js';

export { platformsOf, STEP };
export const HW = 0.075; // semi-lățimea zonei pe care umblă oamenii pe un peron
export const topOf = (st) => 0.08 * (1 + 0.12 * (platformsOf(st) - 1));

/** Direcția axei gării și partea clădirii (vector unitar în plan) + unghiul clădirii. */
export function stationFrame(s, st) {
  const P = planOf(s, st);
  return { yaw: P.yaw, ax: P.ax, az: P.az, bx: P.bx, bz: P.bz };
}

/** { big, ox, oz, ax, az, bx, bz, lanes: [v,...], plats: [{ v, hw, u0, u1, top, lanes: [j], exit: [u,v] }], y } (memorat pe poziție/mărime/peroane). */
export function layoutOf(s, st) {
  if (st.big) return bigLayout(s, st);
  if (st.thru) return thruLayout(st);
  const P = planOf(s, st);
  if (P.layout) return P.layout;
  const top = topOf(st), plats = [], lanes = [];
  for (let k = 0; k < P.lanes; k++) lanes.push(-k * STEP);
  plats.push({ v: 0.255, hw: HW, u0: P.uN + 0.06, u1: P.uP - 0.06, top, lanes: [0], exit: [0, 0.4] });
  for (let k = 1; k < P.lanes; k++) {
    const eu = P.bridge !== null ? P.bridge : P.eP - 0.12;
    plats.push({ v: -(k - 0.5) * STEP, hw: HW, u0: P.eN + 0.1, u1: P.eP - 0.1, top, lanes: k === 1 ? [0] : [], exit: [eu, -(k - 0.5) * STEP] });
  }
  P.layout = { big: false, ox: P.ox, oz: P.oz, ax: P.ax, az: P.az, bx: P.bx, bz: P.bz, lanes, plats, pieces: P.pieces, l: P.l };
  return P.layout;
}

/** Gara de trecere: peroanele din thruLayout.js; ieșirea e pe pasarelă spre clădire (out = [[u, v, z]]). */
function thruLayout(st) {
  const key = 't' + st.id + ':' + st.x + ',' + st.y + ',' + st.dir + ',' + nOf(st) + (st.ln ? 'w' : '');
  let L = bigCache.get(key);
  if (L) return L;
  const G = thruGeo(nOf(st), !!st.ln), f = frameOf(st.dir);
  const plats = G.plats.map((pl) => ({ v: pl.v, hw: HW, u0: pl.u0, u1: pl.u1, top: TOP, lanes: pl.lanes, exit: [G.uB, G.vB0 + 0.22] }));
  for (const pl of plats) pl.out = (under) => walkPath(G, pl, null, under);
  L = { big: false, thru: true, multi: true, G, ox: st.x + 0.5, oz: st.y + 0.5, ax: f.ax, az: f.ay, bx: f.cx, bz: f.cy, lanes: G.lanes.slice(), plats };
  bigCache.set(key, L);
  return L;
}

const bigCache = new Map();
function bigLayout(s, st) {
  const key = st.id + ':' + st.x + ',' + st.y + ',' + st.dir + ',' + (st.platforms | 0);
  let L = bigCache.get(key);
  if (L) return L;
  const ox = st.x + 0.5, oz = st.y + 0.5, f = frameOf(st.dir), nn = Math.max(1, Math.min(6, st.platforms | 0 || 4)), plats = [], lanes = [];
  for (let k = 0; k < nn; k++) lanes.push(laneC(k));
  for (let k = 1; k < nn; k++) plats.push({ v: laneC(k) - LANE / 2, hw: HW, u0: Math.max(-0.4, laneStart(k) + 0.35), u1: END - 0.12, top: 0.1, lanes: [k - 1, k], exit: [END + 0.16, laneC(k) - LANE / 2] });
  L = { big: true, multi: true, ox, oz, ax: f.ax, az: f.ay, bx: f.cx, bz: f.cy, lanes, plats };
  bigCache.set(key, L);
  if (bigCache.size > 50) bigCache.delete(bigCache.keys().next().value);
  return L;
}
