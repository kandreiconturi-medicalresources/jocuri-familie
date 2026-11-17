// „Construcție în așteptare” (7.8): din meniul de clic dreapta alegi ce construiești, vezi previzualizarea cu preț și abia apoi confirmi.
// Logică pură (fără DOM): mașina de stări `reduce` și `quote` (cost + motiv, fără să schimbe lumea reală).
import { applyCommand, ERR_TEXT } from '../sim/commands.js';
import { planTrack } from '../sim/plan.js';
import { levelPlan } from '../sim/terraform.js';
import { bridgeInfo } from '../sim/bigBridge.js';
import { autoDir } from '../sim/terminal.js';

/** Construcții cu două puncte: începutul e pus din meniu, capătul se alege pe hartă (atingere sau mouse). */
export const TWO_POINT = ['track', 'level', 'bridge'];
/** Construcții cu un singur loc (rotirea merge doar la terminal). */
export const ONE_POINT = ['station', 'terminal', 'port', 'depot', 'signal', 'land'];
export const KINDS = [...TWO_POINT, ...ONE_POINT];
export const isTwoPoint = (k) => TWO_POINT.includes(k);

/** Starea: null (nimic în așteptare) sau { kind, a, b, locked }. Evenimente: start, hover, tap, cancel. */
export function reduce(st, ev) {
  switch (ev.type) {
    case 'start': return KINDS.includes(ev.kind) && ev.a ? { kind: ev.kind, a: ev.a, b: null, locked: false } : st;
    case 'hover': return st && isTwoPoint(st.kind) && !st.locked && ev.b ? { ...st, b: ev.b } : st;
    case 'tap': return st && isTwoPoint(st.kind) && ev.b ? { ...st, b: ev.b, locked: true } : st;
    case 'cancel': return null;
    default: return st;
  }
}

const fail = (err, text) => ({ ok: false, err, cost: 0, text: text || ERR_TEXT[err] || 'Nu se poate aici.' });
const NEED_END = { ok: false, err: 'capat', cost: 0, wait: true, text: 'Alege capătul pe hartă.' };
const cash = (s, me) => (s.sandbox ? Infinity : (s.companies[me] || s.companies[0]).cash);

/** Comanda pentru o construcție cu un singur loc. tdir = direcția curții terminalului (-1 = automat). */
export function oneCmd(s, kind, a, o = {}) {
  const x = a.x, y = a.y;
  switch (kind) {
    case 'station': return { type: 'buildStation', x, y, size: o.size === 2 || o.size === undefined ? 1 : o.size, dir: 0 };
    case 'terminal': { const d = o.tdir >= 0 ? o.tdir : autoDir(s, x, y); return { type: 'buildStation', x, y, size: 2, big: true, dir: d < 0 ? undefined : d }; }
    case 'port': return { type: 'buildPort', x, y };
    case 'depot': return { type: 'buildDepot', x, y };
    case 'land': return { type: 'buyLand', px: x >> 2, py: y >> 2 };
    case 'signal': return { type: 'placeSignal', x, y, dir: o.dir | 0, twoWay: false };
    default: return null;
  }
}

/** Ce s-ar întâmpla: { ok, cost, err?, text?, cmd?, wait? }. Pentru un loc se încearcă comanda pe o copie a lumii; pentru două puncte se folosesc planificatoarele. */
export function quote(s, me, st, o = {}) {
  if (!st) return fail('inexistent');
  const { kind, a, b } = st;
  if (!isTwoPoint(kind)) {
    const cmd = oneCmd(s, kind, a, o);
    const r = applyCommand(structuredClone(s), { by: me, ...cmd });
    return r.ok ? { ok: true, cost: r.cost || 0, cmd } : fail(r.err, r.text);
  }
  if (!b || (b.x === a.x && b.y === a.y)) return NEED_END;
  let res;
  if (kind === 'track') {
    const p = planTrack(s, [a.x, a.y], [b.x, b.y], me, { level: true });
    if (!p) return fail('drum', 'Nu găsesc cum să trag șina până acolo.');
    res = { ok: true, cost: p.cost, path: p.path, cmd: p.level && p.level.length ? { type: 'buildTrack', path: p.path, level: p.level } : { type: 'buildTrack', path: p.path } };
  } else if (kind === 'level') {
    const h = s.height[a.y * s.w + a.x], r = { x0: a.x, y0: a.y, x1: b.x, y1: b.y}, p = levelPlan(s, r, h, me);
    res = p.ok ? { ok: true, cost: p.cost, rect: r, cmd: { type: 'levelTerrain', ...r, h } } : fail(p.err);
  } else {
    const cmd = { type: 'buildBridge', x0: a.x, y0: a.y, x1: b.x, y1: b.y }, p = bridgeInfo(s, s.companies[me] || s.companies[0], cmd);
    res = p.ok ? { ok: true, cost: p.cost, path: p.path, cmd } : fail(p.err);
  }
  if (res.ok && cash(s, me) < res.cost) return { ...fail('bani'), cost: res.cost, path: res.path, rect: res.rect };
  return res;
}

/** Opțiunile din meniu: la cele cu un singur loc adaugă prețul (sub) sau motivul (off). `tdir` pentru terminal. */
export function decorate(s, me, t, opts, fmt = String) {
  return opts.map((op) => {
    if (!ONE_POINT.includes(op.id)) return op;
    const q = quote(s, me, { kind: op.id, a: t }, {});
    return q.ok ? { ...op, sub: op.sub || fmt(q.cost) } : { ...op, off: q.text };
  });
}
