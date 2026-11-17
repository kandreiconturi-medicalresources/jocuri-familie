// Locomotive cu abur procedurale: cazan cu inele de alamă, cămin, dom, cabină cu geamuri, roți cu biele, tender.
import { PAL, slab, cyl, wheel, prism, sym, loft, lamp } from './trainKit.js';

// Variante: mic (0-4-0 fără tender), abur (2-4-0 cu tender), rapid (4-6-0 cu roți mari, tender lung, apărătoare).
export const STEAM = {
  mic: { nd: 2, wr: 0.22, br: 0.3, by: 0.62, tender: false, body: '#2c3a34', stack: 0.3, zf: 1.25, zc: 0.1 },
  abur: { nd: 3, wr: 0.25, br: 0.34, by: 0.7, tender: true, body: '#2b2f3a', stack: 0.34, zf: 1.28, zc: 0.1 },
  rapid: { nd: 3, wr: 0.31, br: 0.37, by: 0.78, tender: true, body: '#1f2a44', stack: 0.38, zf: 1.3, zc: 0.0, cow: true, long: true },
};

function tender(B, c, o) {
  const z0 = -1.3, z1 = o.long ? -0.38 : -0.46, zm = (z0 + z1) / 2, hl = (z1 - z0) / 2;
  slab(B, 0, 0.36, zm, 0.46, 0.05, hl, PAL.dark);
  slab(B, 0, 0.62, zm, 0.43, 0.2, hl - 0.02, o.body);
  slab(B, 0, 0.7, zm, 0.445, 0.035, hl - 0.02, c); // dungă în culoarea companiei
  slab(B, 0, 0.9, zm - 0.02, 0.4, 0.04, hl - 0.06, PAL.steel); // buza vasului de cărbune
  slab(B, 0, 0.97, zm - 0.04, 0.3, 0.06, hl - 0.2, '#15161a'); // cărbune
  prism(B, [[-0.31, 0.99], [-0.18, 1.1], [0.18, 1.1], [0.31, 0.99]], z0 + 0.14, z1 - 0.08, '#202226', 0);
  for (const zz of [z0 + 0.25, z1 - 0.25]) for (const s of [-1, 1]) wheel(B, s * 0.41, zz, 0.2, s, PAL.steel, PAL.silver, 8);
  slab(B, 0, 0.3, z0 - 0.04, 0.4, 0.05, 0.03, PAL.dark);
  for (const s of [-1, 1]) slab(B, s * 0.26, 0.3, z0 - 0.1, 0.05, 0.04, 0.04, PAL.silver);
}

