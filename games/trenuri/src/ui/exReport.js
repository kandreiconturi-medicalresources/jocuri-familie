// Raportul anual (modul expert): venituri, costuri, profit pe tren și pe marfă, cu grafice simple Canvas 2D.
import { h } from '../../../../shared/ui/dom.js';
import { GOODS } from '../sim/goods.js';
import { lei } from './hud.js';
import { trow } from './exTip.js';

const INK = '#3a1a6a', GREEN = '#43b85a', RED = '#e0485a', GOLD = '#ffb81c';
const W = 360;

function canvas(hh) {
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const cv = h('canvas', { class: 'chart', width: W * dpr, height: hh * dpr, style: { width: '100%', maxWidth: W + 'px', aspectRatio: `${W} / ${hh}` } });
  const g = cv.getContext('2d');
  g.scale(dpr, dpr); g.font = '700 11px sans-serif'; g.textBaseline = 'middle';
  return { cv, g };
}
const short = (n) => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1) + 'k' : String(n));

/** Coloane pe ani: venit (verde), cost (roșu), profit (galben). `years` = [{ y, inc, cost, profit, now? }]. */
export function drawYears(years) {
  const H = 150, { cv, g } = canvas(H), top = 12, base = H - 22;
  const max = Math.max(1000, ...years.map((y) => Math.max(y.inc, y.cost, Math.abs(y.profit))));
  g.fillStyle = '#f6f0ff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#cdbbee'; g.beginPath(); g.moveTo(0, base); g.lineTo(W, base); g.stroke();
  const gw = W / Math.max(1, years.length), bw = Math.min(22, gw / 4);
  years.forEach((y, i) => {
    const cx = gw * i + gw / 2;
    [[y.inc, GREEN], [y.cost, RED], [y.profit, GOLD]].forEach(([v, col], k) => {
      const hh = Math.round((Math.abs(v) / max) * (base - top));
      g.fillStyle = col; g.fillRect(cx + (k - 1.5) * (bw + 2), v >= 0 ? base - hh : base, bw, Math.max(1, hh));
    });
    g.fillStyle = INK; g.textAlign = 'center'; g.fillText(String(y.y) + (y.now ? '*' : ''), cx, H - 8);
  });
  return cv;
}

/** Bare orizontale: [{ label, value, color }]; valorile negative sunt roșii. */
export function drawBars(items, color) {
  const rowH = 20, H = Math.max(40, items.length * rowH + 8), { cv, g } = canvas(H);
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  g.fillStyle = '#f6f0ff'; g.fillRect(0, 0, W, H);
  items.forEach((it, i) => {
    const y = 4 + i * rowH, len = Math.round((Math.abs(it.value) / max) * (W - 190));
    g.fillStyle = INK; g.textAlign = 'left'; g.fillText(it.label, 6, y + 9);
    g.fillStyle = it.value < 0 ? RED : it.color || color; g.fillRect(110, y + 2, Math.max(2, len), 14);
    g.fillStyle = INK; g.fillText(short(it.value), 114 + len, y + 9);
  });
  return cv;
}

export function reportView(ctx, pick, setPick) {
  const { s, co, tip } = ctx, r = co.rep;
  const cur = { y: s.date.y, now: true, inc: r.inc, cost: r.mt + r.int, profit: r.inc - r.mt - r.int, g: r.g, tr: s.trains.filter((t) => t.owner === co.id).map((t) => [t.id, (t.yi | 0) - (t.ym | 0)]) };
  const all = [...r.y, cur], sel = all.find((y) => y.y === pick) || cur;
  const trains = sel.tr.slice().sort((a, b) => b[1] - a[1]);
  const goods = sel.g.map((v, g) => ({ label: GOODS[g].icon + ' ' + GOODS[g].name, value: v, color: GOODS[g].color })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 7);
  const tr6 = [...trains.slice(0, 4), ...trains.slice(Math.max(4, trains.length - 2))].map(([id, v]) => ({ label: '🚂 Trenul ' + id, value: v }));
  return [
    h('div', { class: 'chips' }, all.map((y) => h('button', { class: 'opt' + (y === sel ? ' on' : ''), onclick: () => setPick(y.y) }, y.now ? `${y.y} (în curs)` : String(y.y)))),
    trow(tip, '📥 Venituri', 'Banii încasați din transport în anul ăsta.', lei(sel.inc)),
    trow(tip, '📤 Costuri', 'Întreținere (șine, gări, trenuri) plus dobânzi.', lei(sel.cost)),
    trow(tip, '📊 Profit', 'Venituri minus costuri. Dacă e pozitiv, compania câștigă.', lei(sel.profit)),
    h('div', null, h('b', null, 'Pe ani'), ' ', tip('Verde = venituri, roșu = costuri, galben = profit. Steluța marchează anul în curs.')),
    drawYears(all.slice(-6)),
    h('div', null, h('b', null, 'Profit pe tren'), ' ', tip('Venitul trenului minus întreținerea lui. Trenurile cu roșu te costă: vinde-le sau schimbă-le ruta.')),
    tr6.length ? drawBars(tr6, GREEN) : h('div', null, 'Încă nu ai trenuri.'),
    h('div', null, h('b', null, 'Venit pe marfă')),
    goods.length ? drawBars(goods) : h('div', null, 'Nicio marfă livrată încă.'),
  ];
}
