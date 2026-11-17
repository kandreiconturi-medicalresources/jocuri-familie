// Vagoane procedurale, câte unul pentru fiecare tip din CAR_TYPES: pasageri, poștă, cutie, cărbune, lemn, cisternă,
// frigorific (platformă pentru containere), platformă. Podeaua e la y = 0.4, unde încep încărcăturile din cargo.js.
import { PAL, slab, cyl, prism, sym, windows, bogie, ends } from './trainKit.js';

const HW = 0.54, DECK = 0.4;

function frame(B, c, deck = '#2a2d33') {
  slab(B, 0, 0.36, 0, HW - 0.04, 0.045, 1.3, deck);
  slab(B, 0, 0.3, 0, 0.08, 0.04, 1.0, PAL.iron); // lonjeron central
  slab(B, 0.2, 0.28, 0.1, 0.06, 0.05, 0.22, '#1b1d21'); // cilindru de frână
  bogie(B, 0.85, HW + 0.01, 0.17, 2, 0.19, 8); bogie(B, -0.85, HW + 0.01, 0.17, 2, 0.19, 8);
  ends(B, 1.3, 1, 0.36); ends(B, -1.3, -1, 0.36);
  for (const s of [-1, 1]) slab(B, s * (HW - 0.02), 0.355, 0, 0.012, 0.015, 1.3, c); // dungă de culoare pe șasiu
}

/** Vagon închis (pasageri / poștă): caroserie cu acoperiș rotunjit, geamuri, uși, ventilatoare. */
function closed(B, c, o) {
  const prof = sym([[0.5, DECK + 0.02], [0.5, 1.02], [0.44, 1.2], [0.2, 1.28]]);
  prism(B, prof, -1.3, 1.3, [o.body, o.body, o.roof, o.roof, o.roof, o.body, o.body, PAL.dark], 3);
  for (const s of [-1, 1]) {
    slab(B, s * 0.503, DECK + 0.13, 0, 0.005, 0.1, 1.3, c);
    slab(B, s * 0.503, DECK + 0.25, 0, 0.004, 0.012, 1.3, PAL.silver);
    for (const dz of o.doors) { slab(B, s * 0.506, 0.78, dz, 0.005, 0.37, 0.14, o.door); slab(B, s * 0.51, 0.95, dz, 0.004, 0.12, 0.07, PAL.glass); }
  }
  if (o.wins) windows(B, 0.504, o.wins[0], o.wins[1], 0.78, 1.04, o.wins[2], PAL.glass, 0.74, PAL.glassHi);
  if (o.slide) for (const s of [-1, 1]) { slab(B, s * 0.508, 0.76, 0, 0.005, 0.34, 0.34, o.door); slab(B, s * 0.512, 0.76, 0, 0.004, 0.02, 0.34, PAL.silver); }
  for (const z of [-0.5, 0.5]) slab(B, 0, 1.3, z, 0.07, 0.03, 0.1, '#7a828c');
  for (const z of [-1.3, 1.3]) slab(B, 0, 0.78, z + Math.sign(z) * 0.006, 0.26, 0.4, 0.006, '#20242a');
}
const coach = (B, c) => closed(B, c, { body: '#d4dde6', roof: '#7b8794', door: '#44566a', doors: [-1.12, 1.12], wins: [-0.9, 0.9, 7] });
const mail = (B, c) => { closed(B, c, { body: '#e0ae34', roof: '#80693a', door: '#9a7420', doors: [-1.12, 1.12], slide: true, wins: [0.62, 1.0, 1] }); };

