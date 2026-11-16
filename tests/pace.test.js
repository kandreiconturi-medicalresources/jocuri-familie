import test from 'node:test';
import assert from 'node:assert/strict';
import { isPhoneLike, capFps, dprCap, simStepCap, loopStepCap, createPacer, renderNeeded } from '../shared/engine/pace.js';
import { stepAccumulator } from '../shared/engine/loop.js';
import { createPerf } from '../shared/engine/perf.js';

test('telefon sau tabletă: atingere + ecran mic, sau agent mobil', () => {
  assert.equal(isPhoneLike({ coarse: true, w: 568, h: 320 }), true); // iPhone SE 1
  assert.equal(isPhoneLike({ coarse: true, w: 1024, h: 768 }), true); // iPad 5
  assert.equal(isPhoneLike({ coarse: false, w: 1920, h: 1080 }), false);
  assert.equal(isPhoneLike({ coarse: true, w: 1920, h: 1080 }), false); // ecran tactil mare
  assert.equal(isPhoneLike({ ua: 'Mozilla/5.0 (Linux; Android 12) Mobile Safari' }), true);
  assert.equal(isPhoneLike({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', touchPoints: 5, w: 1024, h: 768 }), true); // iPad nou
  assert.equal(isPhoneLike({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', touchPoints: 0 }), false);
});

test('plafon de cadre, DPR și pași', () => {
  assert.equal(capFps({}), 60);
  assert.equal(capFps({ phone: true }), 30);
  assert.equal(capFps({ phone: true, cool: true }), 24);
  assert.equal(dprCap({ phone: true, quality: 2 }), 1.25);
  assert.equal(dprCap({ phone: true, cool: true }), 1);
  assert.equal(dprCap({ quality: 2 }), 2);
  assert.equal(dprCap({ quality: 0 }), 1);
  assert.ok(simStepCap({ phone: true }) < simStepCap({}));
  assert.ok(loopStepCap({ phone: true }) < loopStepCap({}));
});

const drawn = (cap, hz, secs = 5) => {
  const p = createPacer(cap); let n = 0;
  for (let t = 0; t < secs * 1000; t += 1000 / hz) if (p.due(t)) n++;
  return n / secs;
};
test('ritmul: 30, 24 și 60 fps pe un ecran de 60 Hz, 60 pe unul de 144 Hz', () => {
  assert.ok(Math.abs(drawn(30, 60) - 30) <= 1, String(drawn(30, 60)));
  assert.ok(Math.abs(drawn(24, 60) - 24) <= 1.5, String(drawn(24, 60)));
  assert.ok(Math.abs(drawn(60, 60) - 60) <= 1);
  assert.ok(Math.abs(drawn(60, 144) - 60) <= 4, String(drawn(60, 144)));
});

test('ritmul: după o pauză lungă nu se desenează în rafală', () => {
  const p = createPacer(30);
  assert.equal(p.due(0), true);
  assert.equal(p.due(5000), true);
  assert.equal(p.due(5001), false);
  assert.equal(p.due(5010), false);
  assert.equal(p.due(5040), true);
});

test('desenare doar la schimbare: pauză + cameră nemișcată = nu, cu bătaie rară', () => {
  const base = { now: 100, drawnAt: 0, running: false, camMoved: false, wokeAt: -1e9 };
  assert.equal(renderNeeded(base), false);
  assert.equal(renderNeeded({ ...base, running: true }), true);
  assert.equal(renderNeeded({ ...base, camMoved: true }), true);
  assert.equal(renderNeeded({ ...base, wokeAt: 0 }), true); // atingere recentă
  assert.equal(renderNeeded({ ...base, wokeAt: -2000 }), false);
  assert.equal(renderNeeded({ ...base, now: 1000 }), true); // bătaia rară
});

test('pași de simulare: un cadru lent la 4× nu se adună în spirală', () => {
  const r = stepAccumulator(0, 0.25, 1 / 60, loopStepCap({ phone: true }));
  assert.equal(r.steps, 2);
  assert.equal(r.acc, 0);
});

test('calitatea adaptivă ține cont de plafonul de cadre (30 fps nu e „lent”)', () => {
  const p = createPerf(null), q0 = p.quality();
  p.setCap(30);
  for (let i = 0; i < 400; i++) p.tick(33.3); // 30 fps timp de ~13 s
  assert.equal(p.quality(), q0);
  const p2 = createPerf(null);
  for (let i = 0; i < 400; i++) p2.tick(33.3); // fără plafon, 30 fps = lent
  assert.ok(p2.quality() < q0);
});

test('spuma la mal: doar lângă uscat, mai multă la țărm', async () => {
  const { foamMap } = await import('../games/trenuri/src/render/foam.js');
  const { createWorld } = await import('../games/trenuri/src/sim/index.js');
  const s = createWorld({ seed: 6, size: 'S', map: 'islands', year: 1950, ai: [1] });
  const m = foamMap(s);
  assert.equal(m.length, s.w * s.h);
  let near = 0, far = 0, wet = 0;
  for (let y = 3; y < s.h - 3; y++) for (let x = 3; x < s.w - 3; x++) {
    const i = y * s.w + x;
    if (!s.water[i]) continue;
    let land = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!s.water[(y + dy) * s.w + x + dx]) land++;
    if (land === 0) { far++; assert.equal(m[i], 0); } else { near++; wet += m[i] > 0 ? 1 : 0; }
  }
  assert.ok(near > 0 && far > 0 && wet === near);
});
