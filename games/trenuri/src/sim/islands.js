// Lumea cu insule (etapa 7.1–7.2): stratul derivat al insulelor, cine pe ce insulă poate construi,
// materialele de construcție din porturi și hash-ul câmpurilor noi. Codul rulează doar când există `s.islands`.
import { MATS, SHIP_MODELS, BRIDGE } from './consts.js';
import { tileOwner } from './landBase.js';
import { bridgeShape, bridgeSteel } from './bigBridge.js';
import { GOODS } from './goods.js';
import { goodsOf } from './islandGen.js';
import { addNews } from './news.js';

/** Stratul derivat `isl`: id-ul insulei + 1 pe fiecare placă din dreptunghiul ei (0 = marea liberă). */
export function markIslands(s) {
  s.isl = new Uint8Array(s.w * s.h);
  s.islands.forEach((q, k) => { for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) s.isl[y * s.w + x] = k + 1; });
}
/** Indicele insulei de pe placă, -1 pe mare (sau fără insule). */
export const islandAt = (s, x, y) => (s.isl && x >= 0 && y >= 0 && x < s.w && y < s.h ? s.isl[y * s.w + x] - 1 : -1);
export const islandOfCo = (s, id) => (s.islands ? s.islands.findIndex((q) => q.owner === id) : -1);
/** Ce mărfuri se pot face pe insula k cu industriile ei (array NG de true/false). */
export const islandGoods = (s, k) => goodsOf(s.industries.filter((o) => islandAt(s, o.x, o.y) === k).map((o) => o.type));

/** Se poate construi aici? Pe mare și pe insulele fără stăpân da; pe insula altei companii doar pe parcela cumpărată (7.4). */
export function canBuild(s, c, x, y) {
  const k = islandAt(s, x, y);
  return k < 0 || s.islands[k].owner < 0 || tileOwner(s, x, y) === c.id;
}

/** Capătul unui pod mare pe insula altuia: pe teren propriu sau lângă portul acelei insule (în raza de o placă). */
function bridgeEndOk(s, c, x, y) {
  if (canBuild(s, c, x, y)) return true;
  const k = islandAt(s, x, y);
  return s.stations.some((q) => q.port && islandAt(s, q.x, q.y) === k && Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) <= 1);
}

function rectOk(s, c, x0, y0, x1, y1) {
  if (![x0, y0, x1, y1].every(Number.isInteger)) return true; // comanda proastă o refuză simularea
  const ax = Math.max(0, Math.min(x0, x1)), bx = Math.min(s.w - 1, Math.max(x0, x1)), ay = Math.max(0, Math.min(y0, y1)), by = Math.min(s.h - 1, Math.max(y0, y1));
  if (bx - ax > 64 || by - ay > 64) return true;
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (!canBuild(s, c, x, y)) return false;
  return true;
}

/** Comenzile de construcție verificate pe insulă (porturile altora se folosesc doar prin vapoare). */
function placeOk(s, cmd, c) {
  switch (cmd.type) {
    case 'buildTrack': return !Array.isArray(cmd.path) || cmd.path.every((p) => !Array.isArray(p) || canBuild(s, c, p[0], p[1]));
    case 'buildStation': case 'buildDepot': case 'placeSignal': case 'buildPort': return canBuild(s, c, cmd.x, cmd.y);
    case 'buildBridge': { const sh = bridgeShape(s, cmd); return !sh || (bridgeEndOk(s, c, sh.path[0][0], sh.path[0][1]) && bridgeEndOk(s, c, sh.path[sh.n + 1][0], sh.path[sh.n + 1][1])); }
    case 'levelTerrain': case 'clearArea': case 'buildTunnel': return rectOk(s, c, cmd.x0, cmd.y0, cmd.x1, cmd.y1);
    default: return true;
  }
}

export const portsOf = (s, id) => s.stations.filter((q) => q.port && q.owner === id);

