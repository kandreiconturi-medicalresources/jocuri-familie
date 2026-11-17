// „Vedere clasică” (izometrică fixă, 4 unghiuri cu pași de 90°) și „vedere 2D” (de sus, nord în sus), ambele aproape ortografice.
// Camera rămâne cea în perspectivă, dar e depărtată de K ori și are FOV mic: așa merg neschimbate alegerea plăcii (raycast) și mișcarea camerei din input/.
import { MathUtils } from 'three';

const K = 10, LOOKS = { classic: { pitch: 0.62, yaw: Math.PI / 4 }, flat: { pitch: 1.5, yaw: 0 } };
export function createClassic(camera) {
  let acc = 0, mode = 'off', step = 0, yaw = Math.PI / 4, pitch = 0.62, goal = yaw, camObj = null, btn = null;
  const fov = camera.fov, eff = 2 * Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) / K) * 180 / Math.PI, near = camera.near, far = camera.far;
  const upd = camera.updateProjectionMatrix.bind(camera), look = camera.lookAt.bind(camera);
  const isOn = () => mode !== 'off';
  camera.updateProjectionMatrix = () => { if (!isOn()) return upd(); camera.fov = eff; upd(); camera.fov = fov; };
  camera.lookAt = (x, y, z) => {
    if (!isOn() || typeof x !== 'number') return look(x, y, z);
    const p = camera.position, d = Math.hypot(p.x - x, p.y - y, p.z - z) * K, cp = Math.cos(pitch);
    camera.position.set(x + d * Math.sin(yaw) * cp, y + d * Math.sin(pitch), z + d * Math.cos(yaw) * cp);
    look(x, y, z);
  };
  const game = () => (window.__trenuri && window.__trenuri.game) || null;
  const cam = () => camObj || (game() && game().camera.cam) || null;
  const apply = () => { const c = cam(), g = game(); if (c) { c.yaw = yaw; c.pitch = pitch; } if (g) g.camera.apply(); };
  /** m: 'off' (3D) | 'classic' | 'flat' (2D). */
  function setMode(m) {
    if (m === mode) return;
    const c = cam(), was = isOn();
    if (m === 'classic') { // rămâne cel mai apropiat unghi de 90°; din 2D sau din 3D
      pitch = LOOKS.classic.pitch;
      if (c && !was) step = Math.round((c.yaw - Math.PI / 4) / (Math.PI / 2));
      goal = yaw = Math.PI / 4 + step * Math.PI / 2;
    } else if (m === 'flat') { pitch = LOOKS.flat.pitch; goal = yaw = 0; }
    else if (c) c.pitch = 0.95;
    mode = m; camera.near = m === 'off' ? near : near * K; camera.far = m === 'off' ? far : far * K;
    camera.updateProjectionMatrix();
    apply();
    ui();
  }
  function ui() {
    if (!btn) return;
    btn.l.style.display = btn.r.style.display = mode === 'classic' ? 'flex' : 'none';
  }
  function mount() {
    const mk = (txt, left, top, title) => {
      const b = document.createElement('button');
      b.textContent = txt; b.title = title; b.setAttribute('aria-label', title);
      b.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:40;width:44px;height:44px;border-radius:14px;border:2px solid rgba(255,255,255,.7);background:rgba(30,50,70,.62);color:#fff;font:22px system-ui;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation`;
      document.body.append(b);
      return b;
    };
    const l = mk('↶', 8, 84, 'Rotește stânga'), r = mk('↷', 58, 84, 'Rotește dreapta');
    l.addEventListener('click', () => { step--; goal = Math.PI / 4 + step * Math.PI / 2; });
    r.addEventListener('click', () => { step++; goal = Math.PI / 4 + step * Math.PI / 2; });
    btn = { l, r };
    ui();
  }
  let n = 0;
  return {
    get K() { return isOn() ? K : 1; }, get on() { return isOn(); }, get mode() { return mode; }, setMode, bind(c) { camObj = c; },
    /** Rotire din mouse / degete / Q-E: în vederea clasică merge în pași de 90° (după ce tragi destul), în 2D liber. */
    turn(a) {
      if (mode === 'flat') { goal = yaw = yaw + a; apply(); return; }
      acc += a;
      if (Math.abs(acc) >= 0.7) { step += acc > 0 ? 1 : -1; acc = 0; goal = Math.PI / 4 + step * Math.PI / 2; }
    },
    set: (v) => setMode(v ? 'classic' : 'off'), toggle: () => setMode(mode === 'classic' ? 'off' : 'classic'),
    /** O dată pe cadru: rotire animată între unghiuri; butoanele se ascund în meniu (demo). */
    tick() {
      if (!btn) mount();
      if ((n++ & 15) === 0) { const ui = document.getElementById('ui'), hide = !!(ui && ui.classList.contains('demo')); for (const b of [btn.l, btn.r]) b.style.visibility = hide ? 'hidden' : ''; }
      if (mode === 'classic' && Math.abs(goal - yaw) > 0.002) { yaw += (goal - yaw) * 0.22; apply(); }
    },
  };
}
