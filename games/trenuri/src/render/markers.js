// Marcaje animate pe hartă (❗ 📦 🏭 🎯 🏙️): butoane DOM puse peste canvas și poziționate cu proiecția camerei.
// Fișier propriu: nu atinge restul lui render/. Se leagă în scenă dintr-o singură linie (vezi game.js: createMarkers).
import { Vector3 } from 'three';

export function createMarkers(root, { camera, groundAt, onPick }) {
  const layer = document.createElement('div');
  layer.className = 'mk-layer';
  root.append(layer);
  const map = new Map(), pings = new Set(), v = new Vector3();
  let on = true;

  function make(it, extra) {
    const el = document.createElement('button');
    el.className = 'mk mk-' + it.kind + (extra || '');
    const i = document.createElement('span');
    i.className = 'mk-i'; i.textContent = it.icon;
    el.append(i);
    el.title = it.text; el.setAttribute('aria-label', it.text);
    layer.append(el);
    return el;
  }
  function place(el, x, y, lift, off = 0) {
    v.set(x + 0.5, groundAt(x + 0.5, y + 0.5) + lift, y + 0.5).project(camera);
    const vis = v.z > 0 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    el.style.display = vis ? '' : 'none';
    if (vis) el.style.transform = `translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth) + off}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -100%)`;
  }

  return {
    /** Lista de marcaje [{ id, kind, icon, x, y, text, ref }]: adaugă, actualizează sau scoate. */
    set(items) {
      const keep = new Set(items.map((i) => i.id));
      for (const [id, m] of map) if (!keep.has(id)) { m.el.remove(); map.delete(id); }
      const seen = new Map();
      for (const it of items) {
        let m = map.get(it.id);
        const k = it.x * 1000 + it.y, n = seen.get(k) || 0; seen.set(k, n + 1); // marcaje pe aceeași placă: unul lângă altul
        if (!m) { const el = make(it); m = { el, it }; map.set(it.id, m); el.addEventListener('click', (e) => { e.stopPropagation(); onPick(map.get(it.id).it); }); }
        m.it = it; m.off = n * 46; m.el.title = it.text; m.el.setAttribute('aria-label', it.text); m.el.firstChild.textContent = it.icon;
      }
    },
    /** Un marcaj trecător (📍) pe o placă, de pildă pentru „Arată pe hartă”. */
    ping(x, y, icon = '📍', ms = 6000) {
      const it = { kind: 'ping', icon, text: 'Aici' }, p = { el: make(it, ' mk-ping'), x, y };
      pings.add(p);
      setTimeout(() => { p.el.remove(); pings.delete(p); }, ms);
    },
    /** În fiecare cadru de desen. */
    frame() {
      if (!on) return;
      for (const m of map.values()) place(m.el, m.it.x, m.it.y, 1.5, m.off || 0);
      for (const p of pings) place(p.el, p.x, p.y, 1.5);
    },
    show(b) { on = b; layer.style.display = b ? '' : 'none'; },
    clear() { for (const m of map.values()) m.el.remove(); map.clear(); for (const p of pings) p.el.remove(); pings.clear(); },
  };
}
