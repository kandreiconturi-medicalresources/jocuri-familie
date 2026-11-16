// Planificatorul pe hartă: plăcile traseului colorate (existentă / nouă / pod / tunel / nivelare) și numerele 1, 2, 3 cu linia punctată.
import { K } from '../sim/tracePlan.js';

const COL = { link: '#5bd66f', new: '#ffd23f', [K.BRIDGE]: '#4aa8e8', [K.TUNNEL]: '#c9985a', [K.LEVEL]: '#ff9f43', [K.CLEAR]: '#8fd36f', [K.DETOUR]: '#ffd23f', [K.BAD]: '#ff5a6a' };

/** env: { overlay(), marks }. Fără plan: golește harta. */
export function drawPlan(env, plan) {
  const ov = env.overlay && env.overlay();
  if (!plan) { if (ov) ov.clear(); env.marks.clear(); return; }
  const m = new Map(), w = 4096, put = (x, y, color) => m.set(y * w + x, { x, y, color });
  for (const l of plan.legs) {
    if (l.link) for (const [x, y] of l.link) put(x, y, COL.link);
    else if (l.plan) l.plan.tiles.forEach(([x, y], k) => put(x, y, COL[l.plan.kind[k]] || COL.new));
  }
  for (const x of plan.stops) if (x.spot) put(x.spot.x, x.spot.y, '#ffffff');
  if (ov) ov.set([...m.values()].slice(0, 690));
  env.marks.set(plan.stops.filter((x) => x.spot).map((x) => ({ x: x.spot.x, y: x.spot.y })));
}

/** Câte poduri, tunele, nivelări și defrișări are șina nouă: [{ icon, text }]. */
export function kindsText(plan) {
  const n = { [K.BRIDGE]: 0, [K.TUNNEL]: 0, [K.LEVEL]: 0, [K.CLEAR]: 0 };
  for (const l of plan.legs) if (l.plan) for (const r of l.plan.runs) if (r.kind in n) n[r.kind]++;
  const out = [];
  if (n[K.BRIDGE]) out.push(`🌉 ${n[K.BRIDGE]} ${n[K.BRIDGE] === 1 ? 'pod' : 'poduri'}`);
  if (n[K.TUNNEL]) out.push(`🕳️ ${n[K.TUNNEL]} ${n[K.TUNNEL] === 1 ? 'tunel' : 'tunele'}`);
  if (n[K.LEVEL]) out.push('⛏️ nivelare');
  if (n[K.CLEAR]) out.push('🌲 defrișare');
  return out;
}
