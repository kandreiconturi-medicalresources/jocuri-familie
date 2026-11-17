// Unealta „🏙️ Gară mare de trecere”: alegi 2–10 linii, vezi locul ocupat (verde / roșu, casele de mutat în portocaliu) și prețul,
// apoi atingi placa din oraș (sau gara ta normală, ca s-o transformi; sau gara de trecere, ca să-i adaugi linii).
import { thruNear, thruTiles, mainTiles, THRU_MIN, THRU_MAX, THRU_BASE, THRU_TRACK, ERR_TEXT } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const GOLD = '#ffd23f', GREEN = '#5bd66f', RED = '#ff5a6a', ORANGE = '#ff9f43';
export const THRU_TOOL = { id: 'thru', e: '🏙️', t: 'Gară mare de trecere', hint: 'Alege câte linii (2–10), apoi atinge orașul: gara își caută singură locul (auriu), își pune linia dreaptă, nivelează terenul și mută casele cu despăgubire. Acoperă tot orașul.' };

export function createThruTool(c) {
  const o = { n: 4 };
  let key = '';
  const S = () => c.S(), me = () => (S().companies[viewer.co] ? viewer.co : 0);
  let memo = null, armed = '', armedAt = null; // căutarea în jur e ceva mai grea: o refacem doar când se schimbă placa, linii sau starea
  const info = (t) => { const s = S(), k = `${t.x},${t.y},${o.n},${s.tick},${s.companies[me()].cash}`; if (!memo || memo.k !== k) memo = { k, r: thruNear(s, me(), t.x, t.y, o.n) }; return memo.r; };

  function paint(t) {
    if (!t) { c.ov().clear(); return; }
    const s = S(), r = info(t), st = r.st || s.stations.find((q) => q.x === t.x && q.y === t.y && q.thru);
    const px = r.ok ? r.x : t.x, py = r.ok ? r.y : t.y;
    const dir = r.ok ? r.dir : st && st.thru ? st.dir : (s.track[t.y * s.w + t.x] & 0x11) ? 2 : 0;
    const gone = new Set(r.ok ? r.houses : []), out = [{ x: px, y: py, color: GOLD }];
    const inb = ([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h;
    for (const [x, y] of [...thruTiles(px, py, dir, o.n), ...mainTiles(px, py, dir, o.n)].filter(inb)) out.push({ x, y, color: gone.has(y * s.w + x) ? ORANGE : r.ok ? GREEN : RED });
    c.ov().set(out);
    const k = `${t.x},${t.y},${o.n},${r.ok ? r.cost : r.err}`;
    if (k === key) return;
    key = k;
    if (r.ok) c.hud().hint(`🏙️ ${r.n} linii · ${lei(r.cost)}${r.houses.length ? ` · ${r.houses.length} case mutate (despăgubiri ${lei(r.pay)})` : ''}${r.levelCost ? ` · nivelare ${lei(r.levelCost)}` : ''}. Atinge ca să construiești${px !== t.x || py !== t.y ? ' (locul bun cel mai apropiat, cu auriu)' : ''}.`, false, 3000);
    else c.hud().hint(r.err === 'exista' ? `Gara are deja ${st ? st.platforms : ''} linii: alege mai multe ca să o lărgești.` : ERR_TEXT[r.err] || 'Aici nu încape gara mare.', true, 3000);
  }
  function tap(t) {
    if (!t) return;
    const s = S(), st = s.stations.find((q) => q.x === t.x && q.y === t.y), f = info(t);
    const want = f.ok ? `${f.x},${f.y},${f.dir},${o.n}` : '';
    if (want && armed !== want) { // prima atingere alege locul, a doua (sau ✅ din bară) construiește
      armed = want; armedAt = t; c.bar();
      c.hud().hint(`🏙️ ${o.n} linii · ${lei(f.cost)}: atinge încă o dată sau apasă ✅ Construiește.`, false, 6000);
      return;
    }
    armed = ''; armedAt = null; c.bar();
    const r = st && st.thru ? c.exec({ type: 'setThruTracks', id: st.id, n: o.n }) : f.ok ? c.exec({ type: 'buildThru', x: f.x, y: f.y, n: o.n, dir: f.dir }) : c.exec({ type: 'buildThru', x: t.x, y: t.y, n: o.n });
    memo = null;
    if (r.ok) c.hud().hint(st && st.thru ? `Gata: ${o.n} linii · ${lei(r.cost)}.` : `🏙️ Gară mare cu ${o.n} linii · ${lei(r.cost)}. Linia principală trece drept prin gară: leagă-i capetele cu șina ta.`, false, 6000);
    key = '';
    paint(t);
  }
  function bar() {
    const out = [];
    if (armedAt) out.push({ label: '✅ Construiește', small: 'gara aleasă', cls: 'go', fn: () => tap(armedAt) }, { label: '❌ Anulează', fn: () => { armed = ''; armedAt = null; c.bar(); } });
    for (let n = THRU_MIN; n <= THRU_MAX; n++) out.push({ label: `${n} linii`, small: lei(THRU_BASE + n * THRU_TRACK) + '+', on: o.n === n, fn: () => { o.n = n; key = ''; c.bar(); } });
    return out;
  }
  return { o, paint, tap, bar, reset() { key = ''; armed = ''; armedAt = null; } };
}
