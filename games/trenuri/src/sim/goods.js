// Mărfuri, vagoane și industrii (date pure). Indicii sunt stabili: se salvează în stare.
export const GOODS = [
  { key: 'pass', name: 'Pasageri', icon: '👥', color: '#ffd23f', rate: 2, perish: 0 },
  { key: 'mail', name: 'Poștă', icon: '✉️', color: '#ff8fb1', rate: 3, perish: 0 },
  { key: 'cereale', name: 'Cereale', icon: '🌾', color: '#e8c24a', rate: 2, perish: 1 },
  { key: 'mancare', name: 'Mâncare', icon: '🍞', color: '#e8863a', rate: 4, perish: 1 },
  { key: 'busteni', name: 'Bușteni', icon: '🪵', color: '#8a5a3a', rate: 2, perish: 0 },
  { key: 'cherestea', name: 'Cherestea', icon: '🪚', color: '#c9985a', rate: 3, perish: 0 },
  { key: 'carbune', name: 'Cărbune', icon: '⚫', color: '#4a4a5a', rate: 2, perish: 0 },
  { key: 'minereu', name: 'Minereu', icon: '🪨', color: '#b0633c', rate: 2, perish: 0 },
  { key: 'otel', name: 'Oțel', icon: '🔩', color: '#8aa0b8', rate: 4, perish: 0 },
  { key: 'bunuri', name: 'Bunuri', icon: '📦', color: '#4aa8e8', rate: 6, perish: 0 },
  { key: 'lapte', name: 'Lapte', icon: '🥛', color: '#e6e6ff', rate: 2, perish: 1 },
  { key: 'branza', name: 'Brânză', icon: '🧀', color: '#ffc83a', rate: 5, perish: 1 },
  { key: 'petrol', name: 'Petrol', icon: '🛢️', color: '#2f2f46', rate: 2, perish: 0 },
  { key: 'combustibil', name: 'Combustibil', icon: '⛽', color: '#e85a4a', rate: 4, perish: 0 },
];
export const NG = GOODS.length;
export const G = Object.fromEntries(GOODS.map((g, i) => [g.key, i]));

/** Tipuri de vagoane: model glb din trains/, capacitate, ce mărfuri duc. */
export const CAR_TYPES = [
  { name: 'Pasageri', icon: '👥', cap: 30, glb: 'train-carriage-container-blue', goods: [0] },
  { name: 'Poștă', icon: '✉️', cap: 20, glb: 'train-carriage-container-green', goods: [1] },
  { name: 'Cutie', icon: '📦', cap: 20, glb: 'train-carriage-box', goods: [2, 9] },
  { name: 'Cărbune și minereu', icon: '⚫', cap: 20, glb: 'train-carriage-coal', goods: [6, 7] },
  { name: 'Lemn', icon: '🪵', cap: 20, glb: 'train-carriage-wood', goods: [4, 5] },
  { name: 'Cisternă', icon: '🛢️', cap: 20, glb: 'train-carriage-tank', goods: [10, 12, 13] },
  { name: 'Frigorific', icon: '🧊', cap: 20, glb: 'train-carriage-container-red', goods: [3, 11] },
  { name: 'Platformă', icon: '🔩', cap: 20, glb: 'train-carriage-flatbed-wood', goods: [8] },
];
export const CAR_OF = GOODS.map((_, g) => CAR_TYPES.findIndex((c) => c.goods.includes(g)));
/** Seturi de vagoane la cumpărare (interfață simplă). */
export const CAR_SETS = [[0, 0, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4], [5, 5, 5], [6, 6, 6], [7, 7, 7]];

