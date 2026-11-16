// „Vedere clasică”: izometrică fixă (aproape ortografică), 4 unghiuri cu pași de 90°. Camera rămâne cea în perspectivă,
// dar e depărtată de K ori și are FOV mic: așa merg neschimbate alegerea plăcii (raycast) și mișcarea camerei din input/.
import { MathUtils } from 'three';

const PITCH = 0.62, K = 10;
export function createClassic(camera) {
  let on = false, step = 0, yaw = Math.PI / 4, goal = yaw, camObj = null, btn = null;
  const fov = camera.fov, eff = 2 * Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) / K) * 180 / Math.PI, near = camera.near, far = camera.far;
  const upd = camera.updateProjectionMatrix.bind(camera), look = camera.lookAt.bind(camera);
  camera.updateProjectionMatrix = () => { if (!on) return upd(); camera.fov = eff; upd(); camera.fov = fov; };
  camera.lookAt = (x, y, z) => {
    if (!on || typeof x !== 'number') return look(x, y, z);
    const p = camera.position, d = Math.hypot(p.x - x, p.y - y, p.z - z) * K, cp = Math.cos(PITCH);
    camera.position.set(x + d * Math.sin(yaw) * cp, y + d * Math.sin(PITCH), z + d * Math.cos(yaw) * cp);
    look(x, y, z);
  };
  const game = () => (window.__trenuri && window.__trenuri.game) || null;
  const cam = () => camObj || (game() && game().camera.cam) || null;
  const apply = () => { const c = cam(), g = game(); if (c) { c.yaw = yaw; c.pitch = PITCH; } if (g) g.camera.apply(); };
  function set(v) {
    if (v === on) return;
    const c = cam(), g = game();
    if (v && c) { step = Math.round((c.yaw - Math.PI / 4) / (Math.PI / 2)); goal = yaw = Math.PI / 4 + step * Math.PI / 2; }
    else if (!v && c) c.pitch = 0.95;
    on = v; camera.near = v ? near * K : near; camera.far = v ? far * K : far;
    camera.updateProjectionMatrix();
    apply();
    ui();
  }
  function ui() {
    if (!btn) return;
    btn.cls.classList.toggle('on', on);
    btn.l.style.display = btn.r.style.display = on ? 'flex' : 'none';
  }
  function mount() {
    const mk = (txt, left, top, title) => {
      const b = document.createElement('button');
      b.textContent = txt; b.title = title; b.setAttribute('aria-label', title);
      b.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:40;width:44px;height:44px;border-radius:14px;border:2px solid rgba(255,255,255,.7);background:rgba(30,50,70,.62);color:#fff;font:22px system-ui;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation`;
      document.body.append(b);
      return b;
    };
    const cls = mk('🧊', 8, 84, 'Vedere clasică'), l = mk('↶', 58, 84, 'Rotește stânga'), r = mk('↷', 108, 84, 'Rotește dreapta');
    cls.addEventListener('click', () => set(!on));
    l.addEventListener('click', () => { step--; goal = Math.PI / 4 + step * Math.PI / 2; });
    r.addEventListener('click', () => { step++; goal = Math.PI / 4 + step * Math.PI / 2; });
    cls.style.background = 'rgba(30,50,70,.62)';
    btn = { cls, l, r };
    cls.classList.add('classicbtn');
    const st = document.createElement('style');
    st.textContent = '.classicbtn.on{background:#e8a33a!important;color:#222!important}';
    document.head.append(st);
    ui();
  }
  let n = 0;
  return {
    get K() { return on ? K : 1; }, get on() { return on; }, set, toggle: () => set(!on), bind(c) { camObj = c; },
    /** O dată pe cadru: rotire animată între unghiuri; butoanele se ascund în meniu (demo). */
    tick() {
      if (!btn) mount();
      if ((n++ & 15) === 0) { const ui = document.getElementById('ui'), hide = !!(ui && ui.classList.contains('demo')); for (const b of [btn.cls, btn.l, btn.r]) if (hide) b.style.visibility = 'hidden'; else b.style.visibility = ''; }
      if (on && Math.abs(goal - yaw) > 0.002) { yaw += (goal - yaw) * 0.22; apply(); }
    },
  };
}
