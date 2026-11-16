// Etichete deasupra trenurilor când camera e aproape: „🚂 Tren de marfă · ⛽ Combustibil”. DOM peste canvas, poziționat cu proiecția camerei.
import { Vector3 } from 'three';
import { trainKind } from './trainKind.js';

export function createTrainLabels(root, { camera, state, view, zoom }) {
  const layer = document.createElement('div');
  layer.className = 'tl-layer';
  root.append(layer);
  const map = new Map(), v = new Vector3();
  let on = false, t = 0;
  return {
    show(b) { on = b; layer.style.display = b ? '' : 'none'; },
    /** În fiecare cadru de desen. */
    frame(dt) {
      const s = state(), vw = view();
      if (!on || !s || !vw) return;
      const near = zoom() < 24;
      t += dt;
      const refresh = t > 0.5; if (refresh) t = 0;
      const seen = new Set();
      for (const tr of near ? s.trains : []) {
        if (tr.state === 3) continue;
        const p = vw.trains.positionOf(tr.id);
        if (!p) continue;
        v.set(p.x, p.y + 0.9, p.z).project(camera);
        if (!(v.z > 0 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05)) continue;
        seen.add(tr.id);
        let el = map.get(tr.id);
        if (!el) { el = document.createElement('div'); el.className = 'tl'; layer.append(el); map.set(tr.id, el); el.dataset.t = ''; }
        if (refresh || !el.textContent) { const k = trainKind(s, tr).full; if (el.dataset.t !== k) { el.dataset.t = k; el.textContent = k; } }
        el.style.transform = `translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -100%)`;
      }
      for (const [id, el] of map) if (!seen.has(id)) { el.remove(); map.delete(id); }
    },
  };
}
