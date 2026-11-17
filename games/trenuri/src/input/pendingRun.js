// Construcție în așteptare (7.8), partea lipită de joc: previzualizare (fantomă / plăci colorate), bara de confirmare, Enter / Esc / R, clic dreapta = anulează.
// Nu schimbă nimic în lume până la „Construiește”; la confirmare folosește aceleași unelte și comenzi ca înainte.
import { reduce, quote, isTwoPoint } from './pendingBuild.js';
import { createBuildBar } from '../ui/buildBar.js';
import { lei } from '../ui/hud.js';
import { STATION_RADIUS } from '../sim/consts.js';
import { viewer } from '../sim/viewer.js';

const GREEN = '#5bd66f', RED = '#ff5a6a', GOLD = '#ffd23f', BLUE = '#8fd3ff';
const NAME = { track: '🛤️ Șină', station: '🚉 Gară', terminal: '🏛️ Terminal mare', port: '⚓ Port', depot: '🏭 Depou', signal: '🚦 Semnal', bridge: '🌉 Pod mare', level: '⛏️ Nivelare', land: '🏠 Teren' };
const TOOL_OF = { port: 'port', depot: 'depot', level: 'level', signal: 'signal', land: 'land', bridge: 'bridge' };

/** env: { root, state(), view(), tools, hud, exec(cmd) } */
export function createPendingRun(env) {
  const bar = createBuildBar(env.root), { tools } = env;
  let st = null, q = null, key = '';
  const S = () => env.state();
  const ghost = () => { const v = env.view(); return v && v.ghost; };
  const overlay = () => { const v = env.view(); return v && v.overlay; };
  const stSize = () => (tools.state.size === 2 ? 1 : tools.state.size);

  function clearView() { const g = ghost(), o = overlay(); if (g) g.clear(); if (o) o.clear(); }
  function cancel() { if (!st) return false; st = null; q = null; key = ''; bar.hide(); clearView(); return true; }

  /** Plăcile colorate ale previzualizării (verde = merge, roșu = nu). */
  function tilesOf() {
    const col = q.ok ? GREEN : RED, a = st.a, s = S(), out = [];
    if (st.kind === 'level' && q.rect) { for (let y = Math.min(a.y, st.b.y); y <= Math.max(a.y, st.b.y); y++) for (let x = Math.min(a.x, st.b.x); x <= Math.max(a.x, st.b.x); x++) out.push({ x, y, color: col }); return out; }
    if (st.kind === 'bridge' && q.path) return q.path.map(([x, y], k) => ({ x, y, color: k === 0 ? GOLD : col }));
    if (st.kind === 'land') { const px = a.x >> 2, py = a.y >> 2; for (let y = py * 4; y < py * 4 + 4 && y < s.h; y++) for (let x = px * 4; x < px * 4 + 4 && x < s.w; x++) out.push({ x, y, color: col }); return out; }
    if (st.kind === 'station') { const r = STATION_RADIUS[stSize()]; for (let y = Math.max(0, a.y - r); y <= Math.min(s.h - 1, a.y + r); y++) for (let x = Math.max(0, a.x - r); x <= Math.min(s.w - 1, a.x + r); x++) out.push({ x, y, color: x === a.x && y === a.y ? col : BLUE }); return out; }
    return [{ x: a.x, y: a.y, color: col }];
  }

  function refresh() {
    if (!st) return;
    const k = st.kind + st.a.x + ',' + st.a.y + (st.b ? ':' + st.b.x + ',' + st.b.y : '') + '|' + tools.state.tdir + tools.state.size;
    if (k === key) return;
    key = k;
    q = quote(S(), viewer.co, st, { size: stSize(), tdir: tools.state.tdir });
    const g = ghost(), o = overlay();
    if (st.kind === 'track') {
      if (o) o.set(q.path ? [] : [{ x: st.a.x, y: st.a.y, color: GOLD }]);
      if (g) { if (q.path) g.set(q.path, q.path.map(() => 0), !q.ok); else g.clear(); }
    } else if (o) o.set(q.wait ? [{ x: st.a.x, y: st.a.y, color: GOLD }] : tilesOf());
    const two = isTwoPoint(st.kind), costTxt = q.cost ? lei(q.cost) : 'gratis';
    const info = q.wait ? 'Atinge sau mută mouse-ul unde se termină' : q.ok ? 'Verde = se poate · ' + costTxt : '⛔ ' + q.text + (q.cost ? ' · ' + costTxt : '');
    bar.show({
      title: NAME[st.kind] + (two ? ' · alege capătul' : ''), info, ok: q.ok,
      label: q.ok ? '✅ Construiește · ' + costTxt : q.wait ? '✅ Construiește' : '⛔ Nu se poate', onGo: confirm, onNo: cancel,
      onTurn: st.kind === 'terminal' ? turn : null,
    });
  }
  function turn() { if (st && st.kind === 'terminal') { tools.key({ key: 'r' }); key = ''; refresh(); } }

  function confirm() {
    if (!st || !q || !q.ok) return false;
    const { kind, a } = st, cmd = q.cmd;
    cancel();
    if (kind === 'track' || kind === 'level' || kind === 'bridge') {
      const r = env.exec(cmd);
      if (r.ok) env.hud.hint(kind === 'track' ? 'Șina e gata! Pune gări la capete.' : kind === 'bridge' ? '🌉 Pod gata! Pune câte o gară la capete sau leagă-l cu șină.' : 'Gata, terenul e nivelat.', false, 4000);
      return true;
    }
    if (kind === 'station' || kind === 'terminal') tools.choose({ tool: 'station', size: kind === 'terminal' ? 2 : stSize() });
    else tools.setTool(TOOL_OF[kind]);
    tools.tap(a);
    return true;
  }

  return {
    active: () => !!st, kind: () => (st ? st.kind : null),
    /** Pornește o construcție în așteptare la placa t (din meniul de clic dreapta sau din uneltele normale). */
    start(kind, t) {
      cancel();
      st = reduce(null, { type: 'start', kind, a: { x: t.x, y: t.y, fx: t.fx, fz: t.fz } });
      if (!st) return false;
      if (kind === 'station' || kind === 'terminal') tools.choose({ tool: 'station', size: kind === 'terminal' ? 2 : stSize() });
      refresh();
      return true;
    },
    cancel, confirm,
    hover(t) { if (!st || !t || !isTwoPoint(st.kind)) return; const n = reduce(st, { type: 'hover', b: { x: t.x, y: t.y } }); if (n !== st) { st = n; refresh(); } },
    tap(t) { if (!st || !t || !isTwoPoint(st.kind)) return; st = reduce(st, { type: 'tap', b: { x: t.x, y: t.y } }); refresh(); },
    /** Enter confirmă, Esc anulează, R rotește terminalul. true = consumat. */
    key(e) {
      if (!st) return false;
      if (e.key === 'Enter') { confirm(); return true; }
      if (e.key === 'Escape') { cancel(); return true; }
      if ((e.key === 'r' || e.key === 'R') && st.kind === 'terminal') { turn(); return true; }
      return false;
    },
  };
}
