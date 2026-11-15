// Fizică arcade a mașinii, la pas fix (60 Hz). Pur: fără Three/DOM.
// Unghiul: 0 = nord (-z), pozitiv = spre dreapta (est). Înainte = (sin a, -cos a), dreapta = (cos a, sin a).
import { V_TOP } from '../tracks/track.js';

export const CAR = {
  acc: 15, brake: 36, reverse: 8, coast: 3.5,
  boostMul: 1.4, boostTime: 1.5, nitroMin: 0.25, nitroDrift: 0.45, nitroIdle: 0.03,
  roadLimit: 5.0,      // în afara lui: iarbă/nisip (încetinește)
  wall: 13,            // marginea „moale”: te împinge înapoi, fără blocaje
  radius: 1.9, stuckTime: 3,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

export const NO_INPUT = { steer: 0, throttle: 0, brake: 0, drift: false, nitro: false, reset: false };

/** Câtă viraj (rad/s) are mașina la viteza `sp`: mare la viteză mică, mai mic la viteză mare. */
export const turnRate = (sp) => Math.min(1, sp / 3.5) * (2.9 - 1.5 * clamp((sp - 8) / 22, 0, 1));

export function createCar(id, slot, track) {
  return {
    id, x: slot.x, z: slot.z, y: 0, angle: slot.angle, vx: 0, vz: 0, speed: 0, slip: 0,
    steer: 0, drift: 0, nitro: 0, boost: 0, off: false, wrong: false,
    lap: 0, cp: 0, finished: false, finishT: 0, prog: -(track.length - slot.s), maxProg: -(track.length - slot.s),
    i: slot.i, s: slot.s, d: 0, stuck: 0, wrongT: 0, np: false, bump: 0,
  };
}

/** Pune mașina înapoi pe linia centrală (aproape de unde era), cu fața în sensul pistei. */
export function respawn(car, track) {
  const q = track.query(car.x, car.z, car.i, 40);
  const p = track.pts[q.i];
  const dsw = ((p.s - car.s + track.length * 1.5) % track.length) - track.length / 2;
  car.prog += Math.abs(dsw) < 90 ? dsw : 0;
  car.x = p.x; car.z = p.z; car.y = p.y; car.angle = Math.atan2(p.tx, -p.tz);
  car.vx = car.vz = car.speed = car.slip = 0;
  car.boost = 0; car.drift = 0; car.i = q.i; car.s = p.s; car.d = 0; car.stuck = 0; car.wrongT = 0; car.off = false;
}

export function stepCar(car, c, track, dt, go = true) {
  const q = track.query(car.x, car.z, car.i);
  car.i = q.i; car.d = q.d; car.y = q.y;
  car.off = Math.abs(q.d) > CAR.roadLimit;
  if (c.reset) { respawn(car, track); return; }

  // direcția cu 2 secunde de răbdare: dacă mergi invers pe pistă
  const heading = Math.sin(car.angle) * q.tx + -Math.cos(car.angle) * q.tz;
  car.wrong = heading < -0.35 && car.speed > 3;

  car.steer += (clamp(c.steer, -1, 1) - car.steer) * Math.min(1, dt * 10);

  // 1) rotește caroseria
  let fx = Math.sin(car.angle), fz = -Math.cos(car.angle);
  let u = car.vx * fx + car.vz * fz;
  const want = c.drift && Math.abs(car.steer) > 0.3 && u > 12 && !car.off;
  car.drift = want ? Math.min(1, car.drift + dt * 5) : Math.max(0, car.drift - dt * 4);
  car.angle += turnRate(Math.abs(u)) * car.steer * (u < -0.5 ? -1 : 1) * (1 + 0.3 * car.drift) * dt;
  car.angle = ((car.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  fx = Math.sin(car.angle); fz = -Math.cos(car.angle);
  const rx = Math.cos(car.angle), rz = Math.sin(car.angle);

  // 2) viteza: înainte (u) și lateral (w) față de noua direcție
  u = car.vx * fx + car.vz * fz;
  let w = car.vx * rx + car.vz * rz;

  // nitro: o apăsare folosește tot ce s-a strâns (1,5 s când e plin)
  if (c.nitro && !car.np && go && car.nitro >= CAR.nitroMin && car.boost <= 0) {
    car.boost = car.nitro * CAR.boostTime; car.nitro = 0; car.nitroHit = true;
  }
  car.np = c.nitro;
  if (car.boost > 0) car.boost -= dt;
  const boosting = car.boost > 0;
  const cap = V_TOP * (car.off ? 0.45 : 1) * (boosting ? CAR.boostMul : 1) * (car.capMul || 1);

  if (go) {
    if (c.throttle > 0) u += CAR.acc * (boosting ? 2.4 : 1) * c.throttle * clamp(1 - u / cap, 0, 1) * dt;
    if (c.brake > 0) u = u > 0.5 ? Math.max(0, u - CAR.brake * c.brake * dt) : Math.max(-CAR.reverse, u - 14 * c.brake * dt);
    else if (c.throttle <= 0) u -= Math.sign(u) * Math.min(Math.abs(u), CAR.coast * dt);
  }
  if (u > cap) u -= (u - cap) * Math.min(1, dt * 2);
  if (car.off) u -= u * 1.4 * dt;
  w *= Math.exp(-(car.off ? 5 : 11 - 9.7 * car.drift) * dt);

  car.vx = fx * u + rx * w; car.vz = fz * u + rz * w;
  car.speed = u; car.slip = w;

  // nitro se umple din drift (și puțin singur, când accelerezi)
  if (go) car.nitro = Math.min(1, car.nitro + dt * (CAR.nitroDrift * car.drift * Math.abs(car.steer) + (c.throttle > 0.5 ? CAR.nitroIdle : 0)));

  car.x += car.vx * dt; car.z += car.vz * dt;

  // marginea moale: împinge ușor înapoi, nu blochează
  const ad = Math.abs(q.d);
  if (ad > CAR.wall) {
    const sg = Math.sign(q.d), nx = -q.tz * sg, nz = q.tx * sg;
    const over = ad - CAR.wall;
    car.x -= nx * over * 0.35; car.z -= nz * over * 0.35;
    const vo = car.vx * nx + car.vz * nz;
    if (vo > 0) { car.vx -= nx * vo * 0.8; car.vz -= nz * vo * 0.8; }
  }

  // blocat sau pe contrasens: după 3 s te pune singur pe pistă
  if (go) {
    car.stuck = Math.abs(u) < 1.5 && !car.finished ? car.stuck + dt : 0;
    car.wrongT = car.wrong ? car.wrongT + dt : 0;
    if (car.stuck > CAR.stuckTime || car.wrongT > 5) respawn(car, track);
  }

  // progres de-a lungul pistei (nu se poate trișa mergând înapoi: contează doar maximul)
  const q2 = track.query(car.x, car.z, car.i);
  let dsd = q2.s - car.s;
  if (dsd > track.length / 2) dsd -= track.length; else if (dsd < -track.length / 2) dsd += track.length;
  if (Math.abs(dsd) < 4) car.prog += dsd;
  car.s = q2.s; car.i = q2.i;
  if (car.prog > car.maxProg) car.maxProg = car.prog;
}

/** Ciocniri între mașini: cercuri simple cu împingere ușoară. Întoarce intensitatea cea mai mare. */
export function collide(cars, track) {
  let hit = 0;
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a], B = cars[b];
      if (Math.abs(A.y - B.y) > 2.5) continue; // pod peste drum
      const dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz, m = CAR.radius * 2;
      if (d2 >= m * m || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = (m - d) * 0.5;
      A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
      const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz; // viteza de apropiere (negativă)
      if (rv < 0) {
        const j = -rv * 0.4;
        A.vx -= nx * j; A.vz -= nz * j; B.vx += nx * j; B.vz += nz * j;
        hit = Math.max(hit, -rv);
        A.bump = B.bump = Math.max(A.bump, -rv);
      }
    }
  }
  return hit;
}
