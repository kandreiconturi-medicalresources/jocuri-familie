// Punctul unic de intrare pentru niveluri: getLevel(i) dă mereu o copie nouă (grila se modifică în joc).
import { CLASSIC } from './classic.js';
import { generateLevel } from './generator.js';
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';

export { WORLDS, LEVELS_PER_WORLD };
export const LEVEL_COUNT = WORLDS.length * LEVELS_PER_WORLD; // 150

export function levelMeta(index) {
  const world = Math.floor(index / LEVELS_PER_WORLD), num = (index % LEVELS_PER_WORLD) + 1;
  const w = WORLDS[world];
  return { index, world, num, theme: w.key, name: `${w.name} ${num}`, isBoss: num === LEVELS_PER_WORLD };
}

export function getLevel(index) {
  const meta = levelMeta(index);
  if (index < CLASSIC.length) return CLASSIC[index]().build(meta);
  return generateLevel(meta);
}
