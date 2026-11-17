// Geometria peroanelor unei gări, în coordonate (u = de-a lungul liniei, v = spre clădire/curte): un singur loc pentru desenare și pentru oameni.
import { frameOf } from '../sim/terminal.js';
import { LANE, END, laneC, laneStart } from './terminalLayout.js';
import { DX, DY } from '../sim/consts.js';

const first = (t) => { for (let d = 0; d < 8; d++) if ((t >> d) & 1) return d; return 0; };
export const platformsOf = (st) => Math.max(1, Math.min(4, st.platforms | 0 || 1));

/** Direcția axei gării și partea clădirii (vector unitar în plan), la fel ca în createStations. */
export function stationFrame(s, st) {
  const d = first(s.track[st.y * s.w + st.x]), yaw = Math.atan2(DX[d], DY[d]) + Math.PI, l = Math.hypot(DX[d], DY[d]);
  return { yaw, ax: DX[d] / l, az: DY[d] / l, bx: Math.cos(yaw), bz: -Math.sin(yaw) };
}

export const STEP = 0.5; // distanța dintre liniile gării normale
const cache = new Map();

/** Lungimea (semi) a peronului clădirii la o gară normală. */
export const halfLen = (st) => ((0.9 + (st.size | 0) * 0.1) / 2) * (1 + 0.28 * (platformsOf(st) - 1));
export const EXT = 0.55; // peronul se prelungește dincolo de clădire, ca vagoanele să aibă peron lângă uși
export const topOf = (st) => 0.08 * (1 + 0.12 * (platformsOf(st) - 1));

/** { big, ox, oz, ax, az, bx, bz, lanes: [v,...], plats: [{ v, hw, u0, u1, top, lanes: [j], exit: [u,v] }], y } (memorat pe poziție/mărime/peroane). */
export function layoutOf(s, st) {
  const key = st.id + ':' + st.x + ',' + st.y + ',' + st.dir + ',' + st.size + ',' + (st.platforms | 0) + ',' + (st.big ? 1 : 0) + ',' + s.track[st.y * s.w + st.x];
  let L = cache.get(key);
  if (L) return L;
  const n = platformsOf(st), ox = st.x + 0.5, oz = st.y + 0.5;
  if (st.big) {
    const f = frameOf(st.dir), nn = Math.max(1, Math.min(6, st.platforms | 0 || 4)), plats = [], lanes = [];
    for (let k = 0; k < nn; k++) lanes.push(laneC(k));
    for (let k = 1; k < nn; k++) plats.push({ v: laneC(k) - LANE / 2, hw: 0.075, u0: Math.max(-0.4, laneStart(k) + 0.35), u1: END - 0.12, top: 0.1, lanes: [k - 1, k], exit: [END + 0.16, laneC(k) - LANE / 2] });
    L = { big: true, ox, oz, ax: f.ax, az: f.ay, bx: f.cx, bz: f.cy, lanes, plats };
  } else {
    const f = stationFrame(s, st), hl = halfLen(st) + EXT, top = topOf(st), plats = [], lanes = [];
    for (let k = 0; k < n; k++) lanes.push(-k * STEP);
    plats.push({ v: 0.255, hw: 0.075, u0: -hl + 0.06, u1: hl - 0.06, top, lanes: [0], exit: [0, 0.4] });
    for (let k = 1; k < n; k++) plats.push({ v: -(k - 0.5) * STEP, hw: 0.075, u0: -hl + 0.04, u1: hl - 0.04, top, lanes: k === 1 ? [0] : [], exit: [hl - 0.12, -(k - 0.5) * STEP] });
    L = { big: false, ox, oz, ax: f.ax, az: f.az, bx: f.bx, bz: f.bz, lanes, plats };
  }
  cache.set(key, L);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return L;
}
