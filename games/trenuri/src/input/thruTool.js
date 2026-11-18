// Unealta „🏙️ Gară mare de trecere”: alegi 2–10 linii, vezi locul ocupat (verde / roșu, casele de mutat în portocaliu) și prețul,
// apoi atingi placa din oraș (sau gara ta normală, ca s-o transformi; sau gara de trecere, ca să-i adaugi linii).
import { thruNear, thruTiles, mainTiles, THRU_MIN, THRU_MAX, THRU_BASE, THRU_TRACK, ERR_TEXT } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const BLUE = '#4dabf7', GOLD = '#ffd23f', GREEN = '#5bd66f', RED = '#ff5a6a', ORANGE = '#ff9f43';
export const THRU_TOOL = { id: 'thru', e: '🏙️', t: 'Gară mare de trecere', hint: 'Alege câte linii (2–10), apoi atinge orașul: gara își caută singură locul (auriu), își pune linia dreaptă, nivelează terenul și mută casele cu despăgubire. Acoperă tot orașul.' };

export function createThruTool(c) {
  const o = { n: 4, join: false }; // join = „intrare comună” (scara veche de macaze); implicit liniile ies separat, drepte
  let key = '';
  const S = () => c.S(), s0 = S, me = () => (S().companies[viewer.co] ? viewer.co : 0);
  let memo = null, armed = null; // armed = locul ales la prima atingere { x, y, dir, n, cost, houses, t }: rămâne fix până la ✅ / ❌ // căutarea în jur e ceva mai grea: o refacem doar când se schimbă placa, linii sau starea
  const info = (t) => { const s = S(), k = `${t.x},${t.y},${o.n},${s.tick},${s.companies[me()].cash}`; if (!memo || memo.k !== k) memo = { k, r: thruNear(s, me(), t.x, t.y, o.n, 5, o.join ? 'join' : '') }; return memo.r; };

  function paint(t) {
    if (armed) t = armed.t; // locul ales nu fuge după mouse
    if (!t) { c.ov().clear(); return; }
    const s = S(), r = armed ? { ...armed, ok: true } : info(t), st = r.st || s.stations.find((q) => q.x === t.x && q.y === t.y && q.thru);
    const px = r.ok ? r.x : t.x, py = r.ok ? r.y : t.y;
    const dir = r.ok ? r.dir : st && st.thru ? st.dir : (s.track[t.y * s.w + t.x] & 0x11) ? 2 : 0;
    const gone = new Set(r.ok ? r.houses : []), out = [{ x: px, y: py, color: GOLD }];
    const inb = ([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h;
    for (const [x, y] of [...thruTiles(px, py, dir, o.n), ...mainTiles(px, py, dir, o.n)].filter(inb)) out.push({ x, y, color: gone.has(y * s.w + x) ? ORANGE : r.ok ? GREEN : RED });
    if (r.ok && r.fan) for (const q of r.fan) q.forEach(([x, y], k) => { if (k && inb([x, y])) out.push({ x, y, color: k === q.length - 1 ? GOLD : BLUE }); }); // intrările (capăt auriu = aici legi o linie)
    c.ov().set(out);
    const k = `${t.x},${t.y},${o.n},${r.ok ? r.cost : r.err},${armed ? 1 : 0}`;
    if (k === key || armed) { key = k; return; }
    key = k;
    if (r.ok) c.hud().hint(`🏙️ ${r.n} linii · ${lei(r.cost)}${r.houses.length ? ` · ${r.houses.length} case mutate (despăgubiri ${lei(r.pay)})` : ''}${r.levelCost ? ` · nivelare ${lei(r.levelCost)}` : ''}. Atinge ca să construiești${px !== t.x || py !== t.y ? ' (locul bun cel mai apropiat, cu auriu)' : ''}.`, false, 3000);
    else c.hud().hint(r.err === 'exista' ? `Gara are deja ${st ? st.platforms : ''} linii: alege mai multe ca să o lărgești.` : ERR_TEXT[r.err] || 'Aici nu încape gara mare.', true, 3000);
  }
  function tap(t) {
    if (!t) return;
    if (!armed) { // prima atingere alege locul (auriu) și îl fixează; construiești cu ✅, a doua atingere sau Enter
      const f = info(t);
      if (!f.ok) { key = ''; paint(t); return; }
      const st = s0().stations.find((q) => q.x === f.x && q.y === f.y);
      armed = { x: f.x, y: f.y, dir: f.dir, n: o.n, cost: f.cost, fan: f.fan, houses: f.houses, pay: f.pay, levelCost: f.levelCost, up: st && st.thru ? st.id : -1, t: { x: f.x, y: f.y } };
      c.bar(); key = ''; paint(t);
      c.hud().hint(`🏙️ ${o.n} linii · ${lei(f.cost)}: apasă ✅ Construiește (sau Enter / atinge încă o dată). ❌ sau clic dreapta anulează.`, false, 8000);
      return;
    }
    const inside = [[armed.x, armed.y], ...thruTiles(armed.x, armed.y, armed.dir, armed.n), ...mainTiles(armed.x, armed.y, armed.dir, armed.n)].some(([x, y]) => x === t.x && y === t.y);
    if (inside) build(); else { armed = null; tap(t); } // atingere în afara locului ales = alegi alt loc
  }
  function build() {
    if (!armed) return;
    const a = armed;
    armed = null; c.bar();
    const r = a.up >= 0 ? c.exec({ type: 'setThruTracks', id: a.up, n: a.n }) : c.exec({ type: 'buildThru', x: a.x, y: a.y, n: a.n, dir: a.dir, join: o.join || undefined });
    memo = null; key = '';
    if (r && r.ok) c.hud().hint(a.up >= 0 ? `Gata: ${a.n} linii · ${lei(r.cost)}.` : `🏙️ Gară mare cu ${a.n} linii · ${lei(r.cost)}. Are ${a.fan ? a.fan.length : 2} capete (aurii): leagă la fiecare câte o șină din alt loc, iar trenurile intră toate în aceeași gară.`, false, 6000);
    else c.hud().hint((r && (ERR_TEXT[r.err] || r.err)) || 'Nu s-a putut construi gara.', true, 5000);
    if (r && r.ok) c.ov().clear(); else paint(a.t); // după construire nu mai lăsăm previzualizarea pe hartă
  }
  function bar() {
    const out = [];
    if (armed) out.push({ label: '✅ Construiește', small: lei(armed.cost), cls: 'go', fn: build }, { label: '❌ Anulează', fn: cancel });
    out.push({ label: o.join ? '🔀 Intrare comună' : '↔️ Linii separate', small: o.join ? 'o singură linie în față' : 'câte o șină pe linie', on: !o.join, fn: () => { o.join = !o.join; key = ''; const t = armed && armed.t; armed = null; if (t) tap(t); c.bar(); } });
    for (let n = THRU_MIN; n <= THRU_MAX; n++) out.push({ label: `${n} linii`, small: lei(THRU_BASE + n * THRU_TRACK) + '+', on: o.n === n, fn: () => { o.n = n; key = ''; const t = armed && armed.t; armed = null; if (t) tap(t); c.bar(); } }); // alt număr de linii: același loc, se re-alege
    return out;
  }
  function cancel() { if (!armed) return false; armed = null; key = ''; c.bar(); c.ov().clear(); return true; }
  return { o, paint, tap, bar, build, cancel, armed: () => !!armed, reset() { key = ''; armed = null; } };
}
