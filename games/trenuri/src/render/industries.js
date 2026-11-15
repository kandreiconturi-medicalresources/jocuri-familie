// Industrii și îmbunătățiri de gară: modele Kenney instanțiate lângă plăcile lor.
import { Group } from 'three';
import { addInstances } from './props.js';
import { INDUSTRIES, IND_MODELS } from '../sim/goods.js';
import { UPGRADES } from '../sim/consts.js';

export const EXTRA_MODELS = [...IND_MODELS, ...UPGRADES.map((u) => u.glb)];

export function createIndustries(s, g) {
  const root = new Group(), by = new Map();
  for (const o of s.industries) {
    for (const [model, dx, dz, sc] of INDUSTRIES[o.type].parts) {
      const fx = o.x + 0.5 + dx * 0.5, fz = o.y + 0.5 + dz * 0.5;
      if (!by.has(model)) by.set(model, []);
      by.get(model).push({ x: fx, y: g.at(fx, fz), z: fz, yaw: ((o.id * 7 + dx * 3) % 4) * Math.PI / 2, s: sc });
    }
  }
  for (const [model, list] of by) addInstances(root, model, list);
  return root;
}

export function createUpgrades(s, g) {
  const root = new Group(), by = new Map();
  for (const st of s.stations) {
    UPGRADES.forEach((u, k) => {
      if (!st.up[k]) return;
      const fx = st.x + 0.5 + u.dx, fz = st.y + 0.5 + u.dz;
      if (!by.has(u.glb)) by.set(u.glb, []);
      by.get(u.glb).push({ x: fx, y: g.at(fx, fz), z: fz, yaw: k * Math.PI / 2, s: u.s });
    });
  }
  for (const [model, list] of by) addInstances(root, model, list);
  return root;
}
