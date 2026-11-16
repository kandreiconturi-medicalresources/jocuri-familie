// Gesturi pe canvas: un deget = atingere / tragere (cameră sau traseu), două degete = zoom + rotire, mouse: dreapta = rotire.
// În timpul trasării: eșantioanele (inclusiv `getCoalescedEvents`) se adună și se procesează o singură dată pe cadru (rAF);
// lângă marginea ecranului camera se mișcă singură; două degete sau rotița mută camera fără să strice traseul.
import { startDecision, HOLD_MS } from './touchGate.js';
const CTX_MS = 450; // apăsare lungă pentru meniul de la placă
const EDGE = 44, EDGE_SPEED = 950; // zona de margine (px) și viteza maximă a camerei (px/s)

export function bindPointer(canvas, camera, pickTile, h) {
  const ptr = new Map();
  let drag = null, rotMouse = false, pinch = null, lastT = null; // lastT: ultima placă bună din tragere (pointerul poate ieși din hartă sau din ecran)
  let hold = null, vel = { x: 0, y: 0 }, inertia = 0, pinched = false, lastTap = null;
  let queue = [], hoverPx = null, raf = 0, lastPx = null, mods = {}, tPrev = 0;

  const pickAt = (x, y, clamp) => { const p = camera.pick(x, y, h.groundAt); return p ? pickTile(p, clamp) : null; };
  const tileOf = (e, clamp = false) => pickAt(e.clientX, e.clientY, clamp);
  const two = () => { const [a, b] = [...ptr.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) }; };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  /** Eșantioanele adunate → plăci → dragMove (cel mult ~10 raycast-uri pe cadru, ultimul mereu). */
  function drain() {
    const q = queue; queue = [];
    if (!q.length) return;
    const step = Math.max(1, Math.ceil(q.length / 10));
    for (let i = 0; i < q.length; i += step) sample(q[i]);
    if ((q.length - 1) % step) sample(q[q.length - 1]);
  }
  function sample(s) { const t = pickAt(s.x, s.y, true); if (t) lastT = t; h.dragMove(lastT, mods); }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, tPrev ? (now - tPrev) / 1000 : 0.016);
    tPrev = now;
    if (drag) {
      drain();
      let again = false;
      if (lastPx) { // lângă marginea ecranului camera se mișcă singură, iar traseul continuă
        const k = (v, max) => Math.max(0, Math.min(1, (EDGE - v) / EDGE)) * EDGE_SPEED * dt;
        const vx = k(innerWidth - lastPx.x, 0) - k(lastPx.x, 0), vy = k(innerHeight - lastPx.y, 0) - k(lastPx.y, 0);
        if (vx || vy) { camera.pan(-vx, -vy); sample(lastPx); again = true; }
      }
      if (h.dragFlush) h.dragFlush();
      if (again) kick(); else tPrev = 0;
    } else if (hoverPx) { const p = hoverPx; hoverPx = null; h.hover(pickAt(p.x, p.y, false)); tPrev = 0; }
  }
  const stopDrag = (cancel, abort) => { if (!drag) return; drain(); drag = null; lastPx = null; if (abort && h.dragAbort) h.dragAbort(); else if (cancel) h.dragCancel(); };
  const clearHold = () => { if (!hold) return; clearTimeout(hold.timer); hold = null; if (h.holdRing) h.holdRing(null); };
  function beginDrag(x, y, t, e) { drag = true; lastT = t; lastPx = { x, y }; mods = { shift: !!(e && e.shiftKey), ctrl: !!(e && (e.ctrlKey || e.metaKey)) }; queue = []; h.dragStart(t); }
  function holdFire() { // apăsare lungă fără mișcare: începe desenul
    const hd = hold; hold = null;
    const p = hd && ptr.get(hd.id);
    if (!p || p.moved || ptr.size !== 1 || drag) { if (h.holdRing) h.holdRing(null); return; }
    const t = pickAt(p.x, p.y, false);
    if (t) { if (navigator.vibrate) navigator.vibrate(30); beginDrag(p.x, p.y, t, null); }
  }
  function ctxFire() { // apăsare lungă fără mișcare, fără unealtă de desen: meniul de la placă (7.6)
    const hd = hold; hold = null;
    if (h.holdRing) h.holdRing(null);
    const p = hd && ptr.get(hd.id);
    if (!p || p.moved || ptr.size !== 1 || drag) return;
    const t = pickAt(p.x, p.y, false);
    if (t) { if (navigator.vibrate) navigator.vibrate(30); p.moved = true; h.context(t, p.x, p.y); }
  }
  function glide(now) { // inerția mutării cu un deget
    inertia = 0;
    vel.x *= 0.93; vel.y *= 0.93;
    if (Math.hypot(vel.x, vel.y) < 0.4) return;
    camera.pan(vel.x, vel.y);
    inertia = requestAnimationFrame(glide);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (inertia) { cancelAnimationFrame(inertia); inertia = 0; }
    vel = { x: 0, y: 0 };
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, btn: e.button });
    if (ptr.size === 2) { clearHold(); pinched = true; stopDrag(true, e.pointerType === 'touch'); pinch = two(); for (const p of ptr.values()) p.moved = true; return; }
    if (ptr.size > 2) return;
    if (e.pointerType === 'mouse' && e.button !== 0) { if (h.rightClick && h.rightClick()) return; rotMouse = true; return; }
    if (h.wantsDrag()) {
      const t = tileOf(e), touch = e.pointerType === 'touch';
      if (!t) return;
      const dec = startDecision({ touch, fingers: ptr.size, mode: h.touchMode ? h.touchMode() : 'draw', anchor: touch && h.isAnchor ? h.isAnchor(t) : false });
      if (dec === 'draw') beginDrag(e.clientX, e.clientY, t, e);
      else if (dec === 'wait') { clearHold(); hold = { id: e.pointerId, timer: setTimeout(holdFire, HOLD_MS) }; if (h.holdRing) h.holdRing(t); }
    } else if (e.pointerType === 'touch' && h.context) {
      const t = tileOf(e);
      if (t) { clearHold(); hold = { id: e.pointerId, timer: setTimeout(ctxFire, CTX_MS) }; if (h.holdRing) h.holdRing(t); }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') { hoverPx = { x: e.clientX, y: e.clientY }; kick(); } return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) { p.moved = true; clearHold(); }
    if (ptr.size === 2 && pinch) {
      const n = two();
      camera.gesture(h.groundAt, pinch.cx, pinch.cy, n.cx, n.cy, pinch.d / n.d, -(n.a - pinch.a));
      pinch = n;
      return;
    }
    if (ptr.size !== 1) return;
    if (rotMouse) { camera.rotate(-dx * 0.008); return; }
    if (drag) {
      if (e.pointerType === 'mouse' && (e.buttons & 2) && h.rightClick && h.rightClick()) { drag = null; lastPx = null; queue = []; return; } // clic dreapta în timpul trasării = anulează
      lastPx = { x: e.clientX, y: e.clientY }; mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      if (p.moved) {
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
        if (list && list.length) for (const c of list) queue.push({ x: c.clientX, y: c.clientY }); else queue.push(lastPx);
        if (queue.length > 96) queue = queue.slice(-96);
        kick();
      }
      return;
    }
    if (p.moved) { camera.pan(dx, dy); vel.x = vel.x * 0.5 + dx * 0.5; vel.y = vel.y * 0.5 + dy * 0.5; }
  });
  const up = (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    ptr.delete(e.pointerId);
    if (ptr.size < 2) pinch = null;
    if (hold && hold.id === e.pointerId) clearHold();
    if (ptr.size === 0) { const wasPinch = pinched; pinched = false; if (!drag && !wasPinch && p.moved && e.pointerType === 'touch' && !rotMouse && Math.hypot(vel.x, vel.y) > 2 && e.type === 'pointerup') inertia = requestAnimationFrame(glide); }
    if (drag) { mods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }; drain(); drag = null; lastPx = null; h.dragEnd(tileOf(e, true) || lastT, p.moved); return; }
    if (rotMouse && ptr.size === 0) {
      rotMouse = false;
      if (!p.moved && p.btn === 2 && h.context && e.type === 'pointerup') { const t = tileOf(e); if (t) h.context(t, e.clientX, e.clientY); } // clic dreapta fără tragere = meniul
      return;
    }
    if (!p.moved && e.type === 'pointerup' && p.btn === 0) {
      const t = tileOf(e), now = performance.now();
      if (t && e.pointerType === 'touch' && lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { camera.gesture(h.groundAt, e.clientX, e.clientY, e.clientX, e.clientY, 0.6, 0); lastTap = null; return; } // dublu-tap: zoom in pe punct
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      if (t) h.tap(t, e);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { stopDrag(true); up(e); });
  addEventListener('blur', () => { stopDrag(true); ptr.clear(); pinch = null; rotMouse = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.gesture(h.groundAt, e.clientX, e.clientY, e.clientX, e.clientY, Math.exp(e.deltaY * 0.0012), 0);
    if (drag) { lastPx = { x: e.clientX, y: e.clientY }; queue.push(lastPx); kick(); } else { hoverPx = { x: e.clientX, y: e.clientY }; kick(); } // terenul de sub cursor s-a schimbat
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
