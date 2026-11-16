// „🌉 Pod mare” (etapa 7.3): `buildBridge { x0, y0, x1, y1 }` — linie dreaptă (orizontală, verticală sau diagonală la 45°),
// de pe uscat pe uscat, peste cel mult `BRIDGE.max` plăci de apă. Plăcile podului poartă șină obișnuită (T_BRIDGE) plus T_BIGBR
// pentru randare, deci trenurile merg pe el ca pe orice pod. Șina normală rămâne la MAX_BRIDGE.
import { COST, WATER_H, BRIDGE, T_PRESENT, T_BIGBR, T_OWNER_MASK, T_OWNER_SHIFT } from './consts.js';
import { layPath } from './terraform.js';
import { syncAuto } from './signals.js';
import { addNews } from './news.js';

const fail = (err) => ({ ok: false, err });
const isInt = Number.isInteger;
const ownerOf = (t) => (t & T_OWNER_MASK) >> T_OWNER_SHIFT;
/** Tone de oțel pentru un pod cu n plăci de apă. */
export const bridgeSteel = (n) => Math.max(2, n >> 1);
export const bridgeCost = (n) => BRIDGE.base * n + BRIDGE.sq * n * n;

/** Geometria comenzii: { path, n } (n = plăci de apă între capete) sau null dacă nu e o linie dreaptă validă. */
export function bridgeShape(s, cmd) {
  if (!cmd) return null;
  const { x0, y0, x1, y1 } = cmd;
  if (![x0, y0, x1, y1].every(isInt) || x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 >= s.w || x1 >= s.w || y0 >= s.h || y1 >= s.h) return null;
  const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  if (len < 2 || len - 1 > BRIDGE.max || (dx && dy && Math.abs(x1 - x0) !== Math.abs(y1 - y0))) return null;
  const path = [];
  for (let k = 0; k <= len; k++) path.push([x0 + dx * k, y0 + dy * k]);
  return { path, n: len - 1 };
}

/** Verifică podul și îi calculează costul: { ok, err, path, n, cost, need } (need = [[marfă, tone]], doar în lumea cu insule). */
export function bridgeInfo(s, c, cmd) {
  const sh = bridgeShape(s, cmd);
  if (!sh) {
    const { x0, y0, x1, y1 } = cmd || {};
    const far = [x0, y0, x1, y1].every(isInt) && Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) - 1 > BRIDGE.max && (x0 === x1 || y0 === y1 || Math.abs(x1 - x0) === Math.abs(y1 - y0));
    return fail(far ? 'apa' : 'pod');
  }
  const { path, n } = sh, last = path.length - 1;
  let cost = bridgeCost(n);
  for (let k = 0; k <= last; k++) {
    const i = path[k][1] * s.w + path[k][0], t = s.track[i], end = k === 0 || k === last;
    if (s.occ[i]) return fail('cladire');
    if ((t & T_PRESENT) && ownerOf(t) !== c.id) return fail('proprietar');
    if (end) {
      if (s.water[i] || s.height[i] <= WATER_H) return fail('teren'); // capetele stau pe uscat
      if (!(t & T_PRESENT)) cost += COST.tile;
    } else if (!s.water[i]) return fail('teren'); // între capete doar apă
  }
  return { ok: true, path, n, cost, need: s.islands ? [[BRIDGE.steel, bridgeSteel(n)]] : null };
}

function buildBridge(s, cmd, c) {
  const r = bridgeInfo(s, c, cmd);
  if (!r.ok) return r;
  if (!s.sandbox && c.cash < r.cost) return fail('bani');
  if (!s.sandbox) c.cash -= r.cost;
  layPath(s, r.path, c);
  for (let k = 1; k < r.path.length - 1; k++) s.track[r.path[k][1] * s.w + r.path[k][0]] |= T_BIGBR;
  syncAuto(s);
  addNews(s, '🌉', `Pod nou de ${r.n} plăci peste apă! Trenurile pot trece dintr-o parte în alta.`);
  return { ok: true, cost: r.cost, n: r.n };
}

export const BRIDGE_COMMANDS = { buildBridge };
