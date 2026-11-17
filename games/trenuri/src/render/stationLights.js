// Luminile de noapte ale gărilor (ieftine, fără lumini reale): capete de felinar strălucitoare (puncte aditive),
// pete calde de lumină pe peron (plăci aditive orizontale, instanțiate) și ferestre luminate (patrulatere aditive).
// Totul pornește din felinarele și ferestrele adunate la desenarea gărilor; intensitatea urmează noaptea din stage.js.
import { Group, Mesh, InstancedMesh, PlaneGeometry, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Points, PointsMaterial, AdditiveBlending, Matrix4 } from 'three';
import { softTexture } from './texgen.js';

let tex = null;
const mats = () => {
  if (!tex) tex = softTexture(64);
  return {
    head: new PointsMaterial({ map: tex, color: 0xffe2a0, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }),
    pool: new MeshBasicMaterial({ map: tex, color: 0xffc56a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    win: new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  };
};
const MAX_POOLS = 1500;

/** lamps: [[x, y, z]] (capul felinarului, în lume); wins: [[p0, p1, p2, p3]] (ferestre, în lume). */
export function createStationLights(lamps, wins) {
  const root = new Group(), M = mats(), parts = [];
  if (lamps.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(lamps.flat(), 3));
    const pts = new Points(g, M.head); pts.renderOrder = 6; pts.frustumCulled = false; parts.push(pts);
    const n = Math.min(MAX_POOLS, lamps.length), pg = new PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2);
    const pools = new InstancedMesh(pg, M.pool, n), m = new Matrix4();
    for (let i = 0; i < n; i++) { const [x, y, z] = lamps[i]; pools.setMatrixAt(i, m.makeTranslation(x, y - 0.27, z)); }
    pools.renderOrder = 5; pools.frustumCulled = false; parts.push(pools);
  }
  if (wins.length) {
    const p = [];
    for (const [a, b, c, d] of wins) p.push(...a, ...b, ...c, ...a, ...c, ...d);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3));
    const mw = new Mesh(g, M.win); mw.renderOrder = 5; mw.frustumCulled = false; M.win.side = 2; parts.push(mw);
  }
  if (parts.length) root.add(...parts);
  let last = -1;
  return {
    root,
    /** night: 0 (zi) … 0.62 (noapte adâncă). */
    update(night) {
      const k = Math.min(1, Math.max(0, (night - 0.08) * 2.2));
      if (Math.abs(k - last) < 0.01) return;
      last = k;
      root.visible = k > 0.01;
      M.head.opacity = k; M.pool.opacity = 0.6 * k; M.win.opacity = 0.8 * k;
    },
    dispose() { for (const o of parts) o.geometry.dispose(); for (const m of Object.values(M)) m.dispose(); },
  };
}
