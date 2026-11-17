// Clădirea gării mari de trecere: hală cu etaje, turn cu ceas, fațadă de sticlă spre oraș, aripi cu ferestre, piață cu felinare,
// bănci și straturi de flori; pasarela acoperită peste toate liniile, cu turnuri de scări pe fiecare peron.
// Coordonate locale: x = v (spre oraș), z = u (de-a lungul liniei). B = opac, GL = sticlă, wins = ferestre luminate noaptea (patrulatere).
import { box } from './terminalLayout.js';
import { bench, lamp } from './stationProps.js';
import { TOP, DECK } from './thruLayout.js';

const WALL = '#efe2c6', WALL2 = '#e2d2b0', ROOF = '#7c4a3a', STEEL = '#55606c', WIN = '#6f9fc4', DARK = '#3a3f46', WHITE = '#e9edf1', PAVE = '#c8bfae';

/** Fereastră pe fața v = x0 (normala spre sd): geam albastru ziua + patrulater care se luminează noaptea. */
function win(B, wins, x0, sd, u, y, hu = 0.07, hy = 0.07) {
  box(B, x0 - 0.006, x0 + 0.006, u - hu, u + hu, y - hy, y + hy, WIN);
  const x = x0 + sd * 0.008;
  wins.push([[x, y - hy, u - hu], [x, y - hy, u + hu], [x, y + hy, u + hu], [x, y + hy, u - hu]]);
}

/** Corp de clădire între fețele vP (spre linii) și vF (spre oraș), u în [a, b], înalt h, cu rânduri de ferestre pe ambele fețe. */
function block(B, wins, vP, vF, a, b, h, floors, col) {
  box(B, vP, vF, a, b, 0.0, h, col);
  box(B, vP - 0.02, vF + 0.02, a - 0.02, b + 0.02, h, h + 0.035, ROOF); // cornișă
  for (let f = 1; f < floors; f++) box(B, vP - 0.008, vF + 0.008, a, b, (h * f) / floors - 0.008, (h * f) / floors + 0.008, WALL2); // brâu între etaje
  for (let f = 0; f < floors; f++) {
    const y = (h * (f + 0.55)) / floors;
    for (let u = a + 0.16; u < b - 0.1; u += 0.22) { win(B, wins, vF, 1, u, y, 0.055, 0.055); win(B, wins, vP, -1, u, y, 0.055, 0.055); }
  }
}

/** Turn cu ceas: patru fețe cu cadran, acoperiș în trepte și o lanternă luminată. */
function tower(B, wins, vc, uc, h, own) {
  const r = 0.17;
  box(B, vc - r, vc + r, uc - r, uc + r, 0, h, WALL);
  for (let y = 0.35; y < h - 0.3; y += 0.3) { box(B, vc - r - 0.01, vc + r + 0.01, uc - r - 0.01, uc + r + 0.01, y, y + 0.02, WALL2); }
  for (const sd of [-1, 1]) { // cadrane pe fețele v și u
    box(B, vc + sd * (r + 0.004) - 0.004, vc + sd * (r + 0.004) + 0.004, uc - 0.11, uc + 0.11, h - 0.27, h - 0.05, '#f6f3ea');
    box(B, vc + sd * (r + 0.01) - 0.003, vc + sd * (r + 0.01) + 0.003, uc - 0.008, uc + 0.008, h - 0.17, h - 0.07, '#222');
    box(B, vc + sd * (r + 0.01) - 0.003, vc + sd * (r + 0.01) + 0.003, uc - 0.008, uc + 0.06, h - 0.17, h - 0.155, '#222');
    box(B, vc - 0.11, vc + 0.11, uc + sd * (r + 0.004) - 0.004, uc + sd * (r + 0.004) + 0.004, h - 0.27, h - 0.05, '#f6f3ea');
    wins.push([[vc + sd * (r + 0.012), h - 0.27, uc - 0.11], [vc + sd * (r + 0.012), h - 0.27, uc + 0.11], [vc + sd * (r + 0.012), h - 0.05, uc + 0.11], [vc + sd * (r + 0.012), h - 0.05, uc - 0.11]]);
    win(B, wins, vc + sd * r, sd, uc, h * 0.45, 0.04, 0.1);
  }
  box(B, vc - r - 0.03, vc + r + 0.03, uc - r - 0.03, uc + r + 0.03, h, h + 0.04, ROOF);
  box(B, vc - 0.12, vc + 0.12, uc - 0.12, uc + 0.12, h + 0.04, h + 0.16, own);
  box(B, vc - 0.07, vc + 0.07, uc - 0.07, uc + 0.07, h + 0.16, h + 0.26, ROOF);
  box(B, vc - 0.012, vc + 0.012, uc - 0.012, uc + 0.012, h + 0.26, h + 0.4, STEEL); // catarg
  box(B, vc + 0.012, vc + 0.014, uc, uc + 0.09, h + 0.33, h + 0.39, own); // steag
}

