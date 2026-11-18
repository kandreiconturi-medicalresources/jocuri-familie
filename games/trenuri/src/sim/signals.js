// Semnale: automate (la intrarea în macaze și gări) și manuale (🚦). Rezervarea traseului e în reserve.js.
import { DX, DY, opp, T_PRESENT, T_OWNER_MASK, T_OWNER_SHIFT, SIGNAL_COST, BLOCK_MIN, BLOCK_MAX } from './consts.js';
import { linkCount } from './blocks.js';
import { blockSignals } from './blocksig.js';
import { laneExits } from './thruFan.js';

const DIR = new Int8Array(9).fill(-1);
for (let d = 0; d < 8; d++) DIR[(DY[d] + 1) * 3 + DX[d] + 1] = d;
/** Direcția (0–7) pasului de la placa `a` la placa vecină `b`. */
export const dirOf = (w, a, b) => DIR[(((b / w) | 0) - ((a / w) | 0) + 1) * 3 + (b % w) - (a % w) + 1];

const fail = (err) => ({ ok: false, err });
const inMap = (s, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < s.w && y < s.h;

/** Stratul derivat `sgm[i]`: biții direcțiilor de mers (pasul de intrare pe placă) care au semnal. */
export function rebuildSignals(s) {
  s.sgm = new Uint8Array(s.w * s.h);
  for (const g of s.signals) { const i = g.y * s.w + g.x; s.sgm[i] |= 1 << g.dir; if (g.twoWay) s.sgm[i] |= 1 << opp(g.dir); }
}

/** Semnalele automate: câte unul pe fiecare intrare a unui macaz (3+ legături) sau a unei gări. Cele manuale rămân. */
export function syncAuto(s) {
  const old = new Map();
  for (const g of s.signals) if (g.auto) old.set(g.y * s.w * 8 + g.x * 8 + g.dir, g);
  const out = s.signals.filter((g) => !g.auto);
  const mk = (x, y, dir, t) => out.push(old.get(y * s.w * 8 + x * 8 + dir) || { id: s.sigId++, owner: (t & T_OWNER_MASK) >> T_OWNER_SHIFT, x, y, dir, twoWay: false, auto: true });
  if (s.autoSig !== false) {
    for (let i = 0; i < s.track.length; i++) {
      const t = s.track[i];
      if (!(t & T_PRESENT) || !(linkCount(t) >= 3 || s.stm[i])) continue;
      const x = i % s.w, y = (i / s.w) | 0;
      for (let d = 0; d < 8; d++) {
        if (!((t >> d) & 1)) continue;
        const dir = opp(d);
        mk(x, y, dir, t);
      }
    }
  }
  if (s.autoSig !== false) { // gările cu intrări separate: câte un semnal pe fiecare linie, la ieșire (în ambele sensuri)
    for (const st of s.stations) for (const q of laneExits(st)) {
      if (q.x < 0 || q.y < 0 || q.ox < 0 || q.oy < 0 || q.x >= s.w || q.y >= s.h || q.ox >= s.w || q.oy >= s.h) continue;
      const i = q.y * s.w + q.x, o = q.oy * s.w + q.ox, t = s.track[i];
      if (!(t & T_PRESENT) || !(s.track[o] & T_PRESENT) || !((t >> dirOf(s.w, i, o)) & 1)) continue;
      mk(q.x, q.y, dirOf(s.w, i, o), t); mk(q.x, q.y, dirOf(s.w, o, i), t);
    }
  }
  if (s.autoBlock > 0) blockSignals(s, s.autoBlock, dirOf, (i, dir) => mk(i % s.w, (i / s.w) | 0, dir, s.track[i]));
  s.signals = out;
  rebuildSignals(s);
  s.dirty.signals = true;
}

/** Aspectul semnalului: 1 verde, 0 roșu. Roșu cât un tren așteaptă la el sau cât traseul din spatele lui e ocupat. */
export function signalAspect(s, id) {
  const g = s.signals.find((q) => q.id === id);
  if (!g) return 1;
  const i = g.y * s.w + g.x;
  for (const t of s.trains) if (t.redAt === i + 1) return 0;
  const st = s.stm[i] ? s.stations.find((q) => q.y * s.w + q.x === i) : null;
  let inside = 0; // roșu doar când locul e ținut de trenuri care au trecut deja de semnal (cele care se apropie au drum liber)
  for (const t of s.trains) if (t.rv.includes(i) && (t.state === 2 || t.path.indexOf(i) <= t.seg + 1)) inside++;
  return inside >= (st ? st.platforms || 1 : 1) ? 0 : 1;
}

function placeSignal(s, cmd, c) {
  const { x, y } = cmd, dir = cmd.dir;
  if (!inMap(s, x, y) || !Number.isInteger(dir) || dir < 0 || dir > 7) return fail('drum');
  const i = y * s.w + x, t = s.track[i];
  if (!(t & T_PRESENT)) return fail('inexistent');
  if (((t & T_OWNER_MASK) >> T_OWNER_SHIFT) !== c.id) return fail('proprietar');
  const twoWay = !!cmd.twoWay;
  if (!((t >> opp(dir)) & 1) && !(twoWay && ((t >> dir) & 1))) return fail('drum'); // trebuie să existe șină pe unde intră trenul
  const same = s.signals.find((g) => !g.auto && g.x === x && g.y === y && g.dir === dir);
  if (same && same.twoWay === twoWay) return fail('exista');
  if (!s.sandbox && c.cash < SIGNAL_COST) return fail('bani');
  if (!s.sandbox) c.cash -= SIGNAL_COST;
  if (same) same.twoWay = twoWay; else s.signals.push({ id: s.sigId++, owner: c.id, x, y, dir, twoWay, auto: false });
  rebuildSignals(s); s.dirty.signals = true;
  return { ok: true, cost: SIGNAL_COST };
}

function removeSignal(s, cmd, c) {
  const k = cmd.id !== undefined ? s.signals.findIndex((g) => g.id === cmd.id) : s.signals.findIndex((g) => !g.auto && g.x === cmd.x && g.y === cmd.y);
  if (k < 0) return fail('inexistent');
  if (s.signals[k].owner !== c.id) return fail('proprietar');
  if (s.signals[k].auto) return fail('drum'); // cele automate se opresc cu setAutoSignals
  s.signals.splice(k, 1);
  rebuildSignals(s); s.dirty.signals = true;
  return { ok: true, cost: 0 };
}

function setAutoSignals(s, cmd) {
  s.autoSig = !!cmd.on;
  syncAuto(s);
  return { ok: true, cost: 0 };
}

/** „Semnale automate pe linie lungă”: n = 0 oprit, altfel un semnal de bloc la fiecare n plăci. */
function setAutoBlock(s, cmd) {
  const n = cmd.n | 0;
  if (n !== 0 && (n < BLOCK_MIN || n > BLOCK_MAX)) return fail('drum');
  s.autoBlock = n;
  syncAuto(s);
  return { ok: true, cost: 0 };
}

export const SIGNAL_COMMANDS = { placeSignal, removeSignal, setAutoSignals, setAutoBlock };
