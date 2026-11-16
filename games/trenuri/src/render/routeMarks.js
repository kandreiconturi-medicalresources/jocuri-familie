// Ruta aleasă în asistent, desenată pe hartă: numere 1, 2, 3… peste gări și o linie punctată între ele. DOM/SVG peste canvas, cu proiecția camerei.
import { Vector3 } from 'three';

const NS = 'http://www.w3.org/2000/svg';

export function createRouteMarks(root, { camera, groundAt }) {
  const layer = document.createElement('div');
  layer.className = 'rm-layer';
  const svg = document.createElementNS(NS, 'svg'), line = document.createElementNS(NS, 'polyline');
  line.setAttribute('class', 'rm-line');
  svg.append(line); layer.append(svg); root.append(layer);
  const v = new Vector3();
  let pts = [], badges = [];

  return {
    /** pts: [{ x, y }] în ordinea rutei (plăci). */
    set(list) {
      pts = list;
      while (badges.length > pts.length) badges.pop().remove();
      while (badges.length < pts.length) { const b = document.createElement('div'); b.className = 'rm'; layer.append(b); badges.push(b); }
      badges.forEach((b, i) => { b.textContent = String(i + 1); });
      if (!pts.length) line.setAttribute('points', '');
    },
    /** În fiecare cadru de desen. */
    frame() {
      if (!pts.length) return;
      const pr = [];
      pts.forEach((p, i) => {
        v.set(p.x + 0.5, groundAt(p.x + 0.5, p.y + 0.5) + 1.2, p.y + 0.5).project(camera);
        const x = Math.round((v.x * 0.5 + 0.5) * innerWidth), y = Math.round((-v.y * 0.5 + 0.5) * innerHeight), vis = v.z > 0 && v.z < 1;
        badges[i].style.display = vis ? '' : 'none';
        badges[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (vis) pr.push(x + ',' + y);
      });
      line.setAttribute('points', pr.join(' '));
    },
    clear() { this.set([]); },
  };
}
