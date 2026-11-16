// Peroane multiple (station.platforms 1–4): linii paralele cu peron între ele, de partea opusă clădirii; plus macazurile (plăci cu >2 legături).
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { DX, DY, T_PRESENT } from '../sim/consts.js';
import { Builder } from './geo.js';

const lam = new MeshLambertMaterial({ vertexColors: true }), STEP = 0.3;
const first = (t) => { for (let d = 0; d < 8; d++) if ((t >> d) & 1) return d; return 0; };
export const platformsOf = (st) => Math.max(1, Math.min(4, st.platforms | 0 || 1));

/** Direcția axei gării și partea clădirii (vector unitar în plan), la fel ca în createStations. */
export function stationFrame(s, st) {
  const d = first(s.track[st.y * s.w + st.x]), yaw = Math.atan2(DX[d], DY[d]) + Math.PI, l = Math.hypot(DX[d], DY[d]);
  return { yaw, ax: DX[d] / l, az: DY[d] / l, bx: Math.cos(yaw), bz: -Math.sin(yaw) };
}

export function createPlatforms(s, g) {
  const root = new Group(), B = new Builder();
  for (const st of s.stations) {
    const n = platformsOf(st);
    if (n < 2 || st.big) continue; // terminalul mare își desenează singur liniile (render/terminal.js)
    const f = stationFrame(s, st), y0 = g.tileY(st.x, st.y), cx = st.x + 0.5, cz = st.y + 0.5;
    for (let k = 1; k < n; k++) {
      const o = -k * STEP; // spre partea opusă clădirii
      const ox = cx + f.bx * o, oz = cz + f.bz * o;
      const line = (off) => [[ox + f.bx * off - f.ax * 0.5, y0, oz + f.bz * off - f.az * 0.5], [ox + f.bx * off + f.ax * 0.5, y0, oz + f.bz * off + f.az * 0.5]];
      B.ribbon(line(0), 0.1, -0.03, 0.03, '#9d9385', '#7d7468');
      for (const r of [-0.06, 0.06]) { const p = line(r); p.forEach((q) => { q[1] = y0 + 0.07; }); B.ribbon(p, 0.012, 0.0, 0.03, '#e9edf3', '#8d939b'); }
      // peron între această linie și cea dinainte
      const mx = cx + f.bx * (o + STEP / 2), mz = cz + f.bz * (o + STEP / 2);
      B.obox(mx, y0 + 0.05, mz, f.ax, f.az, 0.45, 0.045, 0.05, '#cfc7b8');
      B.obox(mx, y0 + 0.103, mz, f.ax, f.az, 0.45, 0.012, 0.004, '#f2c230');
    }
  }
  if (!B.empty) { const m = new Mesh(B.geometry(), lam); m.userData.cast = true; m.userData.recv = true; root.add(m); }
  return root;
}

/** Macazurile: o căsuță cu levier și un disc alb-roșu, în cel mai larg unghi liber din jurul plăcii. */
export function createSwitches(s, g) {
  const root = new Group(), B = new Builder();
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const t = s.track[y * s.w + x];
    if (!(t & T_PRESENT)) continue;
    const dirs = []; for (let d = 0; d < 8; d++) if ((t >> d) & 1) dirs.push(d);
    if (dirs.length < 3 || s.stations.some((q) => q.x === x && q.y === y)) continue;
    let best = 0, from = 0;
    dirs.forEach((d, i) => { const nx = dirs[(i + 1) % dirs.length], gap = (nx - d + 8) % 8; if (gap > best) { best = gap; from = d; } });
    const a = Math.atan2(DY[from], DX[from]) + best * Math.PI / 8, dx = Math.cos(a), dz = Math.sin(a), l = 1;
    const px = x + 0.5 + (dx / l) * 0.32, pz = y + 0.5 + (dz / l) * 0.32, y0 = g.tileY(x, y);
    B.obox(px, y0 + 0.07, pz, 0, 1, 0.01, 0.01, 0.07, '#444');
    B.obox(px, y0 + 0.16, pz, 1, 0, 0.002, 0.045, 0.045, '#fff');
    B.obox(px, y0 + 0.16, pz, 1, 0, 0.0025, 0.03, 0.03, '#d63a2a');
    B.obox(px - (dx / l) * 0.1, y0 + 0.04, pz - (dz / l) * 0.1, 0, 1, 0.05, 0.012, 0.02, '#e6b422'); // levierul spre șină
  }
  if (!B.empty) { const m = new Mesh(B.geometry(), lam); m.userData.cast = true; root.add(m); }
  return root;
}
