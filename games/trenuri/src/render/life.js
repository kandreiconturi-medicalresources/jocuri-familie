// Detalii vii Ultra (doar decor, Math.random permis): fum din coșurile fabricilor, trecători pe trotuarele orașelor, copaci în vânt.
import { Group, Box3, Matrix4, Quaternion, Vector3, Euler, Color } from 'three';
import { INDUSTRIES } from '../sim/goods.js';
import { getParts } from './models.js';
import { createSmoke } from './smoke.js';
import { makePeopleMeshes, CLOTHES, SKINS } from './peopleGeo.js';
import { U_TREE_LOW, U_TREE_HIGH, U_BUSHES, PALM } from './props.js';

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], WALK = 0.4, MAXP = 140;
const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), sc = new Vector3(), col = new Color();
const wind = { value: 0 }, windAmp = { value: 0 };
let windy = false;

/** Copacii se leagănă: vârful se mișcă mai mult ca baza; faza după poziția instanței, ca pădurea să nu se miște la unison. */
function windTrees() {
  if (windy) return; windy = true;
  for (const model of [...U_TREE_LOW, ...U_TREE_HIGH, ...U_BUSHES, PALM]) for (const p of getParts(model)) {
    p.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind; sh.uniforms.uWindAmp = windAmp;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindAmp;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5, k = max(transformed.y - 0.12, 0.0) * uWindAmp;
  transformed.x += (sin(uWind * 1.3 + ph) * 0.6 + sin(uWind * 3.1 + ph * 1.7) * 0.25) * 0.05 * k;
  transformed.z += sin(uWind * 1.1 + ph * 0.8) * 0.025 * k;
#endif`);
    };
    p.mat.customProgramCacheKey = () => 'wind';
    p.mat.needsUpdate = true;
  }
}

/** Vârful coșului (în lume) pentru fiecare coș de fabrică. */
function chimneys(s, g) {
  const out = [];
  for (const o of s.industries) for (const [model, dx, dz, k] of INDUSTRIES[o.type].parts) {
    if (!model.includes('chimney')) continue;
    const box = new Box3(); for (const p of getParts(model)) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    const fx = o.x + 0.5 + dx * 0.5, fz = o.y + 0.5 + dz * 0.5, yaw = ((o.id * 7 + dx * 3) % 4) * Math.PI / 2;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2; // centrul coșului, rotit ca modelul
    out.push({ x: fx + (cx * Math.cos(yaw) + cz * Math.sin(yaw)) * k, y: g.at(fx, fz) + box.max.y * k, z: fz + (-cx * Math.sin(yaw) + cz * Math.cos(yaw)) * k, big: model.includes('large') ? 1.6 : 1.1, acc: Math.random() });
  }
  return out;
}

export function createLife(s, g, camera) {
  const root = new Group(), stacks = chimneys(s, g), smoke = createSmoke(camera, Math.min(600, 60 + stacks.length * 40));
  root.add(smoke.mesh);
  windTrees(); windAmp.value = 1;
  // trecători: pe marginea drumurilor din orașe, mers alene, se întorc la capăt de stradă
  const near = new Uint8Array(s.w * s.h);
  for (const c of s.cities) for (let y = Math.max(0, c.y - 5); y <= Math.min(s.h - 1, c.y + 5); y++) for (let x = Math.max(0, c.x - 5); x <= Math.min(s.w - 1, c.x + 5); x++) near[y * s.w + x] = 1;
  const road = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.roads[y * s.w + x] > 0 && !s.water[y * s.w + x] && near[y * s.w + x];
  const tiles = []; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (road(x, y)) tiles.push([x, y]);
  const n = Math.min(MAXP, Math.floor(tiles.length * 0.8)), { body, skin } = makePeopleMeshes(n);
  root.add(body, skin);
  const walkers = Array.from({ length: n }, () => {
    const [x, y] = tiles[(Math.random() * tiles.length) | 0], dirs = [0, 1, 2, 3].filter((k) => road(x + N4[k][0], y + N4[k][1]));
    const d = dirs.length ? dirs[(Math.random() * dirs.length) | 0] : 0;
    return { x, y, din: d, dout: d, t: Math.random(), side: Math.random() < 0.5 ? 1 : -1, sp: 0.18 + Math.random() * 0.12, ph: Math.random() * 6, c: CLOTHES[(Math.random() * CLOTHES.length) | 0], k: SKINS[(Math.random() * SKINS.length) | 0], s: 1.25 + Math.random() * 0.3, yaw: 0 };
  });
  const turn = (w) => { const o = [0, 1, 2, 3].filter((k) => k !== ((w.din + 2) & 3) && road(w.x + N4[k][0], w.y + N4[k][1])); return o.length ? o[(Math.random() * o.length) | 0] : (w.din + 2) & 3; };
  walkers.forEach((w) => { w.dout = turn(w); body.setColorAt(walkers.indexOf(w), col.set(w.c)); skin.setColorAt(walkers.indexOf(w), col.set(w.k)); });
  body.count = skin.count = n;
  if (n) { body.instanceColor.needsUpdate = true; skin.instanceColor.needsUpdate = true; }
  for (const m of [body, skin]) { m.userData.cast = true; m.userData.recv = true; }
  let time = 0;
  return {
    root,
    update(dt, night) {
      dt = Math.min(dt, 0.1); time += dt; wind.value = time;
      for (const c of stacks) { c.acc += dt * (night > 0.3 ? 2 : 3.2); while (c.acc > 1) { c.acc -= 1; smoke.emit(c.x, c.y, c.z, c.big); } }
      smoke.update(dt);
      walkers.forEach((w, i) => {
        w.t += dt * w.sp;
        while (w.t >= 1) { w.t -= 1; w.x += N4[w.dout][0]; w.y += N4[w.dout][1]; w.din = w.dout; w.dout = road(w.x, w.y) ? turn(w) : (w.din + 2) & 3; if (!road(w.x, w.y)) { w.x -= N4[w.din][0]; w.y -= N4[w.din][1]; } }
        const cx = w.x + 0.5, cz = w.y + 0.5, [ix, iz] = N4[w.din], [ox, oz] = N4[w.dout], t = w.t, u = 1 - t;
        const ax = cx - ix * 0.5, az = cz - iz * 0.5, bx = cx + ox * 0.5, bz = cz + oz * 0.5;
        const px = u * u * ax + 2 * u * t * cx + t * t * bx, pz = u * u * az + 2 * u * t * cz + t * t * bz;
        const tx = 2 * u * (cx - ax) + 2 * t * (bx - cx), tz = 2 * u * (cz - az) + 2 * t * (bz - cz), l = Math.hypot(tx, tz);
        if (l > 0.05) w.yaw = Math.atan2(tx / l, tz / l);
        const fx = Math.sin(w.yaw), fz = Math.cos(w.yaw), wx = px - fz * WALK * w.side, wz = pz + fx * WALK * w.side, bob = Math.abs(Math.sin(time * 7 + w.ph)) * 0.008;
        m4.compose(v.set(wx, g.at(wx, wz) + 0.03 + bob, wz), q.setFromEuler(e.set(0, w.yaw, 0)), sc.setScalar(w.s));
        body.setMatrixAt(i, m4); skin.setMatrixAt(i, m4);
      });
      body.instanceMatrix.needsUpdate = true; skin.instanceMatrix.needsUpdate = true;
    },
    dispose() { windAmp.value = 0; body.dispose(); skin.dispose(); smoke.mesh.dispose(); },
  };
}
