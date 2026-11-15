// Cele 10 lumi: teren, mecanici și inamici (cumulative), boss-ul de la nivelul 15.
// `mechanics` = chei de segmente din chunks/ (ultima = mecanica nouă a lumii).
export const LEVELS_PER_WORLD = 15;

const M = ['base', 'oneway', 'moving', 'crumble', 'water', 'spikes', 'ice', 'spring', 'clouds', 'lava'];
const E = [
  ['snail', 'bee'], ['ladybug'], ['fly'], ['worm', 'saw'], ['fish'],
  ['slime_spike', 'block'], ['mouse'], ['frog'], ['slime_normal'], ['slime_fire', 'fireball'],
];
const cum = (arr, i) => arr.slice(0, i + 1).flat();

const DEF = [
  ['meadow', 'Pajiștea Însorită', 'grass', 'snail', 3],
  ['forest', 'Pădurea Fermecată', 'grass', 'ladybug', 3],
  ['sunset', 'Dealurile Apusului', 'purple', 'fly', 4],
  ['desert', 'Deșertul Auriu', 'sand', 'worm', 4],
  ['beach', 'Plaja Scoicilor', 'sand', 'fish', 4],
  ['cave', 'Peștera de Cristal', 'stone', 'block', 5],
  ['snow', 'Țara Zăpezii', 'snow', 'mouse', 5],
  ['mushroom', 'Ciupercile Uriașe', 'dirt', 'frog', 5],
  ['clouds', 'Castelul din Nori', 'cloud', 'slime_normal', 6],
  ['volcano', 'Vulcanul Fierbinte', 'stone', 'slime_fire', 6],
];

export const WORLDS = DEF.map(([key, name, terrain, bossType, hp], i) => ({
  key, name, terrain,
  mechanics: M.slice(0, i + 1),
  enemies: cum(E, i),
  boss: { type: bossType, hp },
}));