/** Pasarelă acoperită la u = uB, de deasupra liniei principale până în etajul clădirii, cu un turn de scări pe fiecare peron. */
function footbridge(B, GL, G, own) {
  const u = G.uB, dk = TOP + DECK, v0 = -0.12, v1 = G.vB0 + 0.08, hw = 0.07;
  box(B, v0, v1, u - hw, u + hw, dk - 0.03, dk, DARK);
  for (const e of [-1, 1]) {
    box(B, v0, v1, u + e * hw - 0.006, u + e * hw + 0.006, dk, dk + 0.04, WHITE);
    GL.quad([v0, dk + 0.04, u + e * hw], [v1, dk + 0.04, u + e * hw], [v1, dk + 0.12, u + e * hw], [v0, dk + 0.12, u + e * hw], '#a9d4ea', [0, 0, e]);
  }
  box(B, v0 - 0.01, v1, u - hw - 0.012, u + hw + 0.012, dk + 0.12, dk + 0.135, own); // acoperiș
  for (const pl of G.plats) {
    const v = pl.v;
    box(B, v - 0.06, v + 0.06, u - hw - 0.006, u + hw + 0.006, TOP, dk - 0.03, WHITE); // turnul scării
    box(B, v - 0.062, v + 0.062, u - hw - 0.008, u + hw + 0.008, TOP + 0.04, TOP + 0.2, '#2c4a66');
    for (let i = 0; i < 7; i++) box(B, v - 0.04, v + 0.04, u - hw - 0.04 - i * 0.04, u - hw - 0.0 - i * 0.04, TOP + 0.02 + (6 - i) * 0.1, TOP + 0.035 + (6 - i) * 0.1, '#9a9488'); // trepte
    for (const e of [-1, 1]) box(B, v + e * 0.045 - 0.004, v + e * 0.045 + 0.004, u - hw - 0.3, u - hw, TOP, TOP + 0.08, '#f2c230'); // balustrade
  }
}

export function hall(B, GL, G, own, wins) {
  const vP = G.vB0 + 0.05, vF = G.vB1 - 0.34, E = G.E - 0.25, d = vF - vP, mid = Math.min(1.5, E - 0.6);
  // aripile (2 etaje) și hala centrală (3 etaje) cu acoperiș de sticlă în două ape
  block(B, wins, vP, vF, -E, -mid, 0.5, 2, WALL);
  block(B, wins, vP, vF, mid, E, 0.5, 2, WALL);
  box(B, vP, vF, -mid, mid, 0, 0.8, WALL2);
  box(B, vP - 0.02, vF + 0.02, -mid - 0.02, mid + 0.02, 0.8, 0.835, ROOF);
  for (let f = 0; f < 3; f++) for (let u = -mid + 0.16; u < mid - 0.1; u += 0.22) if (Math.abs(u) > 0.24 || f > 0) win(B, wins, vP, -1, u, 0.8 * (f + 0.55) / 3, 0.06, 0.07);
  const rv = (vP + vF) / 2;
  for (const e of [-1, 1]) GL.quad([e < 0 ? vP : vF, 0.835, -mid], [rv, 0.835 + d * 0.45, -mid], [rv, 0.835 + d * 0.45, mid], [e < 0 ? vP : vF, 0.835, mid], '#bfe3f2', [e * 0.5, 1, 0]);
  for (let u = -mid; u <= mid + 0.01; u += 0.5) B.ribbon([[vP, 0.835, u], [rv, 0.835 + d * 0.45, u], [vF, 0.835, u]], 0.01, -0.01, 0.01, STEEL);
  // fațada de sticlă spre oraș, cu montanți, intrare cu copertină și numele gării (culoarea companiei)
  GL.quad([vF + 0.004, 0.06, -mid + 0.05], [vF + 0.004, 0.06, mid - 0.05], [vF + 0.004, 0.74, mid - 0.05], [vF + 0.004, 0.74, -mid + 0.05], '#9fd0ee', [1, 0, 0]);
  for (let u = -mid + 0.05; u <= mid; u += 0.25) box(B, vF + 0.002, vF + 0.014, u - 0.008, u + 0.008, 0.06, 0.74, STEEL);
  for (const y of [0.3, 0.52]) box(B, vF + 0.002, vF + 0.014, -mid + 0.05, mid - 0.05, y - 0.006, y + 0.006, STEEL);
  for (let u = -mid + 0.2; u < mid - 0.1; u += 0.25) for (const y of [0.18, 0.41, 0.63]) wins.push([[vF + 0.016, y - 0.08, u - 0.1], [vF + 0.016, y - 0.08, u + 0.1], [vF + 0.016, y + 0.08, u + 0.1], [vF + 0.016, y + 0.08, u - 0.1]]);
  box(B, vF + 0.01, vF + 0.03, -0.18, 0.18, 0, 0.2, DARK); // ușile
  box(B, vF, vF + 0.2, -0.3, 0.3, 0.24, 0.26, own); // copertina intrării
  box(B, vF + 0.005, vF + 0.025, -0.45, 0.45, 0.76, 0.8, own); // firma
  tower(B, wins, vF - 0.2, mid + 0.05, 1.45, own);
  // piața din fața gării: pavaj, felinare, bănci, straturi de flori, copaci
  box(B, vF, G.vB1, -G.E + 0.05, G.E - 0.05, 0.0, 0.03, PAVE);
  for (let u = -G.E + 0.4; u < G.E - 0.3; u += 0.8) {
    lamp(B, G.vB1 - 0.08, 0.03, u);
    if (Math.abs(u) > 0.4) bench(B, G.vB1 - 0.16, 0.03, u + 0.3, 0, 1);
  }
  for (const u of [-mid - 0.5, mid + 0.5]) {
    box(B, vF + 0.08, vF + 0.22, u - 0.2, u + 0.2, 0.03, 0.07, '#7a5a3a');
    box(B, vF + 0.09, vF + 0.21, u - 0.19, u + 0.19, 0.07, 0.085, '#4fa84a');
    for (const k of [-0.12, 0, 0.12]) box(B, vF + 0.13, vF + 0.17, u + k - 0.02, u + k + 0.02, 0.085, 0.1, k ? '#e8506a' : '#f2c230');
  }
  // peronul clădirii are copertina lipită de clădire: o grindă lungă în culoarea companiei
  box(B, vP - 0.02, vP, -E, E, 0.46, 0.5, own);
  footbridge(B, GL, G, own);
}