/** Vagon deschis cu pereți din scânduri (cutie) — încărcătura se vede deasupra. */
function open(B, c, o) {
  slab(B, 0, DECK, 0, HW - 0.02, 0.025, 1.28, o.floor);
  for (const s of [-1, 1]) {
    slab(B, s * (HW - 0.03), DECK + o.h / 2, 0, 0.02, o.h / 2, 1.28, o.wall);
    slab(B, s * (HW - 0.012), DECK + o.h * 0.5, 0, 0.008, 0.03, 1.28, c);
    slab(B, s * (HW - 0.012), DECK + o.h - 0.02, 0, 0.012, 0.025, 1.3, o.rim);
    for (const z of [-1.1, -0.55, 0, 0.55, 1.1]) slab(B, s * (HW - 0.005), DECK + o.h / 2, z, 0.012, o.h / 2, 0.025, PAL.dark);
  }
  for (const z of [-1.26, 1.26]) { slab(B, 0, DECK + o.h / 2, z, HW - 0.02, o.h / 2, 0.025, o.wall); slab(B, 0, DECK + o.h - 0.02, z, HW, 0.025, 0.03, o.rim); }
}
const crate = (B, c) => open(B, c, { floor: '#5a3b26', wall: '#9a6a42', rim: '#4a4f57', h: 0.36 });
function hopper(B, c) {
  open(B, c, { floor: '#2a2c31', wall: '#3d4148', rim: '#59606a', h: 0.46 });
  for (const z of [-0.5, 0.5]) prism(B, [[-0.4, DECK - 0.02], [0.4, DECK - 0.02], [0.18, 0.27], [-0.18, 0.27]], z - 0.22, z + 0.22, '#2a2c31', 3); // jgheaburi de descărcare
}
function timber(B, c) {
  slab(B, 0, DECK, 0, HW - 0.02, 0.03, 1.28, '#6e4a2c');
  slab(B, 0, DECK - 0.025, 0, HW - 0.03, 0.012, 1.28, PAL.dark);
  for (const z of [-1.0, -0.35, 0.35, 1.0]) for (const s of [-1, 1]) { slab(B, s * (HW - 0.03), DECK + 0.3, z, 0.025, 0.3, 0.03, '#4c4f57'); slab(B, s * (HW - 0.03), DECK + 0.6, z, 0.032, 0.015, 0.04, c); }
  for (const z of [-1.27, 1.27]) { slab(B, 0, DECK + 0.14, z, HW - 0.04, 0.14, 0.02, '#4c4f57'); slab(B, 0, DECK + 0.29, z, HW - 0.04, 0.012, 0.03, c); }
}
function flat(B, c, o) {
  slab(B, 0, DECK, 0, HW - 0.02, 0.03, 1.28, o.deck);
  for (const s of [-1, 1]) {
    slab(B, s * (HW - 0.03), DECK + 0.06, 0, 0.018, 0.05, 1.3, PAL.steel); slab(B, s * (HW - 0.01), DECK + 0.06, 0, 0.006, 0.02, 1.3, c);
    for (let i = 0; i < o.n; i++) { const z = -1.1 + i * (2.2 / (o.n - 1)); slab(B, s * (HW - 0.03), DECK + o.post / 2 + 0.03, z, 0.02, o.post / 2, 0.025, '#4c4f57'); }
  }
  for (const z of [-1.27, 1.27]) slab(B, 0, DECK + 0.1, z, HW - 0.04, 0.09, 0.02, PAL.steel);
  if (o.locks) for (const z of [-0.62, 0.62, 0]) for (const s of [-1, 1]) slab(B, s * 0.36, DECK + 0.05, z * 1.8, 0.03, 0.03, 0.03, '#c79a3a');
}
function tank(B, c) {
  slab(B, 0, DECK + 0.02, 0, HW - 0.1, 0.025, 1.2, PAL.dark);
  for (const z of [-0.8, 0.8]) slab(B, 0, DECK + 0.18, z, 0.3, 0.14, 0.09, PAL.steel); // șei
  cyl(B, [0, 0.9, -1.22], [0, 0.9, 1.22], 0.48, 0.48, 16, '#6f7b87', 3);
  for (const z of [-1.0, 0, 1.0]) cyl(B, [0, 0.9, z - 0.025], [0, 0.9, z + 0.025], 0.494, 0.494, 16, '#3b4048', 0);
  cyl(B, [0, 0.9, -0.3], [0, 0.9, 0.3], 0.5, 0.5, 16, c, 0); // inel colorat la mijloc
  cyl(B, [0, 1.36, 0], [0, 1.46, 0], 0.15, 0.13, 10, PAL.steel, 2); // gură de vizitare
  slab(B, 0, 1.4, 0, 0.04, 0.012, 0.74, PAL.steel); // pasarelă
  for (const z of [-0.74, 0.74]) slab(B, 0, 1.4, z, 0.12, 0.012, 0.012, PAL.steel);
  for (const s of [-1, 1]) cyl(B, [s * 0.5, 0.52, -1.2], [s * 0.5, 1.15, -1.2], 0.014, 0.014, 4, PAL.steel, 0); // scară
}

/** Construiește vagonul de tipul `kind` (indice din CAR_TYPES); c = culoarea companiei. */
export function wagon(B, c, kind) {
  frame(B, c);
  [coach, mail, crate, hopper, timber, tank, (b, k) => flat(b, k, { deck: '#6a727c', n: 2, post: 0.1, locks: true }), (b, k) => flat(b, k, { deck: '#4a4f57', n: 5, post: 0.2, locks: false })][kind](B, c);
}
