// Gesturi pe canvas: un deget = atingere / tragere (cameră sau traseu), două degete = zoom + rotire, mouse: dreapta = rotire.
export function bindPointer(canvas, camera, pickTile, h) {
  const ptr = new Map();
  let drag = null, rotMouse = false, pinch = null, lastT = null; // lastT: ultima placă bună din tragere (pointerul poate ieși din hartă sau din ecran)

  const tileOf = (e, clamp = false) => { const p = camera.pick(e.clientX, e.clientY, h.groundAt); return p ? pickTile(p, clamp) : null; };
  const two = () => { const [a, b] = [...ptr.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) }; };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, btn: e.button });
    if (ptr.size === 2) { if (drag) { h.dragCancel(); drag = null; } pinch = two(); for (const p of ptr.values()) p.moved = true; return; }
    if (ptr.size > 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) { rotMouse = true; return; }
    if (h.wantsDrag()) { const t = tileOf(e); if (t) { drag = true; lastT = t; h.dragStart(t); } }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') h.hover(tileOf(e)); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) p.moved = true;
    if (ptr.size === 2 && pinch) {
      const n = two();
      camera.gesture(h.groundAt, pinch.cx, pinch.cy, n.cx, n.cy, pinch.d / n.d, -(n.a - pinch.a));
      pinch = n;
      return;
    }
    if (ptr.size !== 1) return;
    if (rotMouse) { camera.rotate(-dx * 0.008); return; }
    if (drag) { if (p.moved) { const t = tileOf(e, true); if (t) lastT = t; h.dragMove(lastT); } return; }
    if (p.moved) camera.pan(dx, dy);
  });
  const up = (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    ptr.delete(e.pointerId);
    if (ptr.size < 2) pinch = null;
    if (drag) { drag = null; h.dragEnd(tileOf(e, true) || lastT, p.moved); return; }
    if (rotMouse && ptr.size === 0) { rotMouse = false; return; }
    if (!p.moved && e.type === 'pointerup' && p.btn === 0) { const t = tileOf(e); if (t) h.tap(t, e); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { if (drag) { h.dragCancel(); drag = null; } up(e); });
  addEventListener('blur', () => { if (drag) { h.dragCancel(); drag = null; } ptr.clear(); pinch = null; rotMouse = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.gesture(h.groundAt, e.clientX, e.clientY, e.clientX, e.clientY, Math.exp(e.deltaY * 0.0012), 0); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
