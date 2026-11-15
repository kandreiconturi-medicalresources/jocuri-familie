// Camera care urmărește mașina: netedă, rămâne puțin în urmă la viraj (se simte drift-ul),
// FOV-ul crește cu viteza și mult cu nitro, ușor tremur la nitro.
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createChaseCam(camera) {
  let ang = 0, x = 0, y = 5, z = 0, fov = 60, lookY = 0, ready = false;
  const st = { shake: 0 };
  return {
    snap(car) { ready = false; this.update(car, 1 / 60, 1); },
    update(car, dt, alpha = 1) {
      const px = car.px === undefined ? car.x : car.x + (car.px - car.x) * (1 - alpha);
      const pz = car.pz === undefined ? car.z : car.z + (car.pz - car.z) * (1 - alpha);
      const sp = Math.abs(car.speed), boost = car.boost > 0;
      if (!ready) { ang = car.angle; x = px; z = pz; y = car.y + 5; lookY = car.y; ready = true; }
      // unghiul întârzie față de mașină (mai mult în drift)
      ang += wrapA(car.angle - ang) * (1 - Math.exp(-dt * (car.drift > 0.2 ? 3.2 : 5.5)));
      const dist = 10.5 + sp * 0.1 + (boost ? 2.2 : 0);
      const fx = Math.sin(ang), fz = -Math.cos(ang);
      const tx = px - fx * dist, tz = pz - fz * dist, ty = car.y + 4.8 + sp * 0.025;
      const k = 1 - Math.exp(-dt * 12);
      x = lerp(x, tx, k); z = lerp(z, tz, k); y = lerp(y, ty, 1 - Math.exp(-dt * 4));
      lookY = lerp(lookY, car.y + 1.4, 1 - Math.exp(-dt * 6));
      st.shake = lerp(st.shake, boost ? 1 : 0, 1 - Math.exp(-dt * 8));
      const sx = (Math.random() - 0.5) * 0.18 * st.shake, sy = (Math.random() - 0.5) * 0.12 * st.shake;
      camera.position.set(x + sx, y + sy, z);
      camera.lookAt(px + fx * 10, lookY - 0.7, pz + fz * 10);
      camera.rotateZ(-car.steer * 0.025 - car.drift * 0.035 * Math.sign(car.steer || 1));
      const wantFov = 60 + Math.min(1, sp / 30) * 6 + (boost ? 15 : 0) + car.drift * 2;
      const f = lerp(fov, wantFov, 1 - Math.exp(-dt * (boost ? 7 : 3)));
      if (Math.abs(f - fov) > 0.02) { fov = f; camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    get fov() { return fov; },
  };
}
