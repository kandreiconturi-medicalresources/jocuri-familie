// Vederea 2D (7.7): iconițe mari și clare peste hartă pentru gări, porturi, trenuri și vapoare (DOM, puse cu proiecția camerei).
import { Vector3 } from 'three';
import { shipXY } from '../render/ships.js';

export function createFlatIcons(root, { camera, state, view, zoom }) {
  const layer = document.createElement('div');
  layer.className = 'fi-layer';
  layer.style.display = 'none';
  root.append(layer);
  const map = new Map(), v = new Vector3();
  let on = false;

  function put(key, seen, cls, icon, label, color, x, y, z) {
    v.set(x, y, z).project(camera);
    if (!(v.z > 0 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05)) return;
    seen.add(key);
    let el = map.get(key);
    if (!el) {
      el = document.createElement('div'); el.className = 'fi ' + cls;
      const i = document.createElement('span'), n = document.createElement('span');
      i.className = 'fi-i'; n.className = 'fi-n';
      el.append(i, n);
      layer.append(el); map.set(key, el);
    }
    if (el.firstChild.textContent !== icon) el.firstChild.textContent = icon;
    if (el.lastChild.textContent !== label) el.lastChild.textContent = label;
    if (color && el.dataset.c !== color) { el.dataset.c = color; el.firstChild.style.background = color; }
    el.style.transform = `translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -50%)`;
  }
  return {
    show(b) { on = b; layer.style.display = b ? '' : 'none'; if (!b) { layer.textContent = ''; map.clear(); } },
    get on() { return on; },
    /** În fiecare cadru desenat. */
    frame() {
      const s = state(), vw = view();
      if (!on || !s || !vw) return;
      const names = zoom() < 40, seen = new Set(), col = (o) => (s.companies[o] ? s.companies[o].color : '#ff6b6b');
      for (const st of s.stations) put('s' + st.id, seen, st.port ? 'fi-port' : 'fi-st', st.port ? '⚓' : '🚉', names ? st.name : '', col(st.owner), st.x + 0.5, vw.ground.at(st.x + 0.5, st.y + 0.5) + 0.3, st.y + 0.5);
      for (const tr of s.trains) {
        if (tr.state === 3) continue;
        const p = vw.trains.positionOf(tr.id);
        if (p) put('t' + tr.id, seen, 'fi-tr', '🚂', '', col(tr.owner), p.x, p.y + 0.6, p.z);
      }
      for (const sh of s.ships || []) { const p = shipXY(s, sh, 0); put('h' + sh.id, seen, 'fi-sh', '🚢', '', col(sh.owner), p.x, 0.4, p.z); }
      for (const [k, el] of map) if (!seen.has(k)) { el.remove(); map.delete(k); }
    },
  };
}
