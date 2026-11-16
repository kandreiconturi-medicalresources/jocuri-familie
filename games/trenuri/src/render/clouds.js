// Nori (calitate 2): umbre moi care trec peste sol (mereu) și nori albi sus, vizibili când camera e departe.
import { Group, InstancedMesh, PlaneGeometry, MeshBasicMaterial, Matrix4, Vector3, Quaternion } from 'three';
import { softTexture } from './texgen.js';

const N = 9, ALT = 26;
const m4 = new Matrix4(), v = new Vector3(), sc = new Vector3(), q = new Quaternion();
export function createClouds(s, g, camera) {
  const root = new Group(), tex = softTexture(), geo = new PlaneGeometry(1, 1), flat = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMat = new MeshBasicMaterial({ map: tex, color: 0x0c1a10, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const cloudMat = new MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const sh = new InstancedMesh(flat, shadowMat, N), cl = new InstancedMesh(geo, cloudMat, N * 3);
  for (const m of [sh, cl]) { m.frustumCulled = false; m.userData.cast = false; }
  sh.renderOrder = 2; cl.renderOrder = 7; sh.userData.cloud = true;
  root.add(sh, cl);
  const span = Math.max(s.w, s.h) + 40;
  const cs = Array.from({ length: N }, (_, i) => ({ x: ((i * 37) % span) - 20, z: ((i * 53 + 11) % span) - 20, w: 7 + (i % 4) * 2.4, sp: 0.5 + (i % 3) * 0.15 }));
  return {
    root,
    update(dt, night) {
      cloudMat.opacity = Math.max(0, Math.min(0.85, (camera.position.y - 16) / 16)) * (1 - 0.75 * night);
      shadowMat.opacity = 0.2 * (1 - 0.8 * night);
      let k = 0;
      cs.forEach((c, i) => {
        c.x += dt * c.sp; if (c.x > span - 20) c.x -= span;
        const sx = c.x + 23, sz = c.z - 18; // umbra cade în direcția opusă soarelui
        sh.setMatrixAt(i, m4.compose(v.set(sx, g.at(Math.max(0, Math.min(s.w, sx)), Math.max(0, Math.min(s.h, sz))) + 0.3, sz), q.identity(), sc.set(c.w * 1.4, 1, c.w)));
        for (let j = 0; j < 3; j++) cl.setMatrixAt(k++, m4.compose(v.set(c.x + (j - 1) * c.w * 0.45, ALT + (j === 1 ? 0.8 : 0), c.z + (j - 1) * c.w * 0.1), camera.quaternion, sc.set(c.w * (j === 1 ? 1.1 : 0.8), c.w * 0.5, 1)));
      });
      sh.instanceMatrix.needsUpdate = true; cl.instanceMatrix.needsUpdate = true;
    },
  };
}
