// Efectele unei mașini într-un cadru: fum la drift, praf pe iarbă, flacără la nitro, urme pe asfalt.
const rnd = (a) => (Math.random() - 0.5) * a;

export function emitCarFx(fx, car, a, q, frame) {
  const x = car.px === undefined ? car.x : car.px + (car.x - car.px) * a;
  const z = car.pz === undefined ? car.z : car.pz + (car.z - car.pz) * a;
  const fxv = Math.sin(car.angle), fzv = -Math.cos(car.angle), rx = Math.cos(car.angle), rz = Math.sin(car.angle);
  const y = car.y;
  const skip = q === 0 && (frame & 1);
  for (const side of [-1, 1]) {
    const wx = x - fxv * 1.7 + rx * side * 0.95, wz = z - fzv * 1.7 + rz * side * 0.95;
    if (car.drift > 0.35 && !skip) {
      fx.smoke.emit(wx, y + 0.3, wz, rnd(1.5) - fxv * 1.2, 0.8 + Math.random(), rnd(1.5) - fzv * 1.2, 0.8, 1.6, 7, 0.92, 0.92, 0.95, 0.5);
    } else if (car.off && car.speed > 6 && !skip && (frame & 1)) {
      fx.smoke.emit(wx, y + 0.2, wz, rnd(3), 1 + Math.random(), rnd(3), 0.7, 1.2, 5, 0.78, 0.66, 0.45, 0.45);
    }
    if (car.drift > 0.45) fx.skids.add(car.id + side, wx, y, wz, fxv, fzv);
    else fx.skids.stop(car.id + side);
  }
  if (car.boost > 0) {
    const ex = x - fxv * 2.5, ez = z - fzv * 2.5;
    for (let i = 0; i < (q ? 2 : 1); i++) {
      fx.fire.emit(ex + rnd(0.5), y + 0.55, ez + rnd(0.5), -fxv * 9 + rnd(2), rnd(1.5), -fzv * 9 + rnd(2), 0.28, 3.4, 0.4, 1, 0.55, 0.12, 0.95);
    }
    fx.fire.emit(ex, y + 0.55, ez, -fxv * 5, 0, -fzv * 5, 0.18, 1.8, 0.2, 1, 0.95, 0.6, 1);
  }
}
