// Unelte 6.6: 🚦 semnal, ⛏️ nivelare/defrișare, 🕳️ tunel, ⬆️ peroane la gară. Totul trece prin ctx.exec(comandă).
import { levelPlan, maxPlatforms, platformsOf, upgradeCost, depotSpot, TUNNEL, DEPOT, PORT, BRIDGE, T_PRESENT, DX, DY, opp, bridgeInfo, bridgeCost, bridgeSteel, matMissing, missingText, parcelInfo } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { lei } from '../ui/hud.js';
import { THRU_TOOL, createThruTool } from './thruTool.js';
import { COR_TOOL, createCorridorTool } from './corridorTool.js';
import { createShapeTool } from './shapeTool.js';

const GOLD = '#ffd23f', GREEN = '#5bd66f', RED = '#ff5a6a', BLUE = '#8fd3ff';
export const EXTRA_TOOLS = [
  { id: 'shape', e: '🧩', t: 'Forme de șină', hint: 'Alege o formă (încrucișare, traversare, linie dublă, Y, ocolire) și atinge harta: o pun dintr-o dată, cu macazuri și semnale. R sau 🔄 o rotește.' },
  { id: 'signal', e: '🚦', t: 'Semnal', hint: 'Atinge o șină ca să pui un semnal. Trenul stă la roșu până se eliberează traseul din fața lui.' },
  { id: 'level', e: '⛏️', t: 'Nivelare', hint: 'Atinge două colțuri: nivelez terenul dintre ele sau tai pădurea.' },
  { id: 'tunnel', e: '🕳️', t: 'Tunel', hint: 'Atinge două plăci de aceeași înălțime, de o parte și de alta a dealului (cel mult 6 plăci între ele).' },
  { id: 'depot', e: '🏭', t: 'Depou', hint: 'Atinge capătul unei linii (o șină cu o singură legătură): acolo se repară trenurile și pleacă remorcile.' },
  { id: 'platform', e: '⬆️', t: 'Gară mai mare', hint: 'Atinge o gară ca să-i adaugi un peron: încap mai multe trenuri deodată.' },
  THRU_TOOL,
  COR_TOOL,
  { id: 'bridge', e: '🌉', t: 'Pod mare', hint: 'Atinge un capăt pe uscat, apoi capătul de pe țărmul celălalt: linie dreaptă sau diagonală, până la 30 de plăci de apă.' },
  { id: 'land', e: '🏠', t: 'Cumpără teren', island: true, hint: 'Atinge o parcelă (4×4 plăci) de pe insula altuia ca să o cumperi: apoi poți construi pe ea.' },
  { id: 'port', e: '⚓', t: 'Port', island: true, hint: 'Atinge o placă de pe coasta insulei tale, chiar lângă apă: acolo acostează vapoarele.' },
];

