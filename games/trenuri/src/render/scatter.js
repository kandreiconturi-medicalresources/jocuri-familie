// Iarbă, flori: smocuri de fire (4 triunghiuri) și capete de flori (octaedre mici), instanțiate pe bucăți de teren liber.
import { InstancedMesh, BufferGeometry, Float32BufferAttribute, MeshLambertMaterial, OctahedronGeometry, FrontSide, Matrix4, Quaternion, Vector3, Euler, Color } from 'three';
import { hash } from './props.js';

const CH = 32, FLOWERS = [0xffffff, 0xffe45c, 0xff7aa8, 0xff5a4a, 0xb48cff, 0xffc2e0];
let tuft = null, head = null, matT = null, matF = null;
const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), sc = new Vector3(), col = new Color();

function tuftGeo() {
  const pos = [], cols = [], nor = [], base = new Color('#4d7f2f'), tip = new Color('#b9dc72');
  for (let b = 0; b < 4; b++) {
    const a = b * 1.57 + 0.4, ca = Math.cos(a), sa = Math.sin(a), h = 0.1 + 0.06 * ((b * 7) % 3) / 2, lean = 0.05;
    for (const f of [1, -1]) { // ambele fețe, ca să nu depindem de DoubleSide (normale răsturnate = negru)
      pos.push(-sa * 0.028 * f, 0, ca * 0.028 * f, sa * 0.028 * f, 0, -ca * 0.028 * f, ca * lean, h, sa * lean);
      cols.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(cols, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

function inst(geo, mat, list, tint) {
  const im = new InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => { im.setMatrixAt(i, m4.compose(v.set(it.x, it.y, it.z), q.setFromEuler(e.set(0, it.yaw, 0)), sc.set(it.s, it.s, it.s))); im.setColorAt(i, col.set(it.c)); });
  im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
  im.userData.recv = true; im.userData.cast = false;
  return im;
}

export function scatterChunk(root, s, g, cx, cy, quality, free) {
  if (!tuft) {
    tuft = tuftGeo(); head = new OctahedronGeometry(0.022, 0); head.scale(1, 0.6, 1);
    matT = new MeshLambertMaterial({ vertexColors: true, side: FrontSide }); matF = new MeshLambertMaterial({ color: 0xffffff });
  }
  const tufts = [], flowers = [], dens = quality >= 2 ? 0.7 : 0.28;
  for (let y = cy * CH; y < Math.min(s.h, cy * CH + CH); y++) for (let x = cx * CH; x < Math.min(s.w, cx * CH + CH); x++) {
    const i = y * s.w + x, h = s.height[i];
    if (s.forest[i] || h <= 4 || h >= 11 || !free(i)) continue;
    const n = hash(x, y, 90) < dens ? 1 + (hash(x, y, 91) < dens * 0.6 ? 1 : 0) : 0;
    for (let k = 0; k < n; k++) {
      const fx = x + 0.1 + 0.8 * hash(x, y, 92 + k), fz = y + 0.1 + 0.8 * hash(x, y, 95 + k), s0 = 0.8 + 0.7 * hash(x, y, 98 + k);
      tufts.push({ x: fx, y: g.at(fx, fz), z: fz, yaw: hash(x, y, 99 + k) * 6.28, s: s0, c: hash(x, y, 101 + k) < 0.3 ? 0xd8e6a0 : 0xffffff });
    }
    if (hash(x, y, 103) < (quality >= 2 ? 0.07 : 0.035)) { // pată de flori, de aceeași culoare
      const pc = FLOWERS[(hash(x, y, 104) * FLOWERS.length) | 0];
      for (let k = 0; k < 5; k++) {
        const fx = x + 0.2 + 0.6 * hash(x, y, 110 + k), fz = y + 0.2 + 0.6 * hash(x, y, 120 + k), gy = g.at(fx, fz);
        flowers.push({ x: fx, y: gy + 0.1 + 0.03 * hash(x, y, 130 + k), z: fz, yaw: 0, s: 1, c: pc });
        tufts.push({ x: fx, y: gy, z: fz, yaw: hash(x, y, 140 + k) * 6.28, s: 1.1, c: 0xffffff });
      }
    }
  }
  if (tufts.length) root.add(inst(tuft, matT, tufts));
  if (flowers.length) root.add(inst(head, matF, flowers));
}
