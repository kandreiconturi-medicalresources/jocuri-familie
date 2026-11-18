// Unealta „🛤️ Culoar prin oraș”: alegi câte linii (2–5), axa (↔ / ↕) și locul (prin centru / pe margine), atingi orașul și vezi fâșia
// (verde = merge, casele de mutat portocaliu, capetele liniilor aurii) cu prețul ambelor variante. ✅ construiește.
import { corVariants, corTiles, COR_MIN, COR_MAX, ERR_TEXT } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const BLUE = '#4dabf7', GOLD = '#ffd23f', GREEN = '#5bd66f', ORANGE = '#ff9f43';
export const COR_TOOL = { id: 'corridor', e: '🛤️', t: 'Culoar prin oraș', hint: 'Alege câte linii (2–5), axa și locul (prin centru sau pe margine), apoi atinge orașul: o fâșie de linii paralele îl traversează, cu o singură gară pentru tot orașul. Casele din fâșie se mută cu despăgubire.' };

export function createCorridorTool(c) {
  const o = { n: 3, axis: 'h', side: 'centru' };
  const S = () => c.S(), me = () => (S().companies[viewer.co] ? viewer.co : 0);
  let armed = null, last = null, memo = null, key = ''; // armed = { city } fixat la prima atingere; last = orașul văzut ultima dată
  const cityNear = (t) => { let best = null, bd = 99; for (const q of S().cities) { const d = Math.max(Math.abs(q.x - t.x), Math.abs(q.y - t.y)); if (d < bd && d <= 9) { bd = d; best = q; } } return best; };
  const variants = (city) => { const s = S(), k = `${city.id},${o.axis},${o.n},${s.tick},${s.companies[me()].cash}`; if (!memo || memo.k !== k) memo = { k, v: corVariants(s, me(), city.id, o.axis, o.n) }; return memo.v; };
  const price = (r) => (r.ok ? lei(r.cost) : '✖');
  const inStrip = (r, t) => r.ok && corTiles(r.x, r.y, r.dir, r.n, r.E).some(([x, y]) => x === t.x && y === t.y);

  function paint(t) {
    const city = armed ? armed.city : t && cityNear(t);
    if (!city) { c.ov().clear(); return; }
    last = city;
    const s = S(), v = variants(city), r = v[o.side], out = [{ x: city.x, y: city.y, color: GOLD }];
    if (r.ok) {
      const gone = new Set(r.houses), inb = ([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h;
      for (const [x, y] of corTiles(r.x, r.y, r.dir, r.n, r.E).filter(inb)) out.push({ x, y, color: gone.has(y * s.w + x) ? ORANGE : GREEN });
      for (const q of r.fan) q.forEach(([x, y], k) => { if (k && inb([x, y])) out.push({ x, y, color: k === q.length - 1 ? GOLD : BLUE }); });
      out.push({ x: r.x, y: r.y, color: GOLD });
    }
    c.ov().set(out);
    const k = `${city.id},${o.axis},${o.side},${o.n},${price(v.centru)},${price(v.margine)},${armed ? 1 : 0}`;
    if (k === key) return;
    key = k;
    if (r.ok) c.hud().hint(`🛤️ ${city.name}, ${o.n} linii ${o.side === 'centru' ? 'prin centru' : 'pe margine'}: ${lei(r.cost)}${r.houses.length ? ` · ${r.houses.length} case mutate (despăgubiri ${lei(r.pay)})` : ''}${r.levelCost ? ` · nivelare ${lei(r.levelCost)}` : ''}. Centru ${price(v.centru)} · margine ${price(v.margine)}.${armed ? '' : ' Atinge orașul ca să alegi.'}`, false, 4000);
    else c.hud().hint(ERR_TEXT[r.err] || 'Aici nu încape culoarul.', true, 3500);
  }
  function tap(t) {
    if (!t) return;
    if (armed) {
      if (inStrip(variants(armed.city)[o.side], t)) { build(); return; }
      armed = null; // atingere în afara fâșiei = alegi alt oraș
    }
    const city = cityNear(t);
    if (!city) { c.hud().hint('Atinge un oraș ca să treacă culoarul prin el.', true, 3000); return; }
    const r = variants(city)[o.side];
    if (!r.ok) { last = city; key = ''; paint(t); return; }
    armed = { city };
    c.bar(); key = ''; paint(t);
    c.hud().hint(`🛤️ ${city.name}: ${lei(r.cost)}. Apasă ✅ Construiește (sau Enter / atinge fâșia). ❌ anulează.`, false, 8000);
  }
  function build() {
    if (!armed) return;
    const city = armed.city, r = variants(city)[o.side];
    armed = null; c.bar();
    const res = r.ok ? c.exec({ type: 'buildCorridor', city: city.id, axis: o.axis, side: o.side, n: o.n, dir: r.dir }) : r;
    memo = null; key = '';
    if (res && res.ok) { c.hud().hint(`🛤️ Culoar cu ${o.n} linii · ${lei(res.cost)}. Leagă fiecare capăt auriu la altă șină: toate trenurile opresc în aceeași gară.`, false, 7000); c.ov().clear(); }
    else c.hud().hint((res && (ERR_TEXT[res.err] || res.err)) || 'Nu s-a putut construi culoarul.', true, 5000);
  }
  const redo = () => { key = ''; const city = armed && armed.city; armed = null; c.bar(); if (city) tap({ x: city.x, y: city.y }); else if (last) paint({ x: last.x, y: last.y }); };
  function bar() {
    const out = [], v = armed ? variants(armed.city) : last ? variants(last) : null;
    if (armed) out.push({ label: '✅ Construiește', small: price(v[o.side]), cls: 'go', fn: build }, { label: '❌ Anulează', fn: cancel });
    for (let n = COR_MIN; n <= COR_MAX; n++) out.push({ label: `${n} linii`, on: o.n === n, fn: () => { o.n = n; redo(); } });
    out.push({ label: '↔ Orizontal', on: o.axis === 'h', fn: () => { o.axis = 'h'; redo(); } }, { label: '↕ Vertical', on: o.axis === 'v', fn: () => { o.axis = 'v'; redo(); } });
    for (const [side, name] of [['centru', 'Prin centru'], ['margine', 'Pe margine']]) out.push({ label: name, small: v ? price(v[side]) : '', on: o.side === side, fn: () => { o.side = side; redo(); } });
    return out;
  }
  function cancel() { if (!armed) return false; armed = null; key = ''; c.bar(); c.ov().clear(); return true; }
  return { o, paint, tap, bar, build, cancel, armed: () => !!armed, reset() { key = ''; armed = null; last = null; } };
}
