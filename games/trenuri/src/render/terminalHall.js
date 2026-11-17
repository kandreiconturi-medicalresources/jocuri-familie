// Hala terminalului: peroane cu stâlpi, acoperiș de sticlă în două ape (transparent, trenurile se văd), nervuri de oțel, felinare, bănci, intrări în pasaj și porți.
import { laneC, laneStart, END, LANE, box } from './terminalLayout.js';
import { bench, lamp, clock, stairs } from './stationProps.js';

const STEEL = '#5a6470', EAVE = 0.64, RIDGE = 0.84;

/** B = geometrie opacă, G = sticlă (material transparent). Coordonate locale: x = spre curte, z = de-a lungul liniei. */
export function hall(B, G, n, owner) {
  for (let k = 1; k < n; k++) {
    const pc = laneC(k) - LANE / 2, a0 = Math.max(-0.4, laneStart(k) + 0.35), a1 = END - 0.05, top = 0.1, len = a1 - a0;
    for (const e of [-1, 1]) { // marginea peronului și stâlpii
      for (let a = a0 + 0.1; a <= a1 - 0.05; a += 0.55) { box(B, pc + e * 0.15 - 0.014, pc + e * 0.15 + 0.014, a - 0.014, a + 0.014, top, EAVE, STEEL); }
      box(B, pc + e * 0.15 - 0.02, pc + e * 0.15 + 0.02, a0, a1, EAVE - 0.02, EAVE + 0.02, STEEL); // grindă de streașină
    }
    box(B, pc - 0.018, pc + 0.018, a0, a1, RIDGE - 0.015, RIDGE + 0.02, STEEL); // coamă
    for (let a = a0 + 0.1; a <= a1 - 0.05; a += 0.55) B.ribbon([[pc - 0.3, EAVE, a], [pc, RIDGE, a], [pc + 0.3, EAVE, a]], 0.012, -0.012, 0.012, STEEL);
    for (const e of [-1, 1]) G.quad([pc + e * 0.3, EAVE, a0], [pc, RIDGE, a0], [pc, RIDGE, a1], [pc + e * 0.3, EAVE, a1], k % 2 ? '#bfe3f2' : '#a9d4ea', [0, 1, 0]); // geamuri
    box(B, pc - 0.3, pc + 0.3, a1, a1 + 0.012, EAVE, RIDGE - 0.02, owner); // fronton spre clădire
    for (let a = a0 + 0.3; a < a1 - 0.2; a += 0.55) { lamp(B, pc, top, a); }
    for (let a = a0 + 0.55; a < a1 - 0.3; a += 1.1) bench(B, pc + (k % 2 ? 0.07 : -0.07), top, a, 0, 1);
    clock(B, pc, top, a1 - 0.3, 0, 1);
    stairs(B, pc, top, a0 + 0.16, 0, 1, owner); // intrare în pasajul subteran
    for (const e of [-1, 1]) box(B, pc + e * 0.08 - 0.012, pc + e * 0.08 + 0.012, a1 - 0.18, a1 - 0.14, top, top + 0.07, '#f2c230'); // porți de bilete
    box(B, pc - 0.11, pc + 0.11, a1 - 0.02, a1, EAVE - 0.14, EAVE - 0.04, owner); // panou cu numărul peronului
  }
}
