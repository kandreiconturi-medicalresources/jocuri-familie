// Călători pe peroane (doar vizual, Math.random e permis aici): mulțime în așteptare după pasagerii din gară, oameni care coboară din ușile
// vagoanelor de pasageri spre clădire / pasaj și oameni care urcă. Geometria peroanelor vine din stationLayout.js (aceeași ca la desenare).
import { Group, Quaternion, Matrix4, Vector3, Euler, Color } from 'three';
import { poseAt, travelled, stubPath, cumOf } from './pose.js';
import { layoutOf } from './stationLayout.js';
import { laneOf, sgOf } from './bays.js';
import { walkPath } from './thruLayout.js';
import { makePeopleMeshes, CLOTHES, SKINS } from './peopleGeo.js';
import { look } from './look.js';
import { perf } from '../../../../shared/engine/perf.js';

const MAX = 300, ON_D = 24, OFF_D = 32, CAR_GAP = 250, TAU = Math.PI * 2;
const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
const m4 = new Matrix4(), qq = new Quaternion(), vv = new Vector3(), ss = new Vector3(), ee = new Euler(), cc = new Color();
const turn = (a, b, f) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return a + d * f; };

export function createPeople(s, g, camera) {
  const root = new Group(), { body, skin } = makePeopleMeshes(MAX), P = [], near = new Set(), rec = new Map();
  root.add(body, skin);
  for (let i = 0; i < MAX; i++) P.push({ on: false });
  let mt = 0, time = 0;
  const cap = () => (look.mode === '2d' ? 0 : look.phone || look.cool ? 80 : perf.quality() < 1 ? 40 : MAX);
  const total = () => { let n = 0; for (const p of P) if (p.on) n++; return n; };
  /** Înălțimea peronului clădirii în dreptul lui u (urmărește treptele terenului, ca la desenare). */
  const baseY = (p) => { const L = p.L; if (!L.pieces || p.pl !== L.plats[0]) return p.y0; const pc = L.pieces.find((q) => q.i === Math.round(p.u / L.l)); return pc ? g.tileY(pc.x, pc.y) : p.y0; };
  const clamp = (pl, u) => Math.max(pl.u0, Math.min(pl.u1, u));

  function make(st, L, pl, u, v, delay) {
    const p = P.find((q) => !q.on);
    if (!p) return null;
    Object.assign(p, { on: true, sid: st.id, L, pl, u, v, y0: g.tileY(st.x, st.y), yaw: rnd() * TAU, ph: rnd() * TAU, sc: 0, fade: 0, delay, h: 0.9 + rnd() * 0.2, c: pick(CLOTHES), k: pick(SKINS), pts: null, pi: 0, spd: 0.25, fate: 'idle', rest: rnd() * 3, z: 0, to: null });
    return p;
  }
  const goTo = (p, pts, spd, fate) => { p.pts = pts; p.pi = 0; p.spd = spd; p.fate = fate; p.rest = 0; };
  const rndSpot = (pl) => [pl.u0 + rnd() * (pl.u1 - pl.u0), pl.v + (rnd() - 0.5) * pl.hw * 1.6];
  const wander = (p) => {
    const L = p.L;
    if (L.thru && L.plats.length > 1 && rnd() < 0.18) { // schimbă peronul: pe pasarelă sau prin pasaj
      const q = pick(L.plats.filter((x) => x !== p.pl)), path = walkPath(L.G, p.pl, q, rnd() < 0.4), [u, v] = rndSpot(q);
      goTo(p, [[path[0][0], p.pl.v], ...path, [u, v]], 0.16 + rnd() * 0.06, 'idle'); p.to = q; return;
    }
    const [u, v] = rndSpot(p.pl); goTo(p, [[u, v]], 0.05 + rnd() * 0.04, 'idle');
  };
  /** Drumul spre ieșire: în gara de trecere urcă pe pasarelă (sau coboară în pasaj) și intră în clădire. */
  const exitPts = (pl, u) => (pl.out ? [[pl.out(false)[0][0] + (u - pl.out(false)[0][0]) * 0.2, pl.v], ...pl.out(rnd() < 0.35)] : [pl.exit]);

  function spawnIdle(st, L) {
    const pl = L.multi ? pick(L.plats) : (rnd() < 0.55 || L.plats.length < 2 ? L.plats[0] : pick(L.plats.slice(1)));
    if (!pl) return;
    const [u, v] = rndSpot(pl), p = make(st, L, pl, u, v, 0);
    if (p) p.sc = 0;
  }
  /** Poziția (în u, de-a lungul peronului) a vagonului i (0 = primul după locomotivă). */
  function carU(t, st, L, lane, i) {
    if (L.big && lane > 0) return 1.2 - ((i + 1) * CAR_GAP) / 256; // la fel ca în trains.js (bays)
    if (L.thru && lane > 0) return sgOf(st, t) * ((t.cars * CAR_GAP) / 512 - ((i + 1) * CAR_GAP) / 256);
    const moving = t.path.length > 1, path = moving ? t.path : stubPath(s, st), d = moving ? travelled(s, t) : path.length > 1 ? cumOf(s, path)[1] : 0, o = poseAt(s, g, path, d - (i + 1) * CAR_GAP);
    return (o.x - L.ox) * L.ax + (o.z - L.oz) * L.az;
  }
  function arrive(t, st, L) {
    const lane = L.multi ? laneOf(st, t) : 0; // aceeași linie ca trenul desenat (bays.js)
    const plats = L.plats.filter((pl) => pl.lanes.includes(lane));
    if (!plats.length || total() > cap() - 6) return;
    const idle = P.filter((p) => p.on && p.sid === st.id && p.fate === 'idle' && plats.includes(p.pl));
    for (let i = 0; i < t.cars; i++) {
      if (t.kinds[i] !== 0) continue;
      const cu = carU(t, st, L, lane, i);
      for (let j = 0, n = 2 + ((rnd() * 3) | 0); j < n; j++) { // coboară
        const pl = pick(plats), u = clamp(pl, cu + (rnd() - 0.5) * 0.3);
        if (Math.abs(cu - u) > 0.7) continue;
        const sgn = pl.v > L.lanes[lane] ? 1 : -1, p = make(st, L, pl, u, L.lanes[lane] + sgn * 0.2, rnd() * 0.9 + j * 0.15);
        if (p) goTo(p, [[u + (rnd() - 0.5) * 0.1, pl.v + (rnd() - 0.5) * 0.06], ...(pl.out ? exitPts(pl, u) : [[pl.exit[0] + (rnd() - 0.5) * 0.1, pl.exit[1]]])], 0.2 + rnd() * 0.1, 'gone');
      }
      for (let j = 0; j < 2 && idle.length; j++) { // urcă
        const p = idle.splice((rnd() * idle.length) | 0, 1)[0], sgn = p.pl.v > L.lanes[lane] ? 1 : -1;
        goTo(p, [[clamp(p.pl, cu), L.lanes[lane] + sgn * 0.2]], 0.45, 'gone');
      }
    }
  }
  function manage() {
    const c = cap(), cnt = new Map(), cp = camera.position, k = look.mode === '3d' ? 1 : 0.1; // în vederea clasică/2D camera e depărtată de 10 ori, cu FOV mic
    for (const st of s.stations) {
      const d = k * Math.hypot(cp.x - st.x - 0.5, cp.y, cp.z - st.y - 0.5);
      if (d < ON_D) near.add(st.id); else if (d > OFF_D) near.delete(st.id);
    }
    for (const p of P) if (p.on) { if (!near.has(p.sid) || c === 0) p.on = false; else if (p.fate === 'idle') cnt.set(p.sid, (cnt.get(p.sid) || 0) + 1); }
    let tot = total();
    for (const st of s.stations) {
      if (!near.has(st.id) || st.port || c === 0) continue;
      const L = layoutOf(s, st), pass = st.waiting ? st.waiting.pass | 0 : 0, mx = st.big ? 22 : st.thru ? 10 + 4 * L.plats.length : 6 + 3 * L.plats.length, base = (st.size >= 1 || st.big ? 3 : 1) + 2 * L.plats.length;
      const want = Math.min(mx, Math.max(base, pass > 0 ? 1 + ((pass / 4) | 0) : 0)), n = cnt.get(st.id) || 0;
      if (n < want && tot < c && rnd() < 0.7) { spawnIdle(st, L); tot++; }
      else if (n > want + 1) { const p = P.find((q) => q.on && q.sid === st.id && q.fate === 'idle'); if (p) goTo(p, exitPts(p.pl, p.u), 0.22, 'gone'); }
    }
    const seen = new Set();
    for (const t of s.trains) {
      if (t.state !== 2 || !near.has(t.to)) continue;
      seen.add(t.id);
      if (rec.get(t.id) === t.to) continue;
      rec.set(t.id, t.to);
      const st = s.stations.find((q) => q.id === t.to);
      if (st && !st.port && c > 0) arrive(t, st, layoutOf(s, st));
    }
    for (const id of rec.keys()) if (!seen.has(id)) rec.delete(id);
  }
  function move(p, dt) {
    if (!p.pts) { if (p.fate === 'idle' && (p.rest -= dt) <= 0) wander(p); return false; }
    const q = p.pts[p.pi], qz = q[2] || 0, du = q[0] - p.u, dv = q[1] - p.v, d = Math.hypot(du, dv, (qz - p.z) * 0.5), step = p.spd * dt;
    if (d <= step) {
      p.u = q[0]; p.v = q[1]; p.z = qz;
      if (++p.pi >= p.pts.length) { p.pts = null; if (p.to) { p.pl = p.to; p.to = null; } if (p.fate === 'gone') p.fade = 1; else p.rest = 1 + rnd() * 5; }
      return false;
    }
    p.u += (du / d) * step; p.v += (dv / d) * step; p.z += ((qz - p.z) / d) * step;
    p.yaw = turn(p.yaw, Math.atan2(p.L.ax * du + p.L.bx * dv, p.L.az * du + p.L.bz * dv), Math.min(1, dt * 10));
    return true;
  }

  return {
    root,
    update(dt) {
      time += dt;
      const c = cap();
      root.visible = c > 0;
      if (c === 0) { for (const p of P) p.on = false; return; }
      if ((mt -= dt) <= 0) { mt = 0.25; manage(); }
      let nb = 0;
      for (const p of P) {
        if (!p.on) continue;
        if (p.delay > 0) { p.delay -= dt; continue; }
        const walking = move(p, dt);
        if (p.fade > 0) { p.sc -= dt * 3; if (p.sc <= 0) { p.on = false; continue; } } else if (p.sc < 1) p.sc = Math.min(1, p.sc + dt * 4);
        const L = p.L, sw = Math.sin(time * 9 + p.ph), s0 = p.sc * p.h * 1.5;
        vv.set(L.ox + L.ax * p.u + L.bx * p.v, baseY(p) + p.pl.top + p.z + (walking ? Math.abs(sw) * 0.007 : 0), L.oz + L.az * p.u + L.bz * p.v);
        qq.setFromEuler(ee.set(0, p.yaw, walking ? sw * 0.07 : 0));
        m4.compose(vv, qq, ss.set(s0, s0, s0));
        body.setMatrixAt(nb, m4); skin.setMatrixAt(nb, m4);
        body.setColorAt(nb, cc.set(p.c)); skin.setColorAt(nb, cc.set(p.k));
        nb++;
      }
      body.count = skin.count = nb;
      body.instanceMatrix.needsUpdate = skin.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) { body.instanceColor.needsUpdate = true; skin.instanceColor.needsUpdate = true; }
    },
  };
}
