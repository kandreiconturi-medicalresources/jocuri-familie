// Rețea: fiecare client își simulează mașina și trimite starea de 15 ori/s; gazda simulează și boții.
// Mașinile îndepărtate se mișcă prin „dead reckoning” + corecție lină. Gazda decide și clasamentul final.
import { createBot } from '../sim/ai.js';
import { rng } from '../../../../shared/engine/rng.js';

const SEND_MS = 1000 / 15;
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;

export function createSync({ rooms, you, host, race }) {
  let acc = 0;
  const target = {};
  const onResult = [];

  const mine = () => race.cars.filter((c) => (host && c.bot && !c.remote) || c.id === you);
  const pack = (c) => [c.id, r1(c.x), r1(c.z), r3(c.angle), r1(c.vx), r1(c.vz), r1(c.speed), r3(c.steer), r3(c.drift), c.boost > 0 ? 1 : 0, r3(c.nitro), r1(c.maxProg), r1(c.prog)];

  return {
    /** Se cheamă la fiecare pas de simulare (dt în secunde). */
    tick(dt) {
      acc += dt * 1000;
      if (acc >= SEND_MS) { acc = 0; rooms.send({ k: 's', c: mine().map(pack) }); }
      for (const car of race.cars) { // mașinile îndepărtate urmăresc ținta
        const t = target[car.id];
        if (!car.remote || !t) continue;
        t.x += t.vx * dt; t.z += t.vz * dt;
        const k = Math.min(1, dt * 10);
        car.x += (t.x - car.x) * k; car.z += (t.z - car.z) * k;
        let da = t.a - car.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
        car.angle += da * k;
        car.vx = t.vx; car.vz = t.vz; car.speed = t.sp; car.steer = t.st; car.drift = t.dr; car.boost = t.bo ? 0.2 : 0; car.nitro = t.ni;
        if (t.mp > car.maxProg) car.maxProg = t.mp;
        car.prog = t.p;
        const q = race.track.query(car.x, car.z, car.i);
        car.i = q.i; car.s = q.s; car.y = q.y; car.d = q.d; car.off = Math.abs(q.d) > 5;
      }
    },
    onMsg(m) {
      const d = m.d;
      if (!d) return;
      if (d.k === 's' && Array.isArray(d.c)) {
        for (const a of d.c) {
          const car = Array.isArray(a) && race.byId[a[0]];
          if (!car || !car.remote || a.length < 13) continue;
          const first = !target[a[0]];
          target[a[0]] = { x: +a[1], z: +a[2], a: +a[3], vx: +a[4], vz: +a[5], sp: +a[6], st: +a[7], dr: +a[8], bo: a[9], ni: +a[10], mp: +a[11], p: +a[12] };
          if (first) { car.x = +a[1]; car.z = +a[2]; car.angle = +a[3]; }
        }
      } else if (d.k === 'res' && Array.isArray(d.ids)) onResult.forEach((f) => f(d.ids));
    },
    /** Gazda trimite clasamentul final. */
    sendResult() { if (host) rooms.send({ k: 'res', ids: race.order.slice() }); },
    onResult(f) { onResult.push(f); },
    /** Lista de jucători din cameră s-a schimbat: cine a ieșit devine bot. */
    setRoom(players) {
      const ids = new Set(players.map((p) => p.id));
      for (const car of race.cars) {
        if (car.bot || car.id === you || ids.has(car.id)) continue;
        car.bot = true;
        if (host) { car.remote = false; race.bots[car.id] = createBot('mid', rng(7).next); car.capMul = 0.9; }
      }
    },
  };
}
