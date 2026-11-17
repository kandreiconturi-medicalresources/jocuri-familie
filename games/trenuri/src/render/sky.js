// Cer: dom cu gradient (albastru sus, auriu cald la orizont) care urmărește camera; noaptea se întunecă.
import { Mesh, SphereGeometry, MeshBasicMaterial, BackSide, Float32BufferAttribute, Color, Sprite, SpriteMaterial, Vector3, AdditiveBlending } from 'three';
import { softTexture } from './texgen.js';
import { look } from './look.js';

/** Direcția spre soare (aceeași pentru lumină, discul solar și strălucirea cerului). */
export const SUN_DIR = new Vector3(-0.55, 0.62, 0.42).normalize();
const GLOW = new Color('#ffcf8a'), sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

const STOPS = [[-1, '#e8e6d2'], [0, '#e8e6d2'], [0.12, '#d4e6ea'], [0.4, '#93c6ec'], [0.75, '#5f9fe2'], [1, '#3f7fd0']].map(([k, c]) => [k, new Color(c)]);

export function createSky(scene, camera) {
  const geo = new SphereGeometry(300, 32, 20), pos = geo.attributes.position, col = [];
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 300;
    let k = 1; while (k < STOPS.length - 1 && STOPS[k][0] < h) k++;
    const a = STOPS[k - 1], b = STOPS[k];
    c.copy(a[1]).lerp(b[1], Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))));
    const d = Math.max(0, (pos.getX(i) * SUN_DIR.x + pos.getY(i) * SUN_DIR.y + pos.getZ(i) * SUN_DIR.z) / 300), w = sm(0.03, 0.3, h);
    c.lerp(GLOW, Math.min(0.6, (Math.pow(d, 6) * 0.28 + Math.pow(d, 40) * 0.5) * w)); // aureolă caldă în jurul soarelui
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const mat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  scene.add(mesh);
  const mk = (size, op) => { const m = new SpriteMaterial({ map: softTexture(64), color: 0xfff1cf, blending: AdditiveBlending, transparent: true, opacity: op, fog: false, depthWrite: false, toneMapped: false }); const s = new Sprite(m); s.scale.setScalar(size); s.renderOrder = -9; s.frustumCulled = false; scene.add(s); return s; };
  const halo = mk(95, 0.55), disc = mk(26, 0.95); // disc solar + halou (se văd peste cer, dispar noaptea)
  return {
    mesh,
    update(night, K) {
      mesh.position.copy(camera.position); mesh.scale.setScalar(K);
      const v = 1 - Math.min(1, night * 1.6), r = look.cool ? 0.8 : 1;
      for (const [s, sz] of [[halo, 95], [disc, 26]]) { s.position.copy(camera.position).addScaledVector(SUN_DIR, 285 * K); s.scale.setScalar(sz * K); s.visible = v > 0.02; s.material.opacity = (s === halo ? 0.55 : 0.95) * v * r; }
      mat.color.setRGB(1 - night * 0.7, 1 - night * 0.62, 1 - night * 0.38); // orizontul rămâne egal cu ceața (vezi stage.js)
    },
  };
}
