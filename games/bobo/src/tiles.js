// Legenda plăcilor din grila nivelului (un caracter = o placă de 32×32).
export const TS = 32;
export const ROWS = 17;

export const T = {
  EMPTY: '.',
  GROUND: '#',     // teren, pielea vine din lume
  STONE: 'L',      // bloc tare / scări
  BRICK: 'B',      // cărămidă: se sparge de jos dacă jucătorul e mare
  FRUIT_BOX: 'G',  // lovită de jos → căpșună, devine 'g'
  SHIELD_BOX: 'Q', // → bulă-scut
  GROW_BOX: 'C',   // → creștere (jucător mare)
  WAND_BOX: 'S',   // → baghetă (trage stele)
  USED_BOX: 'g',
  ONEWAY: '=',     // platformă prin care sari de jos
  FRUIT: 'o',      // căpșună
  HEART: 'h',
  STAR: '*',       // steluță (3 pe nivel)
  SPIKES: '^',     // rănesc
  WATER: '~',      // înot
  ICE: 'I',        // solid, alunecos
  SPRING: 'T',     // trambulină
  CRUMBLE: 'X',    // se prăbușește după ce stai pe el
  LAVA: 'V',       // moarte → checkpoint
};

export const SOLID = new Set(['#', 'L', 'B', 'G', 'Q', 'C', 'S', 'g', 'I', 'T', 'X']);
export const BOXES = new Set(['G', 'Q', 'C', 'S']);
export const PICKUPS = new Set(['o', 'h', '*']);

export const isSolid = (c) => SOLID.has(c);
export const isOneWay = (c) => c === '=';
export const isStandable = (c) => SOLID.has(c) || c === '=';
