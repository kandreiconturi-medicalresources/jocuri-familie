// Evidențieri pe teren: plăci colorate (cursor, previzualizare traseu, raza gării, gara aleasă).
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, Matrix4, Color, Quaternion, Vector3, Euler } from 'three';

const MAX = 700;
export function createOverlay(s, g) {
  const geo = new PlaneGeometry(0.92, 0.92); geo.rotateX(-Math.PI / 2);
  const mesh = new InstancedMesh(geo, new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), MAX);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 5;
  const m4 = new Matrix4(), c = new Color(), q = new Quaternion().setFromEuler(new Euler(0, 0, 0)), one = new Vector3(1, 1, 1), v = new Vector3();
  return {
    mesh,
    /** tiles: [{x, y, color}] */
    set(tiles) {
      const n = Math.min(MAX, tiles.length);
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        m4.compose(v.set(t.x + 0.5, g.tileY(t.x, t.y) + 0.13, t.y + 0.5), q, one);
        mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c.set(t.color));
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    clear() { mesh.count = 0; },
  };
}
