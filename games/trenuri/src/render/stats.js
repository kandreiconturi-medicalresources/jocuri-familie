// Statistici de depanare: tasta F3 sau ` afișează draw calls, triunghiuri, geometrii și FPS (și ?stats în adresă).
export function createStats(renderer, quality) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:70;padding:3px 8px;border-radius:8px;background:rgba(0,0,0,.72);color:#9dff9d;font:12px monospace;pointer-events:none;display:none;white-space:pre';
  document.body.append(el);
  let on = /[?&]stats/.test(location.search), n = 0, t0 = performance.now(), fps = 0;
  const show = () => { el.style.display = on ? 'block' : 'none'; };
  show();
  addEventListener('keydown', (e) => { if (e.key === 'F3' || e.key === '`') { on = !on; show(); e.preventDefault(); } });
  const stats = { calls: 0, tris: 0 };
  window.__renderStats = stats;
  return {
    update() {
      const i = renderer.info;
      stats.calls = i.render.calls; stats.tris = i.render.triangles; stats.geos = i.memory.geometries; stats.fps = fps;
      n++;
      const t = performance.now();
      if (t - t0 < 1000) return;
      fps = Math.round((n * 1000) / (t - t0)); n = 0; t0 = t;
      if (on) el.textContent = `calls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k\ngeo ${i.memory.geometries}  tex ${i.memory.textures}  q${quality()}  ${fps} fps`;
    },
  };
}