/** Materialele cerute de o comandă (null = niciunul). Primul port și primul vapor sunt fără materiale. */
export function matNeed(s, cmd, c) {
  if (cmd.type === 'buildPort') return portsOf(s, c.id).length ? MATS.port : null;
  if (cmd.type === 'buyShip') { const m = SHIP_MODELS[cmd.model]; return m && s.ships.some((q) => q.owner === c.id) ? m.mat : null; }
  if (cmd.type === 'buildStation' && cmd.big && (cmd.size | 0) === 2) return MATS.big;
  if (cmd.type === 'upgradeStation') return MATS.up;
  if (cmd.type === 'buildThru') return MATS.big;
  if (cmd.type === 'buildBridge') { const sh = bridgeShape(s, cmd); return sh ? [[BRIDGE.steel, bridgeSteel(sh.n)]] : null; }
  return null;
}
export function matHave(s, id, g) { let n = 0; for (const p of portsOf(s, id)) n += p.cargo[g]; return n; }
/** [[marfă, tone lipsă]] */
export const matMissing = (s, id, need) => need.filter(([g, n]) => matHave(s, id, g) < n).map(([g, n]) => [g, n - matHave(s, id, g)]);
function consume(s, id, need) {
  for (const [g, n0] of need) {
    let n = n0;
    for (const p of portsOf(s, id)) { const k = Math.min(n, p.cargo[g]); p.cargo[g] -= k; n -= k; if (!n) break; }
  }
  s.dirty.stations = true;
}
/** Text prietenos: ce lipsește și pe ce insule se face. */
export function missingText(s, c, miss) {
  const mine = islandOfCo(s, c.id);
  const parts = miss.map(([g, n]) => {
    const where = s.islands.map((q, k) => (k !== mine && islandGoods(s, k)[g] ? q.name : null)).filter(Boolean);
    return `${n} t ${GOODS[g].name.toLowerCase()} (${where.length ? 'se face pe ' + where.slice(0, 2).join(' și ') : 'nu se face încă nicăieri'})`;
  });
  return `Îți lipsesc ${parts.join(', ')} în depozitul porturilor tale.${portsOf(s, c.id).length ? ' Adu-le cu vaporul ⚓🚢.' : ' Construiește întâi un port ⚓.'}`;
}

/** Învelișul comenzilor în modul cu insule: proprietarul insulei, porturi folosite de vapoare, materiale. */
export function islandApply(s, cmd, c, fn) {
  if (!placeOk(s, cmd, c)) return { ok: false, err: 'insula' };
  if (cmd.type === 'removeStation' && s.ships.some((q) => q.dest === cmd.id || q.route.some((p) => p.p === cmd.id))) return { ok: false, err: 'ruta' };
  const need = matNeed(s, cmd, c), miss = need ? matMissing(s, c.id, need) : [];
  if (miss.length) {
    const text = missingText(s, c, miss);
    addNews(s, '🧱', (s.companies.length > 1 ? c.name + ': ' : '') + text);
    return { ok: false, err: 'material', text };
  }
  const r = fn(s, cmd, c);
  if (r.ok && need) consume(s, c.id, need);
  return r;
}

/** Jucător intrat în timpul jocului: primește prima insulă fără stăpân (dacă mai e una). */
export function claimIsland(s, id) {
  const q = s.islands.find((i) => i.owner < 0);
  if (q) q.owner = id;
}

const ACT = { load: 1, sell: 2, swap: 3 };
/** Hash-ul câmpurilor din modul cu insule: proprietari, piața, vapoarele. `num` vine din world.js. */
export function hashIslands(s, h, num) {
  for (const q of s.islands) h = num(h, q.owner + 1);
  if (s.land) for (let i = 0; i < s.land.length; i++) h = num(h, s.land[i]);
  for (const o of s.industries) if (o.buyer !== undefined) h = num(h, o.id * 16 + o.buyer + 1);
  for (const c of s.companies) {
    h = num(h, (c.ar | 0) + (c.th | 0) * 64);
    if (s.mode !== 'expert' && c.tr) { h = num(h, c.tr.length); for (const t of c.tr) h = num(num(h, t.p), t.r); }
  }
  h = num(h, s.leader === undefined ? -1 : s.leader);
  for (const row of s.market) for (const p of row) h = num(h, p);
  for (const sh of s.ships) {
    h = num(num(num(num(h, sh.id), sh.owner * 16 + sh.model), sh.seg), sh.pos);
    h = num(num(num(num(h, sh.state), sh.wait), sh.dest), sh.at);
    h = num(num(h, sh.money), sh.path.length);
    for (const b of sh.load) h = num(h, b.c * 65536 + b.n);
    for (const p of sh.route) { h = num(num(h, p.p * 4 + ACT[p.a]), p.w | 0); for (const g of p.g) h = num(h, g); if (p.l) for (const g of p.l) h = num(h, 100 + g); }
  }
  return h;
}
