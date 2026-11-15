// Pista ca o singură plasă (toate piesele unite), cerul și solul. Totul cu culori pe vârfuri.
import {
  BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, BackSide,
} from 'three';
import { DIRS, TILE } from '../tracks/pieces.js';
import { bake, getModel } from './models.js';

const tint = (hex) => new Color(hex);

/** Unește toate piesele pistei într-o singură geometrie. `theme` schimbă iarba și asfaltul. */
export function buildTrackGeometry(track, theme) {
  const gnd = tint(theme.ground), asph = tint(theme.asphalt);
  const colorFor = (name) => (name === 'grass' ? gnd : name === 'road' ? asph : null);
  const baked = {};
  const pos = [], nor = [], col = [];
  for (const p of track.placed) {
    const g = baked[p.model] || (baked[p.model] = bake(getModel(p.model).clone(true), colorFor));
    const F = DIRS[p.dir], R = DIRS[(p.dir + 1) & 3];
    const sa = p.flip || p.mirror ? -1 : 1;
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
    const cnt = P.length / 3, base = pos.length;
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const a = (x - 0.5) * sa, b = p.flip ? 1 + z : -z;
      pos.push(p.x + (a * R[0] + b * F[0]) * TILE, p.y + y * TILE, p.z + (a * R[1] + b * F[1]) * TILE);
      const na = N[i * 3] * sa, nb = p.flip ? N[i * 3 + 2] : -N[i * 3 + 2];
      nor.push(na * R[0] + nb * F[0], N[i * 3 + 1], na * R[1] + nb * F[1]);
      col.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]);
    }
    if (p.mirror) { // oglindirea întoarce sensul triunghiurilor: le întoarcem înapoi
      for (let t = base; t < pos.length; t += 9) {
        for (let k = 0; k < 3; k++) {
          [pos[t + 3 + k], pos[t + 6 + k]] = [pos[t + 6 + k], pos[t + 3 + k]];
          [nor[t + 3 + k], nor[t + 6 + k]] = [nor[t + 6 + k], nor[t + 3 + k]];
          [col[t + 3 + k], col[t + 6 + k]] = [col[t + 6 + k], col[t + 3 + k]];
        }
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

export const lambert = () => new MeshLambertMaterial({ vertexColors: true });

/** Cer cu degrade (vârfuri colorate), centrat pe cameră. */
export function createSky(theme) {
  const geo = new SphereGeometry(800, 16, 10);
  const top = tint(theme.sky[0]), hor = tint(theme.sky[1]);
  const p = geo.attributes.position, c = [];
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, p.getY(i) / 800), k = Math.pow(t, 0.6), m = top.clone().lerp(hor, 1 - k);
    c.push(m.r, m.g, m.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(c, 3));
  const sky = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  return sky;
}

export function createGround(theme) {
  const geo = new PlaneGeometry(3000, 3000);
  geo.rotateX(-Math.PI / 2);
  const m = new Mesh(geo, new MeshLambertMaterial({ color: theme.ground }));
  m.position.y = -0.12; // sub dale, ca să nu se bată cap în cap
  return m;
}

export function createTrackMesh(track, theme) {
  const m = new Mesh(buildTrackGeometry(track, theme), lambert());
  m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}