export function createExtraTools(c) {
  const o = { twoWay: false, erase: false, mode: 'level' };
  let a = null, hov = null;
  const shp = createShapeTool(c);
  const S = () => c.S(), ids = EXTRA_TOOLS.map((q) => q.id), thru = createThruTool(c), cor = createCorridorTool(c);
  const rect = (p, q) => ({ x0: p.x, y0: p.y, x1: q.x, y1: q.y });
  const tiles = (r, color) => { const m = []; for (let y = Math.min(r.y0, r.y1); y <= Math.max(r.y0, r.y1); y++) for (let x = Math.min(r.x0, r.x1); x <= Math.max(r.x0, r.x1); x++) m.push({ x, y, color }); return m; };

  /** Direcția de intrare a trenului după locul atins: latura șinei cea mai apropiată de deget. */
  function entryDir(t) {
    const tr = S().track[t.y * S().w + t.x], dx = (t.fx || t.x + 0.5) - (t.x + 0.5), dz = (t.fz || t.y + 0.5) - (t.y + 0.5);
    let best = -1, bd = -1e9;
    for (let d = 0; d < 8; d++) { if (!((tr >> d) & 1)) continue; const v = DX[d] * dx + DY[d] * dz; if (v > bd) { bd = v; best = d; } }
    return best < 0 ? -1 : opp(best);
  }
  function levelInfo(p) {
    if (!a) return null;
    const h = S().height[a.y * S().w + a.x];
    return o.mode === 'clear' ? { h, r: rect(a, p) } : { h, r: rect(a, p), plan: levelPlan(S(), rect(a, p), h, 0) };
  }
  function paint(id) {
    if (id === 'shape') return shp.paint();
    if (id === 'level' && a) c.ov().set(hov ? tiles(rect(a, hov), (o.mode === 'level' && !levelInfo(hov).plan.ok) ? RED : GREEN) : [{ x: a.x, y: a.y, color: GOLD }]);
    else if (id === 'tunnel' && a) c.ov().set([{ x: a.x, y: a.y, color: GOLD }]);
    else if (id === 'bridge' && a) bridgePreview();
    else if (id === 'depot') { const m = [], S0 = S(); for (let i = 0; i < S0.track.length; i++) if (depotSpot(S0, i)) m.push({ x: i % S0.w, y: (i / S0.w) | 0, color: GREEN }); for (const d of S0.depots) m.push({ x: d.x, y: d.y, color: GOLD }); c.ov().set(m); }
    else if (id === 'platform') c.ov().set(S().stations.map((st) => ({ x: st.x, y: st.y, color: platformsOf(st) < maxPlatforms(S(), st) ? GREEN : BLUE })));
    else if (id === 'signal') c.ov().set(S().signals.filter((g) => !g.auto).map((g) => ({ x: g.x, y: g.y, color: GOLD })));
    else c.ov().clear();
  }
  function tapLevel(t) {
    if (!a) { a = t; c.hud().hint(o.mode === 'clear' ? 'Acum atinge colțul opus: tai pădurea dintre ele.' : `Nivelez la înălțimea de aici (${S().height[t.y * S().w + t.x]}). Atinge colțul opus.`, false, 5000); return; }
    const r = rect(a, t);
    const res = c.exec(o.mode === 'clear' ? { type: 'clearArea', ...r } : { type: 'levelTerrain', ...r, h: S().height[a.y * S().w + a.x] });
    if (res.ok) c.hud().hint(`Gata! ${o.mode === 'clear' ? 'Pădurea e tăiată' : 'Terenul e nivelat'} · ${lei(res.cost)}.`, false, 4000);
    a = null; hov = null;
  }
  const me = () => S().companies[viewer.co] || S().companies[0];
  /** Plăcile liniei drepte de la `a` la `t` (doar [a] dacă nu e dreaptă sau diagonală). */
  function lineTiles(p, q) {
    const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y), n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
    if (n < 1 || n > 40 || (dx && dy && Math.abs(q.x - p.x) !== Math.abs(q.y - p.y))) return [[p.x, p.y]];
    return Array.from({ length: n + 1 }, (_, k) => [p.x + dx * k, p.y + dy * k]);
  }
  const bridgeCmd = (p, q) => ({ type: 'buildBridge', x0: p.x, y0: p.y, x1: q.x, y1: q.y });
  /** Previzualizarea podului: linia verde/roșie și, în mesaj, costul și materialele. */
  function bridgePreview() {
    const pts = hov ? lineTiles(a, hov) : [[a.x, a.y]], info = hov ? bridgeInfo(S(), me(), bridgeCmd(a, hov)) : null;
    c.ov().set(pts.map(([x, y], k) => ({ x, y, color: k === 0 ? GOLD : info && info.ok ? GREEN : RED })));
    if (!info) return;
    if (!info.ok) { c.hud().hint(info.err === 'apa' ? 'Prea lung: podul mare ține până la 30 de plăci de apă.' : info.err === 'pod' ? 'Podul merge în linie dreaptă sau în diagonală.' : 'Capetele podului trebuie să fie pe uscat, iar între ele doar apă.', true, 2500); return; }
    const miss = info.need ? matMissing(S(), me().id, info.need) : [];
    c.hud().hint(`🌉 Pod de ${info.n} plăci · ${lei(info.cost)}${info.need ? ` · oțel ${bridgeSteel(info.n)} t din port` : ''}${miss.length ? ' — ' + missingText(S(), me(), miss) : ''}`, miss.length > 0, 2500);
  }
  function tapBridge(t) {
    if (!a) { a = t; c.hud().hint('Bine! Atinge capătul de pe țărmul celălalt (linie dreaptă sau diagonală).', false, 5000); paint('bridge'); return; }
    const res = c.exec(bridgeCmd(a, t));
    if (res.ok) c.hud().hint(`🌉 Pod gata · ${lei(res.cost)}. Pune câte o gară la capete sau leagă-l cu șină.`, false, 6000);
    a = null; hov = null;
  }
  let lastParcel = '';
  function parcelPreview(t) {
    const px = t.x >> 2, py = t.y >> 2, info = parcelInfo(S(), me(), px, py), key = px + ',' + py;
    const tiles = [];
    for (let y = py * 4; y < py * 4 + 4 && y < S().h; y++) for (let x = px * 4; x < px * 4 + 4 && x < S().w; x++) tiles.push({ x, y, color: info.ok ? GREEN : info.err === 'exista' ? BLUE : RED });
    c.ov().set(tiles);
    if (key === lastParcel) return;
    lastParcel = key;
    c.hud().hint(info.ok ? `🏠 Parcelă de ${lei(info.price)} (banii merg la ${S().companies[info.seller].name}). Atinge ca s-o cumperi.` : info.err === 'exista' ? 'Parcela asta e deja a ta.' : info.err === 'ocupat' ? 'Pe parcela asta sunt gările altcuiva.' : 'Aici nu e nimic de cumpărat: marea sau o insulă liberă (acolo construiești gratis).', !info.ok && info.err !== 'exista', 3000);
  }
  function tapTunnel(t) {
    if (!a) { a = t; c.hud().hint('Bine! Atinge placa de pe partea cealaltă a dealului.', false, 5000); return; }
    const res = c.exec({ type: 'buildTunnel', x0: a.x, y0: a.y, x1: t.x, y1: t.y });
    if (res.ok) c.hud().hint(`Tunel gata · ${lei(res.cost)}. Leagă-l cu șină la capete.`, false, 5000);
    a = null;
  }
  return {
    ids, has: (id) => ids.includes(id), thru, cor,
    reset() { a = null; hov = null; lastParcel = ''; shp.reset(); thru.reset(); cor.reset(); },
    paint,
    hover(id, t) {
      if (id === 'shape') return shp.hover(t);
      if ((id === 'level' || id === 'bridge') && a && t) { hov = t; paint(id); } else if (id === 'land' && t) parcelPreview(t); else if (id === 'thru') thru.paint(t); else if (id === 'corridor') cor.paint(t);
    },
    tap(id, t) {
      if (!t) return;
      if (id === 'thru') { thru.tap(t); return; }
      if (id === 'corridor') { cor.tap(t); return; }
      if (id === 'shape') { shp.tap(t); return; }
      if (id === 'signal') {
        const i = t.y * S().w + t.x;
        if (!(S().track[i] & T_PRESENT)) { c.hud().hint('Atinge o șină.', true); return; }
        const r = o.erase ? c.exec({ type: 'removeSignal', x: t.x, y: t.y }) : c.exec({ type: 'placeSignal', x: t.x, y: t.y, dir: Math.max(0, entryDir(t)), twoWay: o.twoWay });
        if (r.ok) c.hud().hint(o.erase ? 'Semnalul a dispărut.' : '🚦 Semnal pus! Trenul stă la roșu până e liber traseul din fața lui.', false, 4000);
      } else if (id === 'depot') {
        const r = c.exec({ type: 'buildDepot', x: t.x, y: t.y });
        if (r.ok) c.hud().hint('🏭 Depou nou! Trimite trenurile uzate la reparat din panoul lor.', false, 5000);
        else if (r.err === 'drum') c.hud().hint('Depoul se pune la capătul unei linii: trage o ramură scurtă de la linia principală și atinge-i capătul.', true, 6000);
      } else if (id === 'port') {
        const r = c.exec({ type: 'buildPort', x: t.x, y: t.y });
        if (r.ok) c.hud().hint('⚓ Port nou! Adu marfă cu trenul în depozit, apoi cumpără un 🚢 vapor.', false, 6000);
      } else if (id === 'bridge') tapBridge(t);
      else if (id === 'land') {
        const r = c.exec({ type: 'buyLand', px: t.x >> 2, py: t.y >> 2 });
        if (r.ok) c.hud().hint(`🏠 Parcela e a ta (${lei(r.cost)}). Acum poți construi pe ea.`, false, 5000);
        lastParcel = '';
      } else if (id === 'level') tapLevel(t);
      else if (id === 'tunnel') tapTunnel(t);
      else if (id === 'platform') {
        const st = S().stations.find((q) => q.x === t.x && q.y === t.y);
        if (!st) { c.hud().hint('Atinge o gară (🚉).', true); return; }
        const r = c.exec({ type: 'upgradeStation', id: st.id });
        if (r.ok) c.hud().hint(`${st.name} are ${platformsOf(st)} peroane (cel mult ${maxPlatforms(S(), st)}).`, false, 4500);
        else if (r.err === 'limita') c.hud().hint(`Cel mult ${maxPlatforms(S(), st)} peroane aici: orașul sau producția din jur trebuie să crească.`, true, 5000);
        else if (platformsOf(st) < maxPlatforms(S(), st)) c.hud().hint(`Un peron nou costă ${lei(upgradeCost(st))}.`, true);
      }
      paint(id);
    },
    bar(id) {
      if (id === 'shape') return shp.bar();
      if (id === 'signal') {
        return [
          { label: '→ Un sens', on: !o.twoWay && !o.erase, fn: () => { o.twoWay = false; o.erase = false; c.bar(); } },
          { label: '↔ Ambele sensuri', on: o.twoWay && !o.erase, fn: () => { o.twoWay = true; o.erase = false; c.bar(); } },
          { label: '🧹 Șterge semnal', on: o.erase, fn: () => { o.erase = true; c.bar(); } },
          { label: c.S().autoBlock ? `🧱 Semnale automate pe linie lungă: la ${c.S().autoBlock} plăci ✅` : '🧱 Semnale automate pe linie lungă', small: c.S().autoBlock ? 'Atinge ca să le oprești' : 'Trenurile din același sens merg la un bloc distanță', fn: () => { c.exec({ type: 'setAutoBlock', n: c.S().autoBlock ? 0 : 6 }); c.bar(); } },
        ];
      }
      if (id === 'level') {
        return [
          { label: '⛏️ Nivelează', on: o.mode === 'level', fn: () => { o.mode = 'level'; a = null; c.bar(); paint(id); } },
          { label: '🌲 Taie pădurea', on: o.mode === 'clear', fn: () => { o.mode = 'clear'; a = null; c.bar(); paint(id); } },
        ];
      }
      if (id === 'thru') return thru.bar();
      if (id === 'corridor') return cor.bar();
      if (id === 'depot') return [{ label: '🏭 Depou', small: lei(DEPOT.cost), fn: () => {} }];
      if (id === 'port') return [{ label: '⚓ Port', small: lei(PORT.cost) + ' · depozit ' + PORT.cap + ' t', fn: () => {} }];
      if (id === 'bridge') return [{ label: '🌉 Pod mare', small: `≤ ${BRIDGE.max} plăci · ${lei(bridgeCost(10))} la 10 plăci`, fn: () => {} }];
      if (id === 'land') return [{ label: '🏠 Teren', small: 'preț = valoarea × 3', fn: () => {} }];
      if (id === 'tunnel') return [{ label: '🕳️ Tunel', small: `≤ ${TUNNEL.max} plăci · ${lei(TUNNEL.cost)}/placă`, fn: () => {} }];
      return [];
    },
  };
}
