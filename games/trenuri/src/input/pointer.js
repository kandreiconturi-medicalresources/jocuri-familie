// Gesturi pe canvas: un deget = atingere / tragere (cameră sau traseu), două degete = zoom + rotire, mouse: dreapta = rotire.
export function bindPointer(canvas, camera, pickTile, h) {
  const ptr = new Map();
  let drag = null, rotMouse = false, pinch = null;

  const tileOf = (e) => { const p = camera.pick(e.clientX, e.clientY, h.groundAt); return p ? pickTile(p) : null; };
  const two = () => { const [a, b] = [...ptr.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) }; };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, btn: e.button });
    if (ptr.size === 2) { if (drag) { h.dragCancel(); drag = null; } pinch = two(); for (const p of ptr.values()) p.moved = true; return; }
    if (ptr.size > 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) { rotMouse = true; return; }
    if (h.wantsDrag()) { const t = tileOf(e); if (t) { drag = true; h.dragStart(t); } }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') h.hover(tileOf(e)); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) p.moved = true;
    if (ptr.size === 2 && pinch) {
      const n = two();
      camera.zoom(pinch.d / n.d); camera.rotate(-(n.a - pinch.a)); camera.pan(n.cx - pinch.cx, n.cy - pinch.cy);
      pinch = n;
      return;
    }
    if (ptr.size !== 1) return;
    if (rotMouse) { camera.rotate(-dx * 0.008); return; }
    if (drag) { if (p.moved) h.dragMove(tileOf(e)); return; }
    if (p.moved) camera.pan(dx, dy);
  });
  const up = (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    ptr.delete(e.pointerId);
    if (ptr.size < 2) pinch = null;
    if (drag) { drag = null; h.dragEnd(tileOf(e), p.moved); return; }
    if (rotMouse && ptr.size === 0) { rotMouse = false; return; }
    if (!p.moved && e.type === 'pointerup' && p.btn === 0) { const t = tileOf(e); if (t) h.tap(t, e); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { if (drag) { h.dragCancel(); drag = null; } up(e); });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
