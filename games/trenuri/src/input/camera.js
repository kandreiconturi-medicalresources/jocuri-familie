// Cameră de hartă: un deget/mouse trage, două degete = zoom + rotire (+ mișcare), rotița, WASD/săgeți, Q/E.
import { Vector3, MathUtils } from 'three';

const PITCH = 0.95;
export function createCamera(stage, size) {
  const cam = { x: size.w / 2, z: size.h / 2, dist: Math.max(size.w, size.h) * 0.55, yaw: 0.6, pitch: PITCH };
  const keys = new Set(), lim = { min: 7, max: Math.max(size.w, size.h) * 1.15 };
  let bounds = { w: size.w, h: size.h };

  function apply() {
    cam.dist = MathUtils.clamp(cam.dist, lim.min, lim.max);
    cam.x = MathUtils.clamp(cam.x, 0, bounds.w); cam.z = MathUtils.clamp(cam.z, 0, bounds.h);
    const c = stage.camera, cp = Math.cos(cam.pitch);
    c.position.set(cam.x + cam.dist * Math.sin(cam.yaw) * cp, cam.dist * Math.sin(cam.pitch), cam.z + cam.dist * Math.cos(cam.yaw) * cp);
    c.lookAt(cam.x, 0, cam.z);
  }
  const perPx = () => (2 * cam.dist * Math.tan(MathUtils.degToRad(stage.camera.fov) / 2)) / innerHeight;
  const api = {
    cam,
    setWorld(w, h) { bounds = { w, h }; lim.max = Math.max(w, h) * 1.15; },
    focus(x, z, dist) { cam.x = x; cam.z = z; if (dist) cam.dist = dist; apply(); },
    pan(dx, dy) { // deplasarea degetului în pixeli: conținutul urmează degetul
      const k = perPx(), s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      cam.x += -c * dx * k + (-s) * dy * k / Math.sin(cam.pitch);
      cam.z += s * dx * k + (-c) * dy * k / Math.sin(cam.pitch);
      apply();
    },
    rotate(a) { cam.yaw += a; apply(); },
    zoom(f) { cam.dist *= f; apply(); },
    update(dt) {
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx += 1; if (keys.has('d') || keys.has('arrowright')) mx -= 1;
      if (keys.has('w') || keys.has('arrowup')) my += 1; if (keys.has('s') || keys.has('arrowdown')) my -= 1;
      if (mx || my) api.pan(mx * dt * 600, my * dt * 600);
      if (keys.has('q')) api.rotate(-dt * 1.4); if (keys.has('e')) api.rotate(dt * 1.4);
      if (keys.has('+') || keys.has('=')) api.zoom(1 - dt * 1.5); if (keys.has('-')) api.zoom(1 + dt * 1.5);
    },
    apply,
    keys,
    /** Raza prin pixelul (px,py) intersectată cu terenul: { fx, fz } sau null. */
    pick(px, py, at) {
      const c = stage.camera, v = new Vector3((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1, 0.5).unproject(c);
      const o = c.position, dx = v.x - o.x, dy = v.y - o.y, dz = v.z - o.z, len = Math.hypot(dx, dy, dz);
      const ux = dx / len, uy = dy / len, uz = dz / len;
      let t = 0, prev = 0;
      for (let i = 0; i < 400; i++) {
        t += 0.5;
        const x = o.x + ux * t, y = o.y + uy * t, z = o.z + uz * t;
        if (y <= at(x, z) + 0.001) {
          let lo = prev, hi = t;
          for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (o.y + uy * m <= at(o.x + ux * m, o.z + uz * m)) hi = m; else lo = m; }
          return { fx: o.x + ux * hi, fz: o.z + uz * hi };
        }
        prev = t;
      }
      return null;
    },
  };
  addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') keys.add(e.key.toLowerCase()); });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  apply();
  return api;
}
