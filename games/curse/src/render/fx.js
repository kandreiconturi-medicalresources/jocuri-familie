// Efecte: fum la drift, praf pe iarbă, flacără la nitro (puncte cu shader mic) și urme de frână.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, MeshBasicMaterial, Points, ShaderMaterial,
} from 'three';

const VS = `attribute float size; attribute vec4 pc; varying vec4 vC; uniform float scale;
void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FS = `precision mediump float; varying vec4 vC;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }`;

/** Rezervor de particule. emit(...) adaugă, update(dt) mișcă și estompează. */
export function createPool(max, additive) {
  const geo = new BufferGeometry();
  const pos = new Float32Array(max * 3), pc = new Float32Array(max * 4), size = new Float32Array(max);
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
  geo.setAttribute('pc', new BufferAttribute(pc, 4).setUsage(DynamicDrawUsage));
  geo.setAttribute('size', new BufferAttribute(size, 1).setUsage(DynamicDrawUsage));
  const mat = new ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, uniforms: { scale: { value: 300 } },
    blending: additive ? AdditiveBlending : undefined,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 5;
  const P = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, r: 0, g: 0, b: 0, a: 0 }));
  let head = 0, live = 0;
  return {
    pts,
    setView(heightPx, fov) { mat.uniforms.scale.value = heightPx * 0.5 / Math.tan(fov * Math.PI / 360); },
    emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a) {
      const p = P[head]; head = (head + 1) % max;
      p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.s0 = s0; p.s1 = s1;
      p.r = r; p.g = g; p.b = b; p.a = a;
    },
    update(dt) {
      live = 0;
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.life > 0) {
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
        const k = p.life > 0 ? 1 - p.life / p.max : 1; // 0 = născută, 1 = moartă
        pos[i * 3] = p.x || 0; pos[i * 3 + 1] = p.y || 0; pos[i * 3 + 2] = p.z || 0;
        size[i] = p.life > 0 ? p.s0 + (p.s1 - p.s0) * k : 0;
        pc[i * 4] = p.r; pc[i * 4 + 1] = p.g; pc[i * 4 + 2] = p.b;
        pc[i * 4 + 3] = p.life > 0 ? p.a * (1 - k) * Math.min(1, k * 8) : 0;
        if (p.life > 0) live++;
      }
      geo.attributes.position.needsUpdate = geo.attributes.pc.needsUpdate = geo.attributes.size.needsUpdate = true;
      pts.visible = live > 0;
    },
  };
}

/** Urme de drift: bandă circulară de dreptunghiuri întunecate. */
export function createSkids(maxSegs) {
  const pos = new Float32Array(maxSegs * 4 * 3), idx = [];
  for (let i = 0; i < maxSegs; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
  geo.setIndex(idx);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ color: 0x15151a, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.frustumCulled = false;
  let head = 0;
  const last = new Map();
  return {
    mesh,
    /** Adaugă o bucată de urmă pentru o roată (cheie `key`) la (x, y, z), cu lățimea w, orientată după (tx, tz). */
    add(key, x, y, z, tx, tz, w = 0.35) {
      const l = last.get(key);
      last.set(key, { x, y, z, t: performance.now() });
      if (!l || performance.now() - l.t > 120) return;
      const nx = -tz * w, nz = tx * w, o = head * 12;
      pos.set([l.x - nx, l.y + 0.06, l.z - nz, l.x + nx, l.y + 0.06, l.z + nz, x - nx, y + 0.06, z - nz, x + nx, y + 0.06, z + nz], o);
      head = (head + 1) % maxSegs;
      geo.attributes.position.needsUpdate = true;
    },
    stop(key) { last.delete(key); },
    clear() { pos.fill(0); head = 0; last.clear(); geo.attributes.position.needsUpdate = true; },
  };
}
