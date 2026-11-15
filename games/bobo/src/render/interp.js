// Interpolare între pașii fizici (60 Hz) și cadrul ecranului: elimină tremuratul pe monitoare de 75/120/144 Hz.
// Poziția desenată = lerp(prev, cur, alpha), apoi aliniată la pixelul de ecran cu ACEEAȘI regulă pentru cameră și pentru toți actorii,
// așa că diferența (actor − cameră) e mereu multiplu de pixel și nu mai oscilează ±1 px față de fundal.
const JUMP = 80; // salt mai mare (respawn, teleport, snap de cameră) = fără interpolare

/** Se cheamă înainte de fiecare pas de simulare. */
export function snapshot(g) {
  const keep = (o) => { o.px = o.x; o.py = o.y; };
  g.players.forEach(keep); g.enemies.forEach(keep); g.platforms.forEach(keep); g.bullets.forEach(keep);
  if (g.boss) keep(g.boss);
  g.cam.px = g.cam.x;
}

const lerp = (a, b, k) => (a === undefined || Math.abs(b - a) > JUMP ? b : a + (b - a) * k);

/** Pune pozițiile interpolate (și aliniate la pixel) în obiecte; întoarce { camX, restore }. */
export function applyInterp(g, alpha, scale) {
  const q = (v) => Math.round(v * scale) / scale;
  const cams = g.cam.x;
  const camX = q(lerp(g.cam.px, g.cam.x, alpha));
  const list = [g.players, g.enemies, g.platforms, g.bullets];
  const set = (o) => { o.sx = o.x; o.sy = o.y; o.x = q(lerp(o.px, o.x, alpha)); o.y = q(lerp(o.py, o.y, alpha)); };
  for (const l of list) for (const o of l) set(o);
  if (g.boss) set(g.boss);
  const restore = () => {
    for (const l of list) for (const o of l) { o.x = o.sx; o.y = o.sy; }
    if (g.boss) { g.boss.x = g.boss.sx; g.boss.y = g.boss.sy; }
    g.cam.x = cams;
  };
  return { camX, restore };
}
