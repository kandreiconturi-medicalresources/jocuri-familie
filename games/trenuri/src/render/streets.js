// Străzi Ultra: felinare Kenney pe trotuarele din orașe (cu brațul spre drum, aprinse noaptea) și semafoare la intersecții.
import { Group } from 'three';
import { addInstances, hash, STREET } from './props.js';

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], LAMP_S = 0.7, LIGHT_S = 0.6;

export function createStreets(s, g) {
  const root = new Group(), lamps = [], lights = [], heads = [];
  const near = new Uint8Array(s.w * s.h);
  for (const c of s.cities) for (let y = Math.max(0, c.y - 5); y <= Math.min(s.h - 1, c.y + 5); y++) for (let x = Math.max(0, c.x - 5); x <= Math.min(s.w - 1, c.x + 5); x++) near[y * s.w + x] = 1;
  const road = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.roads[y * s.w + x] && !s.water[y * s.w + x];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!road(x, y) || !near[y * s.w + x]) continue;
    const n = N4.map(([dx, dz]) => road(x + dx, y + dz)), links = n.filter(Boolean).length;
    if (links >= 3 && hash(x, y, 51) < 0.8) { // semafor în colțul intersecției
      const px = x + 0.88, pz = y + 0.88;
      lights.push({ x: px, y: g.at(px, pz) + 0.03, z: pz, yaw: Math.PI * 0.25 + (hash(x, y, 52) < 0.5 ? 0 : Math.PI), s: LIGHT_S });
      continue;
    }
    if ((x + y) % 2 || hash(x, y, 53) < 0.25) continue;
    const sides = N4.map((d, k) => (n[k] ? null : d)).filter(Boolean);
    if (!sides.length) continue;
    const [sx, sz] = sides[(hash(x, y, 54) * sides.length) | 0], px = x + 0.5 + sx * 0.43, pz = y + 0.5 + sz * 0.43, py = g.at(px, pz) + 0.03;
    lamps.push({ x: px, y: py, z: pz, yaw: Math.atan2(-sx, -sz), s: LAMP_S }); // brațul modelului e pe -Z: îl întoarcem spre drum
    heads.push([px - sx * 0.19 * LAMP_S, py + 0.64 * LAMP_S, pz - sz * 0.19 * LAMP_S]); // capul, deasupra drumului
  }
  addInstances(root, STREET[0], lamps);
  addInstances(root, STREET[1], lights);
  root.userData.lamps = heads; root.userData.wins = [];
  return root;
}
