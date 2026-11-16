// Previzualizarea șinei: un singur mesh „fantomă” (balast + șine + traverse, semitransparent, panglică continuă) care se
// rescrie doar de la prima placă schimbată. Plus inele care pulsează (lipire magnetică) și iconițe pe porțiunile speciale.
import { BufferGeometry, BufferAttribute, DynamicDrawUsage, Mesh, MeshBasicMaterial, DoubleSide, Group, RingGeometry, Color, Vector3 } from 'three';

const MAXT = 1500, VB = 20, IB = 30;
const KIND_COL = ['#7be58a', '#4fa8ff', '#ffb347', '#b78cff', '#3fae5a', '#ffe066', '#ff4a5a'];
const RANK = [0, 4, 3, 5, 1, 2, 9];
const cols = KIND_COL.map((c) => new Color(c)), railC = new Color('#f4f6fa'), sleepC = new Color('#6b4a30'), redC = new Color('#ff5a6a');
const tmp = new Vector3();

export function createGhost(s, g, stage) {
  const pos = new BufferAttribute(new Float32Array(MAXT * VB * 3), 3).setUsage(DynamicDrawUsage);
  const col = new BufferAttribute(new Float32Array(MAXT * VB * 3), 3).setUsage(DynamicDrawUsage);
  const ib = new Uint32Array(MAXT * IB);
  for (let b = 0; b < MAXT; b++) for (let q = 0; q < 5; q++) { const v = b * VB + q * 4; ib.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], b * IB + q * 6); }
  const geo = new BufferGeometry();
  geo.setAttribute('position', pos); geo.setAttribute('color', col); geo.setIndex(new BufferAttribute(ib, 1)); geo.setDrawRange(0, 0);
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.68, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  const root = new Group(); root.add(mesh);

  const rings = [0, 1].map(() => {
    const m = new Mesh(new RingGeometry(0.34, 0.5, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide }));
    m.visible = false; m.renderOrder = 7; m.frustumCulled = false; root.add(m);
    return m;
  });
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:35;overflow:hidden;display:none';
  document.body.append(layer);
  const pool = [];
  let icons = [], prev = { tiles: [], kind: [], tint: false }, nSeg = 0;

  const P = new Float32Array(MAXT * 3); // centrele plăcilor, în lume
  function writeSeg(b, n, kind, tint) {
    const at = (k) => Math.max(0, Math.min(n - 1, k));
    const dir = (k) => { const a = at(k - 1), c = at(k + 1); const dx = P[c * 3] - P[a * 3], dz = P[c * 3 + 2] - P[a * 3 + 2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    const [d0x, d0z] = dir(b), [d1x, d1z] = dir(b + 1), x0 = P[b * 3], y0 = P[b * 3 + 1], z0 = P[b * 3 + 2], x1 = P[b * 3 + 3], y1 = P[b * 3 + 4], z1 = P[b * 3 + 5];
    const v = b * VB, a = pos.array, c = col.array;
    const put = (i, x, y, z, color) => { const o = (v + i) * 3; a[o] = x; a[o + 1] = y; a[o + 2] = z; c[o] = color.r; c[o + 1] = color.g; c[o + 2] = color.b; };
    const k0 = kind[b], k1 = kind[b + 1], kk = RANK[k1] > RANK[k0] ? k1 : k0, base = tint && kk === 0 ? redC : cols[kk];
    const strip = (i, off, hw, dy, color) => {
      put(i, x0 - d0z * (off - hw), y0 + dy, z0 + d0x * (off - hw), color); put(i + 1, x0 - d0z * (off + hw), y0 + dy, z0 + d0x * (off + hw), color);
      put(i + 2, x1 - d1z * (off - hw), y1 + dy, z1 + d1x * (off - hw), color); put(i + 3, x1 - d1z * (off + hw), y1 + dy, z1 + d1x * (off + hw), color);
    };
    strip(0, 0, 0.27, 0.16, base); strip(4, -0.1, 0.025, 0.19, railC); strip(8, 0.1, 0.025, 0.19, railC);
    for (let q = 0; q < 2; q++) {
      const u = q ? 0.72 : 0.28, cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u + 0.175, cz = z0 + (z1 - z0) * u, dx = d0x + (d1x - d0x) * u, dz = d0z + (d1z - d0z) * u, i = 12 + q * 4;
      put(i, cx - dx * 0.05 + dz * 0.24, cy, cz - dz * 0.05 - dx * 0.24, sleepC); put(i + 1, cx - dx * 0.05 - dz * 0.24, cy, cz - dz * 0.05 + dx * 0.24, sleepC);
      put(i + 2, cx + dx * 0.05 + dz * 0.24, cy, cz + dz * 0.05 - dx * 0.24, sleepC); put(i + 3, cx + dx * 0.05 - dz * 0.24, cy, cz + dz * 0.05 + dx * 0.24, sleepC);
    }
  }

  const api = {
    root,
    /** tiles [[x,y]], kind[] (felul fiecărei plăci), tint = prea scump (șina „normală” devine roșie). Rescrie doar de la prima placă schimbată. */
    set(tiles, kind, tint = false) {
      const n = Math.min(tiles.length, MAXT), p = prev;
      let from = 0;
      if (tint === p.tint) { const m = Math.min(n, p.tiles.length); while (from < m && tiles[from][0] === p.tiles[from][0] && tiles[from][1] === p.tiles[from][1] && kind[from] === p.kind[from]) from++; }
      if (from === n && n === p.tiles.length) return;
      for (let k = Math.max(0, from - 1); k < n; k++) { const t = tiles[k]; P[k * 3] = t[0] + 0.5; P[k * 3 + 1] = g.tileY(t[0], t[1]); P[k * 3 + 2] = t[1] + 0.5; }
      const seg = Math.max(0, n - 1), b0 = Math.max(0, from - 2);
      for (let b = b0; b < seg; b++) writeSeg(b, n, kind, tint);
      if (seg > b0) for (const at of [pos, col]) { at.clearUpdateRanges(); at.addUpdateRange(b0 * VB * 3, (seg - b0) * VB * 3); at.needsUpdate = true; }
      nSeg = seg; geo.setDrawRange(0, seg * IB);
      prev = { tiles: tiles.slice(0, n), kind: kind.slice(0, n), tint };
    },
    clear() { api.set([], [], false); icons = []; api.ring(0, null); api.ring(1, null); layer.style.display = 'none'; },
    /** Inel care pulsează pe o placă (i = 0 început, 1 sfârșit) sau null. */
    ring(i, t) { const m = rings[i]; m.visible = !!t; if (t) m.position.set(t.x + 0.5, g.tileY(t.x, t.y) + 0.22, t.y + 0.5); },
    /** Iconițe pe porțiuni speciale: [{x, y, icon, text}] (cel mult 10). */
    icons(list) {
      icons = list.slice(0, 10);
      while (pool.length < icons.length) { const e = document.createElement('div'); e.style.cssText = 'position:absolute;left:0;top:0;font-size:22px;line-height:1;text-shadow:0 1px 3px #000;will-change:transform'; layer.append(e); pool.push(e); }
      icons.forEach((it, i) => { pool[i].textContent = it.icon; pool[i].title = it.text; });
      pool.forEach((e, i) => { e.style.display = i < icons.length ? '' : 'none'; });
      layer.style.display = icons.length ? '' : 'none';
    },
    frame(t) {
      const pulse = 1 + 0.28 * Math.sin(t * 7);
      for (const m of rings) if (m.visible) m.scale.set(pulse, 1, pulse);
      if (!icons.length) return;
      icons.forEach((it, i) => {
        const v = tmp.set(it.x + 0.5, g.tileY(it.x, it.y) + 0.9, it.y + 0.5).project(stage.camera), e = pool[i];
        const vis = v.z > 0 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
        e.style.display = vis ? '' : 'none';
        if (vis) e.style.transform = `translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -100%)`;
      });
    },
    dispose() { layer.remove(); geo.dispose(); mat.dispose(); },
    get segments() { return nSeg; },
  };
  return api;
}
