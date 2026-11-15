// Biblioteca de segmente, grupată pe mecanică.
import { BASE } from './base.js';
import { ONEWAY } from './oneway.js';
import { MOVING } from './moving.js';
import { CRUMBLE } from './crumble.js';
import { WATER } from './water.js';
import { SPIKES } from './spikes.js';
import { ICE } from './ice.js';
import { SPRING } from './spring.js';
import { CLOUDS } from './clouds.js';
import { LAVA } from './lava.js';

export { CHUNK_ERRORS } from './util.js';

export const CHUNKS = {
  base: BASE, oneway: ONEWAY, moving: MOVING, crumble: CRUMBLE, water: WATER,
  spikes: SPIKES, ice: ICE, spring: SPRING, clouds: CLOUDS, lava: LAVA,
};
