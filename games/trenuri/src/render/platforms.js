// Gări normale: peronul clădirii, lung cât plăcile drepte vecine, cu copertine, bănci, felinare, ceasuri; linii suplimentare cu peroane insulă și pasarelă (stationExtras.js); plus macazurile.
import { Group, Mesh, MeshLambertMaterial } from 'three';
import { DX, DY, T_PRESENT } from '../sim/consts.js';
import { Builder } from './geo.js';
import { platformsOf, stationFrame, topOf } from './stationLayout.js';
import { planOf } from './stationPlan.js';
import { bench, lamp, clock, canopy, lampSink } from './stationProps.js';
import { extras } from './stationExtras.js';

export { platformsOf, stationFrame };
const lam = new MeshLambertMaterial({ vertexColors: true });
const CONC = '#cfc7b8';

export function createPlatforms(s, g, colorOf = () => '#c04040') {
  const root = new Group(), B = new Builder(), lamps = [];
  lampSink.list = lamps; // felinarele (în lume) pentru luminile de noapte
  for (const st of s.stations) {
    if (st.big || st.thru || st.port || !(s.track[st.y * s.w + st.x] & T_PRESENT)) continue; // terminalul mare își desenează singur liniile (render/terminal.js)
    const P = planOf(s, st), y0 = g.tileY(st.x, st.y), top = topOf(st), own = colorOf(st.owner), { ax, az, bx, bz } = P;
    const W = (u, v) => [P.ox + ax * u + bx * v, P.oz + az * u + bz * v], c = { P, W, ax, az, bx, bz, top };
    const yAt = (u) => { const pc = P.pieces.find((q) => q.i === Math.round(u / P.l)); return pc ? g.tileY(pc.x, pc.y) : y0; };
    const at = (u, v) => { const [x, z] = W(u, v); return [x, yAt(u) + top, z]; };
    for (const pc of P.pieces) { // peronul clădirii, pe plăcile drepte, câte o bucată pe placă (urmărește treptele terenului)
      const yy = g.tileY(pc.x, pc.y), [mx, mz] = W(pc.i * P.l, 0.255), [ex, ez] = W(pc.i * P.l, 0.135);
      B.obox(mx, yy + (top - 0.1) / 2, mz, ax, az, P.l / 2, 0.12, (top + 0.1) / 2, CONC);
      B.obox(ex, yy + top + 0.001, ez, ax, az, P.l / 2, 0.008, 0.0025, '#f2c230');
    }
    if (st.size >= 1) { // ușă, ceas pe fațadă, copertină la intrare
      const fv = P.compact ? 0.3 : 0.386, [dx, dz] = W(0, fv), [kx, kz] = W(-0.2, fv);
      B.obox(dx, y0 + 0.08 + 0.055, dz, ax, az, 0.04, 0.004, 0.055, '#5a3a22');
      B.obox(dx, y0 + 0.08 + 0.12, dz, ax, az, 0.06, 0.012, 0.005, own);
      B.obox(kx, y0 + 0.27, kz, ax, az, 0.04, 0.004, 0.04, '#3a3f46'); B.obox(kx, y0 + 0.27, kz, ax, az, 0.032, 0.006, 0.032, '#f6f3ea');
    }
    for (const e of [-1, 1]) { // de la clădire spre capete: copertină, bănci, felinare
      const end = e > 0 ? P.uP : -P.uN, a = 0.58, b = end - 0.2;
      for (let u = a + 0.15; u + 0.7 < b; u += 1.5) { const [qx, qy, qz] = at(e * (u + 0.35), 0.3); canopy(B, qx, qy, qz, ax, az, 0.35, 0.075, 0.27, '#c9d3de', own); } // adăposturi scurte (lasă trenul la vedere)
      for (let u = 0.8; u < end - 0.25; u += 1.15) {
        const [lx, ly, lz] = at(e * u, 0.34); lamp(B, lx, ly, lz);
        const [x, y, z] = at(e * (u + 0.5), 0.33); bench(B, x, y, z, ax, az);
      }
    }
    if (st.size >= 1) { const [x, y, z] = at(0.5, 0.15); clock(B, x, y, z, ax, az); }
    extras(B, c, y0, own);
  }
  lampSink.list = null;
  root.userData.lamps = lamps;
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
