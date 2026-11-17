// Șine proprii: pat de balast, traverse de lemn, două șine lucioase, curbe netede (Bézier prin placă), poduri cu piloni.
// Fiecare placă desenează „spițele” spre mijlocul muchiilor conectate (cele 8 direcții); o placă cu exact două
// legături în unghi devine o curbă. Ramificațiile și șinele paralele ies natural, fiindcă totul vine din biții plăcii.
import { Group, Mesh, MeshLambertMaterial, MeshPhongMaterial } from 'three';
import { DX, DY, T_BRIDGE, T_BIGBR, T_PRESENT } from '../sim/consts.js';
import { Builder } from './geo.js';
import { SEA_BED } from './ground.js';

const STEEL = '#8d99a6', STEEL_DARK = '#5d6874', CONCRETE = '#b9b5ab', CONCRETE_DARK = '#8f8b81';
const CH = 32, SLEEPER = '#6e4a2e', BALLAST = '#9d9385', BALLAST_SIDE = '#7d7468', WOOD = '#a98457', WOOD_DARK = '#7b5a37';
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Polilinii (în coordonate de lume) pentru placa (x,y): spițe sau o curbă. Gol dacă nu e șină. */
export function tilePolys(s, g, x, y, N = 6) {
  const t = s.track[y * s.w + x];
  if (!(t & T_PRESENT)) return [];
  const dirs = [];
  for (let d = 0; d < 8; d++) if ((t >> d) & 1) dirs.push(d);
  const yc = g.tileY(x, y), C = [x + 0.5, yc, y + 0.5];
  const mid = (d) => {
    const nx = x + DX[d], ny = y + DY[d], inb = nx >= 0 && ny >= 0 && nx < s.w && ny < s.h;
    return [x + 0.5 + DX[d] / 2, inb ? (yc + g.tileY(nx, ny)) / 2 : yc, y + 0.5 + DY[d] / 2];
  };
  if (dirs.length === 2 && dirs[1] - dirs[0] !== 4) {
    const A = mid(dirs[0]), B = mid(dirs[1]), pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push(lerp3(lerp3(A, C, u), lerp3(C, B, u), u)); }
    return [pts];
  }
  return dirs.map((d) => [C, mid(d)]);
}

function lengthOf(pts) { let l = 0; for (let i = 0; i + 1 < pts.length; i++) l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]); return l; }
function along(pts, dist) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (dist <= l || i + 2 === pts.length) { const u = Math.min(1, dist / (l || 1)); return [lerp3(a, b, u), (b[0] - a[0]) / (l || 1), (b[2] - a[2]) / (l || 1)]; }
    dist -= l;
  }
  return [pts[0], 0, 1];
}

/** Pod mare (7.3): două grinzi laterale (tălpi și montanți) și, din trei în trei plăci, un pilon de beton până la fundul apei. */
function bigBridge(B, s, g, x, y) {
  const d0 = s.track[y * s.w + x] & 0xff, dir = [...Array(8).keys()].find((d) => (d0 >> d) & 1), l = Math.hypot(DX[dir], DY[dir]);
  const tx = DX[dir] / l, tz = DY[dir] / l, cx = x + 0.5, cz = y + 0.5, top = g.tileY(x, y) - 0.07, bot = SEA_BED - 0.06, half = dir & 1 ? 0.707 : 0.5;
  for (const o of [-0.24, 0.24]) {
    const px = cx - tz * o, pz = cz + tx * o;
    B.obox(px, top + 0.3, pz, tx, tz, half, 0.026, 0.026, STEEL); // talpa de sus
    B.obox(px, top + 0.02, pz, tx, tz, half, 0.02, 0.02, STEEL_DARK); // talpa de jos
    B.obox(px, top + 0.16, pz, tx, tz, 0.022, 0.022, 0.14, STEEL); // montant
    B.obox(px, top + 0.16, pz, tx, tz, half, 0.012, 0.012, STEEL); // balustradă de la mijloc
  }
  B.obox(cx, top - 0.015, cz, tx, tz, half, 0.27, 0.02, STEEL_DARK); // tablier
  if ((x + y) % 3 === 0) { // pilon de beton cu capitel
    B.obox(cx, (top + bot) / 2, cz, tx, tz, 0.09, 0.2, (top - bot) / 2, CONCRETE);
    B.obox(cx, top - 0.05, cz, tx, tz, 0.13, 0.3, 0.03, CONCRETE_DARK);
  }
}

function addTile(B, R, s, g, x, y, q) {
  const polys = tilePolys(s, g, x, y, q ? 6 : 3), bridge = s.track[y * s.w + x] & T_BRIDGE;
  const spacing = q ? 0.17 : 0.26;
  for (const pts of polys) {
    if (bridge) B.ribbon(pts, 0.25, -0.08, 0.034, WOOD, WOOD_DARK);
    else B.ribbon(pts, 0.19, -0.05, 0.03, BALLAST, BALLAST_SIDE, 0, 0.14);
    const len = lengthOf(pts), n = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i < n; i++) {
      const [p, tx, tz] = along(pts, ((i + 0.5) / n) * len);
      B.obox(p[0], p[1] + 0.044, p[2], tx, tz, 0.034, 0.17, 0.013, SLEEPER);
    }
    for (const o of [-0.085, 0.085]) R.ribbon(pts, 0.014, 0.05, 0.095, '#e9edf3', '#8d939b', o);
    if (bridge) for (const o of [-0.235, 0.235]) { B.ribbon(pts, 0.011, 0.03, 0.13, '#caa66e', WOOD_DARK, o); }
  }
  if (bridge && polys.length && (s.track[y * s.w + x] & T_BIGBR)) { bigBridge(B, s, g, x, y); return; }
  if (bridge && polys.length) { // piloni: doi pe lățimea podului, sub placă, până la fundul apei
    const yc = g.tileY(x, y), d0 = (s.track[y * s.w + x] & 0xff), dir = [...Array(8).keys()].find((d) => (d0 >> d) & 1), l = Math.hypot(DX[dir], DY[dir]);
    const tx = DX[dir] / l, tz = DY[dir] / l, top = yc - 0.07, bot = SEA_BED - 0.06;
    for (const o of [-0.17, 0.17]) B.obox(x + 0.5 - tz * o, (top + bot) / 2, y + 0.5 + tx * o, tx, tz, 0.045, 0.045, (top - bot) / 2, WOOD_DARK);
    B.obox(x + 0.5, top - 0.015, y + 0.5, tx, tz, 0.05, 0.25, 0.02, WOOD);
  }
}

export function createTrack(s, g, q) {
  const root = new Group(), cells = new Map();
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!(s.track[y * s.w + x] & T_PRESENT)) continue;
    const k = ((x / CH) | 0) + ((y / CH) | 0) * 1000;
    let c = cells.get(k);
    if (!c) cells.set(k, c = [new Builder(), new Builder()]);
    addTile(c[0], c[1], s, g, x, y, q >= 1);
  }
  const mb = new MeshLambertMaterial({ vertexColors: true });
  const mr = q >= 1 ? new MeshPhongMaterial({ vertexColors: true, shininess: 110, specular: 0xaab0b8 }) : new MeshLambertMaterial({ vertexColors: true });
  for (const [B, R] of cells.values()) {
    for (const [b, m] of [[B, mb], [R, mr]]) {
      const mesh = new Mesh(b.geometry(), m);
      mesh.userData.recv = true; mesh.userData.cast = m === mb; mesh.receiveShadow = q >= 1; mesh.castShadow = q >= 1 && m === mb;
      root.add(mesh);
    }
  }
  return root;
}
