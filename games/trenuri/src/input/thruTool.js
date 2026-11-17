// Unealta „🏙️ Gară mare de trecere”: alegi 2–10 linii, vezi locul ocupat (verde / roșu, casele de mutat în portocaliu) și prețul,
// apoi atingi placa din oraș (sau gara ta normală, ca s-o transformi; sau gara de trecere, ca să-i adaugi linii).
import { thruInfo, thruTiles, mainTiles, THRU_MIN, THRU_MAX, THRU_BASE, THRU_TRACK, ERR_TEXT } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';

const GOLD = '#ffd23f', GREEN = '#5bd66f', RED = '#ff5a6a', ORANGE = '#ff9f43';
export const THRU_TOOL = { id: 'thru', e: '🏙️', t: 'Gară mare de trecere', hint: 'Alege câte linii (2–10), apoi atinge o placă din oraș pe linia principală: gara ia locul caselor (le muți cu despăgubire) și acoperă tot orașul.' };

export function createThruTool(c) {
  const o = { n: 4 };
  let key = '';
  const S = () => c.S(), me = () => (S().companies[viewer.co] ? viewer.co : 0);
  const info = (t) => thruInfo(S(), me(), t.x, t.y, o.n);

  function paint(t) {
    if (!t) { c.ov().clear(); return; }
    const s = S(), r = info(t), st = r.st || s.stations.find((q) => q.x === t.x && q.y === t.y && q.thru);
    const dir = r.ok ? r.dir : st && st.thru ? st.dir : (s.track[t.y * s.w + t.x] & 0x11) ? 2 : 0;
    const gone = new Set(r.ok ? r.houses : []), out = [{ x: t.x, y: t.y, color: GOLD }];
    const inb = ([x, y]) => x >= 0 && y >= 0 && x < s.w && y < s.h;
    for (const [x, y] of [...thruTiles(t.x, t.y, dir, o.n), ...mainTiles(t.x, t.y, dir, o.n)].filter(inb)) out.push({ x, y, color: gone.has(y * s.w + x) ? ORANGE : r.ok ? GREEN : RED });
    c.ov().set(out);
    const k = `${t.x},${t.y},${o.n},${r.ok ? r.cost : r.err}`;
    if (k === key) return;
    key = k;
    if (r.ok) c.hud().hint(`🏙️ ${r.n} linii · ${lei(r.cost)}${r.houses.length ? ` · ${r.houses.length} case mutate (despăgubiri ${lei(r.pay)})` : ''}. Atinge ca să construiești.`, false, 3000);
    else c.hud().hint(r.err === 'exista' ? `Gara are deja ${st ? st.platforms : ''} linii: alege mai multe ca să o lărgești.` : ERR_TEXT[r.err] || 'Aici nu încape gara mare.', true, 3000);
  }
  function tap(t) {
    if (!t) return;
    const s = S(), st = s.stations.find((q) => q.x === t.x && q.y === t.y);
    const r = st && st.thru ? c.exec({ type: 'setThruTracks', id: st.id, n: o.n }) : c.exec({ type: 'buildThru', x: t.x, y: t.y, n: o.n });
    if (r.ok) c.hud().hint(st && st.thru ? `Gata: ${o.n} linii · ${lei(r.cost)}.` : `🏙️ Gară mare cu ${o.n} linii · ${lei(r.cost)}. Leagă linia principală prin placa gării, de-a lungul peroanelor.`, false, 6000);
    key = '';
    paint(t);
  }
  function bar() {
    const out = [];
    for (let n = THRU_MIN; n <= THRU_MAX; n++) out.push({ label: `${n} linii`, small: lei(THRU_BASE + n * THRU_TRACK) + '+', on: o.n === n, fn: () => { o.n = n; key = ''; c.bar(); } });
    return out;
  }
  return { o, paint, tap, bar, reset() { key = ''; } };
}
