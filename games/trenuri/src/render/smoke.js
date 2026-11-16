// Fum de abur: pâlcuri moi (billboard) cu fade, creștere și derivă; un singur InstancedMesh, alfa pe instanță prin atribut.
import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, InstancedBufferAttribute, Matrix4, Vector3, Color } from 'three';
import { softTexture } from './texgen.js';

const m4 = new Matrix4(), v = new Vector3(), sc = new Vector3(), c = new Color(), DARK = new Color('#58585a'), LIGHT = new Color('#e8e8ea');

export function createSmoke(camera, max) {
  const geo = new PlaneGeometry(1, 1), alpha = new InstancedBufferAttribute(new Float32Array(max), 1);
  geo.setAttribute('aAlpha', alpha);
  const mat = new MeshBasicMaterial({ map: softTexture(), transparent: true, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aAlpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a *= vA;');
  };
  const mesh = new InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 6; mesh.setColorAt(0, c.set(0xffffff));
  const p = { x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max), age: new Float32Array(max).fill(2), vx: new Float32Array(max), size: new Float32Array(max) };
  let head = 0;
  return {
    mesh,
    emit(x, y, z, k = 1) {
      const i = head; head = (head + 1) % max;
      p.x[i] = x + (Math.random() - 0.5) * 0.04; p.y[i] = y; p.z[i] = z + (Math.random() - 0.5) * 0.04; p.age[i] = 0; p.vx[i] = 0.1 + Math.random() * 0.08; p.size[i] = (0.14 + Math.random() * 0.08) * k;
    },
    update(dt) {
      let n = 0;
      for (let i = 0; i < max; i++) {
        const a = (p.age[i] += dt / 2.4);
        if (a >= 1) continue;
        p.y[i] += dt * (0.34 - 0.18 * a); p.x[i] += dt * p.vx[i]; p.z[i] += dt * 0.03;
        const size = p.size[i] * (1 + a * 3.4);
        m4.compose(v.set(p.x[i], p.y[i], p.z[i]), camera.quaternion, sc.set(size, size, size));
        mesh.setMatrixAt(n, m4);
        mesh.setColorAt(n, c.copy(DARK).lerp(LIGHT, Math.min(1, a * 2.2)));
        alpha.array[n] = 0.78 * Math.pow(1 - a, 1.4) * Math.min(1, a * 10);
        n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; alpha.needsUpdate = true;
    },
  };
}
