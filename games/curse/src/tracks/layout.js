// Din jetoane (șir de caractere) → plasări de piese + linia centrală (puncte la ~2 m). Pur.
import { PIECES, TILE, DIRS } from './pieces.js';

const STEP = 2; // metri între punctele liniei centrale

/** Parcurge jetoanele pe grilă. Întoarce plasările, celulele ocupate și starea finală (pentru verificarea închiderii). */
export function walk(tokens) {
  let gx = 0, gz = 0, d = 0, y = 0;
  const placed = [], raw = [];
  let lineAt = 0; // indicele în `raw` al liniei de start
  for (const ch of tokens) {
    const P = PIECES[ch];
    if (!P) throw new Error('jeton necunoscut: ' + ch);
    const F = DIRS[d], R = DIRS[(d + 1) & 3];
    const ex = gx + 0.5 - F[0] * 0.5, ez = gz + 0.5 - F[1] * 0.5; // mijlocul muchiei de intrare
    const cells = P.cells.map(([r, f]) => [gx + r * R[0] + f * F[0], gz + r * R[1] + f * F[1]]);
    placed.push({
      ch, model: P.model, x: ex * TILE, z: ez * TILE, y: (y - (P.deck || 0)) * TILE, dir: d,
      mirror: !!P.mirror, flip: !!P.flip, level: P.level || 0, cells,
    });
    const top = P.pts[P.pts.length - 1][1] || 1;
    P.pts.forEach(([a, b], i) => {
      if (raw.length && i === 0) return; // punctul comun cu piesa anterioară
      const yy = P.deck ? y : y + P.dy * (b / top);
      raw.push({ x: (ex + a * R[0] + b * F[0]) * TILE, z: (ez + a * R[1] + b * F[1]) * TILE, y: yy * TILE });
      if (P.line !== undefined && i === P.line) lineAt = raw.length - 1;
    });
    gx += P.next[0] * R[0] + P.next[1] * F[0];
    gz += P.next[0] * R[1] + P.next[1] * F[1];
    d = (d + P.turn + 4) & 3;
    y += P.dy;
  }
  return { placed, raw, end: { gx, gz, d, y }, lineAt };
}

export const isClosed = (e) => e.gx === 0 && e.gz === 0 && e.d === 0 && Math.abs(e.y) < 1e-6;

/** Verifică suprapunerile: o celulă poate fi dublă doar dacă una e pod (nivel 1) și cealaltă e drum drept pe sol. */
export function overlaps(placed) {
  const at = new Map(), bad = [];
  placed.forEach((p, i) => p.cells.forEach(([x, z]) => {
    const k = x + ',' + z, o = at.get(k) || [];
    o.push(i); at.set(k, o);
  }));
  for (const [k, ids] of at) {
    if (ids.length === 1) continue;
    const lv = ids.map((i) => placed[i].level);
    const ok = ids.length === 2 && lv.includes(1) && ids.every((i) => placed[i].ch === 'b' || placed[i].ch === 's')
      && (placed[ids[0]].dir + placed[ids[1]].dir) % 2 === 1;
    if (!ok) bad.push(k);
  }
  return bad;
}

/** Reeșantionare pe lungime de arc, linie închisă, rotită ca indicele 0 = linia de start. */
export function resample(rawIn, lineAt) {
  let raw = rawIn;
  if (raw.length > 1 && Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].z - raw[raw.length - 1].z) < 1e-6) raw = raw.slice(0, -1);
  const n = raw.length, seg = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = raw[i], b = raw[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    seg.push(l); total += l;
  }
  const cnt = Math.max(8, Math.round(total / STEP)), ds = total / cnt;
  const at = (s) => {
    let i = 0;
    while (i < n - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const a = raw[i], b = raw[(i + 1) % n], t = seg[i] > 0 ? Math.min(1, s / seg[i]) : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t };
  };
  let off = 0;
  for (let i = 0; i < lineAt; i++) off += seg[i];
  const pts = [];
  for (let i = 0; i < cnt; i++) pts.push({ ...at((off + i * ds) % total), s: i * ds });
  return { pts, length: total, ds };
}