export function steam(B, L, c, key) {
  const o = STEAM[key], { wr, br, by, zf, zc } = o, zb = o.tender ? -0.38 : -0.8;
  // șasiu și apărători
  slab(B, 0, wr + 0.12, (zf + zb) / 2, 0.38, 0.05, (zf - zb) / 2, PAL.dark);
  for (const s of [-1, 1]) slab(B, s * 0.4, wr + 0.1, (zf + zb) / 2 + 0.02, 0.025, 0.07, (zf - zb) / 2 - 0.02, PAL.iron);
  // cazan: corp, cutie de fum, inele
  const front = zf - 0.3;
  cyl(B, [0, by, zc + 0.05], [0, by, front], br, br, 14, o.body, 1);
  cyl(B, [0, by, front], [0, by, zf], br * 1.03, br * 1.03, 14, '#17191d', 3);
  for (const zz of [front - 0.18, front - 0.6, (front + zc) / 2 - 0.3].filter((q) => q > zc + 0.1)) cyl(B, [0, by, zz - 0.03], [0, by, zz + 0.03], br * 1.045, br * 1.045, 14, PAL.brass, 0);
  cyl(B, [0, by, zf], [0, by, zf + 0.012], br * 0.5, br * 0.5, 10, PAL.steel, 2);
  lamp(L, 0, by + br + 0.1, zf + 0.04, 0.06, 0.05); slab(B, 0, by + br + 0.05, zf - 0.04, 0.07, 0.07, 0.05, PAL.dark);
  // horn, dom de nisip, dom de abur
  const cx = zf - 0.2;
  cyl(B, [0, by + br * 0.85, cx], [0, by + br + o.stack, cx], 0.075, 0.075, 10, '#111215', 0);
  cyl(B, [0, by + br + o.stack - 0.02, cx], [0, by + br + o.stack + 0.05, cx], 0.075, 0.12, 10, '#111215', 2);
  cyl(B, [0, by + br * 0.9, front - 0.7], [0, by + br + 0.17, front - 0.7], 0.12, 0.09, 10, PAL.brass, 2);
  cyl(B, [0, by + br * 0.9, front - 1.05], [0, by + br + 0.12, front - 1.05], 0.09, 0.07, 8, PAL.silver, 2);
  // cabină: pereți, geamuri, acoperiș cu streașină
  const cl = zc - zb, cz = (zc + zb) / 2 + 0.04;
  slab(B, 0, 0.67, cz, 0.43, 0.3, cl / 2 + 0.04, o.body);
  slab(B, 0, 0.55, cz, 0.44, 0.04, cl / 2 + 0.04, c);
  prism(B, sym([[0.46, 1.0], [0.4, 1.1], [0.17, 1.15]]), zb - 0.1, zc + 0.18, '#25272c');
  for (const s of [-1, 1]) {
    slab(B, s * 0.432, 0.82, cz, 0.006, 0.13, Math.min(0.2, cl / 2 - 0.05), PAL.glass);
    slab(B, s * 0.433, 0.9, cz, 0.006, 0.04, Math.min(0.2, cl / 2 - 0.05), PAL.glassHi);
  }
  slab(B, 0, 0.82, zc + 0.045, 0.2, 0.13, 0.008, PAL.glass); // geam față
  slab(B, 0, 0.72, zb - 0.02, 0.12, 0.22, 0.01, PAL.glass); // ușa din spate (deschisă către tender)
  // cilindri cu piston, roți și biele
  for (const s of [-1, 1]) {
    slab(B, s * 0.36, wr + 0.14, zf - 0.38, 0.07, 0.07, 0.17, PAL.steel);
    cyl(B, [s * 0.36, wr + 0.14, zf - 0.2], [s * 0.36, wr + 0.14, zf - 0.08], 0.025, 0.025, 5, PAL.silver, 2);
  }
  const drv = o.nd > 2 ? [zc - 0.3, zc + 0.08, zc + 0.46] : [zf - 0.95, zf - 0.4];
  for (const zz of drv) for (const s of [-1, 1]) wheel(B, s * 0.4, zz, wr, s, PAL.steel, c, 10);
  for (const s of [-1, 1]) {
    const zA = Math.min(...drv), zB = Math.max(...drv);
    slab(B, s * 0.475, wr, (zA + zB) / 2, 0.012, 0.016, (zB - zA) / 2, PAL.silver);
    slab(B, s * 0.475, wr + wr * 0.8, (zA + zB) / 2 + 0.05, 0.012, 0.012, 0.24, PAL.silver);
  }
  if (o.nd >= 3) for (const s of [-1, 1]) for (const q of [0.3, 0.08]) wheel(B, s * 0.38, zf - q, 0.15, s, PAL.steel, PAL.silver, 8); // boghiu din față
  // apărătoare (prinde-vite) și tampoane
  if (o.cow) loft(B, sym([[0.3, 0.14], [0.3, 0.3], [0.1, 0.34]]), zf - 0.04, sym([[0.08, 0.12], [0.08, 0.2], [0.04, 0.22]]), zf + 0.16, '#3a3d44', '#3a3d44');
  slab(B, 0, 0.34, zf + 0.02, 0.4, 0.045, 0.03, PAL.dark);
  for (const s of [-1, 1]) slab(B, s * 0.26, 0.34, zf + 0.08, 0.055, 0.04, 0.04, PAL.silver);
  if (o.tender) tender(B, c, o);
  else { slab(B, 0, 0.3, zb - 0.02, 0.4, 0.05, 0.03, PAL.dark); for (const s of [-1, 1]) slab(B, s * 0.26, 0.3, zb - 0.08, 0.05, 0.04, 0.04, PAL.silver); }
}
