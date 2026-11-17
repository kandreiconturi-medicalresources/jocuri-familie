// Gări normale: linii paralele cu peroane insulă între ele (de partea opusă clădirii), copertine, bănci, felinare, ceasuri, intrări în pasaj; plus macazurile (plăci cu >2 legături).
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { DX, DY, T_PRESENT } from '../sim/consts.js';
import { Builder } from './geo.js';
import { platformsOf, stationFrame, STEP, EXT, halfLen, topOf } from './stationLayout.js';
import { bench, lamp, clock, stairs, canopy } from './stationProps.js';

export { platformsOf, stationFrame };
const lam = new MeshLambertMaterial({ vertexColors: true });

/** Linie suplimentară (decor) la distanța v de axă, cu pat de balast, șine și opritoare la capete. */
function extraTrack(B, W, y0, hl, v) {
  const P = (u, dv, y) => { const [x, z] = W(u, v + dv); return [x, y, z]; };
  B.ribbon([P(-hl, 0, y0), P(hl, 0, y0)], 0.12, -0.03, 0.03, '#9d9385', '#7d7468');
  for (const r of [-0.06, 0.06]) B.ribbon([P(-hl, r, y0 + 0.07), P(hl, r, y0 + 0.07)], 0.012, 0, 0.03, '#e9edf3', '#8d939b');
}

export function createPlatforms(s, g, colorOf = () => '#c04040') {
  const root = new Group(), B = new Builder();
  for (const st of s.stations) {
    if (st.big || st.port) continue; // terminalul mare își desenează singur liniile (render/terminal.js)
    const n = platformsOf(st), f = stationFrame(s, st), y0 = g.tileY(st.x, st.y), cx = st.x + 0.5, cz = st.y + 0.5;
    const W = (u, v) => [cx + f.ax * u + f.bx * v, cz + f.az * u + f.bz * v], hb = halfLen(st), hl = hb + EXT, top = topOf(st), own = colorOf(st.owner);
    const at = (u, v, h = 0) => { const [x, z] = W(u, v); return [x, y0 + top + h, z]; };
    const edge = (v) => { const [x, z] = W(0, v); B.obox(x, y0 + top + 0.001, z, f.ax, f.az, hl, 0.008, 0.0025, '#f2c230'); };
    for (const e of [-1, 1]) { const [x, z] = W(e * (hb + EXT / 2), 0.25); B.obox(x, y0 + (top - 0.1) / 2, z, f.ax, f.az, EXT / 2, 0.12, (top + 0.1) / 2, '#cfc7b8'); } // prelungirea peronului clădirii
    edge(0.135); // marginea peronului clădirii, spre linie
    if (st.size >= 1) { // ușă, ceas pe fațadă, copertină la intrare
      const [dx, dz] = W(0, 0.386), [kx, kz] = W(-0.2 * hb, 0.386);
      B.obox(dx, y0 + 0.08 + 0.055, dz, f.ax, f.az, 0.04, 0.004, 0.055, '#5a3a22');
      B.obox(dx, y0 + 0.08 + 0.12, dz, f.ax, f.az, 0.06, 0.012, 0.005, own);
      B.obox(kx, y0 + 0.27, kz, f.ax, f.az, 0.04, 0.004, 0.04, '#3a3f46'); B.obox(kx, y0 + 0.27, kz, f.ax, f.az, 0.032, 0.006, 0.032, '#f6f3ea');
    }
    const bn = st.size >= 1 ? 2 : 1;
    for (let i = 0; i < bn; i++) { const [x, z] = at((i ? 1 : -1) * hb * 0.5, 0.215); bench(B, x, y0 + top, z, f.ax, f.az); }
    for (const e of [-1, 1]) { const [x, z] = at(e * hb * 0.82, 0.15); lamp(B, x, y0 + top, z); }
    if (st.size >= 1) { const [x, z] = at(hb * 0.18, 0.15); clock(B, x, y0 + top, z, f.ax, f.az); }
    for (let k = 1; k < n; k++) {
      const v = -(k - 0.5) * STEP, [mx, mz] = W(0, v);
      extraTrack(B, W, y0, hl + 0.1, -k * STEP);
      for (const e of [-1, 1]) { const [x, z] = W(e * (hl + 0.09), -k * STEP); B.obox(x, y0 + 0.1, z, f.ax, f.az, 0.008, 0.09, 0.03, '#d63a2a'); } // opritoare
      B.obox(mx, y0 + (top - 0.1) / 2, mz, f.ax, f.az, hl, STEP / 2 - 0.13, (top + 0.1) / 2, '#cfc7b8'); // peron insulă
      for (const e of [-1, 1]) { const [x, z] = W(0, v + e * (STEP / 2 - 0.135)); B.obox(x, y0 + top + 0.001, z, f.ax, f.az, hl, 0.008, 0.0025, '#f2c230'); }
      const [sx, sz] = W(hl - 0.13, v); stairs(B, sx, y0 + top, sz, f.ax, f.az);
      const [qx, qz] = at(-hl * 0.15, v); canopy(B, qx, y0 + top, qz, f.ax, f.az, hl * 0.7, 0.16, 0.2, '#c9d3de', own);
      const [bx, bz] = at(hl * 0.3, v); bench(B, bx, y0 + top, bz, f.ax, f.az);
      const [lx, lz] = at(-hl * 0.8, v + 0.05); lamp(B, lx, y0 + top, lz);
      const [kx, kz] = at(-hl * 0.5, v); clock(B, kx, y0 + top, kz, f.ax, f.az);
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
