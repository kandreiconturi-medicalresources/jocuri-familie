// Cer: dom cu gradient (albastru sus, auriu cald la orizont) care urmărește camera; noaptea se întunecă.
import { Mesh, SphereGeometry, MeshBasicMaterial, BackSide, Float32BufferAttribute, Color } from 'three';

const STOPS = [[-1, '#e8e6d2'], [0, '#e8e6d2'], [0.12, '#cfe6ee'], [0.45, '#8fc3ea'], [1, '#5a9fe0']].map(([k, c]) => [k, new Color(c)]);

export function createSky(scene, camera) {
  const geo = new SphereGeometry(300, 24, 16), pos = geo.attributes.position, col = [];
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 300;
    let k = 1; while (k < STOPS.length - 1 && STOPS[k][0] < h) k++;
    const a = STOPS[k - 1], b = STOPS[k];
    c.copy(a[1]).lerp(b[1], Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const mat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  scene.add(mesh);
  return {
    mesh,
    update(night, K) {
      mesh.position.copy(camera.position); mesh.scale.setScalar(K);
      mat.color.setRGB(1 - night * 0.7, 1 - night * 0.62, 1 - night * 0.38); // orizontul rămâne egal cu ceața (vezi stage.js)
    },
  };
}
