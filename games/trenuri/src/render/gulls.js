// Câțiva pescăruși care zboară în cerc deasupra apei, doar la calitatea 2 (7.7). Șase forme mici cu aripi care bat din sus în jos.
import { Group, Mesh, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, DoubleSide } from 'three';
import { rich, look } from './look.js';

const N = 6;
let geo = null, mat = null;
function wing(side) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0.05, 0, 0, -0.05, side * 0.32, 0.03, 0.0], 3));
  return g;
}

export function createGulls(s, camera) {
  const root = new Group(), birds = [];
  root.visible = false;
  if (!geo) { geo = [wing(1), wing(-1)]; mat = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, fog: true }); }
  for (let k = 0; k < N; k++) {
    const b = new Group(), l = new Mesh(geo[0], mat), r = new Mesh(geo[1], mat);
    b.add(l, r); b.scale.setScalar(0.9);
    root.add(b);
    birds.push({ b, l, r, ph: k * 1.7, rad: 2.5 + (k % 3) * 1.6, sp: 0.18 + 0.05 * (k % 4), h: 3.2 + 0.5 * (k % 3), cx: (0.15 + 0.7 * ((k * 0.37) % 1)) * s.w, cz: (0.15 + 0.7 * ((k * 0.61) % 1)) * s.h });
  }
  return {
    root,
    update(t) {
      const on = rich() && look.mode === '3d';
      root.visible = on;
      if (!on) return;
      for (const q of birds) {
        const a = t * q.sp + q.ph;
        q.b.position.set(q.cx + Math.cos(a) * q.rad, q.h + Math.sin(a * 2.3) * 0.2, q.cz + Math.sin(a) * q.rad);
        q.b.rotation.y = -a;
        const f = Math.sin(t * 6 + q.ph) * 0.45;
        q.l.rotation.z = f; q.r.rotation.z = -f;
      }
    },
  };
}