/** Industrii: `in` = ce primesc, `out` = ce produc (-1 = nimic), `place` = unde le pune generatorul, `n` = câte pe harta mică. */
export const INDUSTRIES = [
  { key: 'ferma', name: 'Fermă', icon: '🌾', in: [], out: 2, place: 'plain', n: 2, parts: [['suburban/building-type-b', 0, 0, 0.5], ['nature/crops_wheatStageB', 0.9, 0.3, 0.7], ['nature/crops_wheatStageB', -0.9, 0.5, 0.7], ['nature/crops_cornStageC', 0.4, -0.9, 0.7]] },
  { key: 'fabmanc', name: 'Fabrică de mâncare', icon: '🏭', in: [2], out: 3, place: 'plain', n: 1, parts: [['industrial/building-f', 0, 0, 0.5], ['industrial/chimney-small', 0.5, 0.5, 0.5]] },
  { key: 'padure', name: 'Pădure', icon: '🌲', in: [], out: 4, place: 'forest', n: 2, parts: [['nature/log_stack', 0, 0, 0.9], ['nature/log_stack', 0.6, 0.5, 0.7], ['nature/tree_pineDefaultA', -0.7, -0.5, 0.5]] },
  { key: 'gater', name: 'Gater', icon: '🪚', in: [4], out: 5, place: 'plain', n: 1, parts: [['industrial/building-b', 0, 0, 0.5], ['nature/log_stack', 0.8, 0.6, 0.7]] },
  { key: 'mincarb', name: 'Mină de cărbune', icon: '⛏️', in: [], out: 6, place: 'hill', n: 1, parts: [['industrial/building-k', 0, 0, 0.45], ['nature/rock_largeA', 0.8, 0.6, 0.6]] },
  { key: 'centrala', name: 'Centrală electrică', icon: '⚡', in: [6], out: -1, place: 'plain', n: 1, parts: [['industrial/building-n', 0, 0, 0.5], ['industrial/chimney-large', 0.6, 0.5, 0.5]] },
  { key: 'minfier', name: 'Mină de fier', icon: '⛏️', in: [], out: 7, place: 'hill', n: 1, parts: [['industrial/building-g', 0, 0, 0.45], ['nature/rock_largeB', -0.8, 0.6, 0.6]] },
  { key: 'otelarie', name: 'Oțelărie', icon: '🏭', in: [6, 7], out: 8, place: 'plain', n: 1, parts: [['industrial/building-m', 0, 0, 0.5], ['industrial/chimney-large', 0.6, 0.6, 0.5], ['industrial/chimney-medium', -0.6, 0.6, 0.5]] },
  { key: 'fabrica', name: 'Fabrică de bunuri', icon: '🏭', in: [8], out: 9, place: 'plain', n: 1, parts: [['industrial/building-t', 0, 0, 0.5], ['industrial/chimney-medium', 0.6, 0.6, 0.5]] },
  { key: 'fermalapte', name: 'Fermă de lapte', icon: '🐄', in: [], out: 10, place: 'plain', n: 1, parts: [['suburban/building-type-g', 0, 0, 0.5], ['industrial/detail-tank', 0.8, 0.5, 0.5]] },
  { key: 'lapterie', name: 'Lăptărie', icon: '🧀', in: [10], out: 11, place: 'plain', n: 1, parts: [['industrial/building-d', 0, 0, 0.5], ['industrial/detail-tank', 0.8, 0.6, 0.5]] },
  { key: 'sonda', name: 'Sondă petrol', icon: '🛢️', in: [], out: 12, place: 'plain', n: 1, parts: [['industrial/detail-tank-large', 0, 0, 0.5], ['industrial/chimney-small', 0.7, 0.5, 0.4]] },
  { key: 'rafinarie', name: 'Rafinărie', icon: '🏭', in: [12], out: 13, place: 'plain', n: 1, parts: [['industrial/building-p', 0, 0, 0.5], ['industrial/detail-tank-large', 0.8, 0.7, 0.45], ['industrial/chimney-large', -0.7, 0.6, 0.45]] },
];
export const IND_MODELS = [...new Set(INDUSTRIES.flatMap((t) => t.parts.map((p) => p[0])))];

/** Ce mărfuri cere un oraș, după nivel (cererea crește odată cu orașul). */
export const CITY_GOODS = [[3, 5], [3, 5, 9, 11], [3, 5, 9, 11, 13]];
const SHIFT = { 0: 2, 1: 4, 3: 4, 5: 5, 9: 5, 11: 5, 13: 5 };
/** Cât vrea un oraș pe lună din marfa g (0 = nu cere). */
export function wantOf(c, g) {
  if (g < 2) return Math.max(1, c.pop >> SHIFT[g]);
  return CITY_GOODS[c.level].includes(g) ? Math.max(1, c.pop >> SHIFT[g]) : 0;
}
