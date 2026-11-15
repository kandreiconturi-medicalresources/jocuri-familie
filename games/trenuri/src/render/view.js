// Asamblează straturile randate pentru o lume: teren, păduri, orașe, drumuri, șine, gări, trenuri, evidențieri.
import { Group } from 'three';
import { makeGround } from './ground.js';
import { createTerrain } from './terrain.js';
import { createForest, createCities, createRoads } from './props.js';
import { createTrack, createStations } from './rails.js';
import { createTrains } from './trains.js';
import { createOverlay } from './overlay.js';
import { perf } from '../../../../shared/engine/perf.js';

export function createView(stage, s) {
  const g = makeGround(s), root = new Group(), dyn = { forest: null, cities: null, track: null, stations: null };
  const terrain = createTerrain(s, g), trains = createTrains(s, g), overlay = createOverlay(s, g);
  root.add(terrain.root, createRoads(s, g), trains.root, overlay.mesh);
  stage.scene.add(root);
  const colorOf = (id) => (s.companies[id] ? s.companies[id].color : '#ff6b6b');

  function swap(key, make) {
    if (dyn[key]) { root.remove(dyn[key]); dyn[key].traverse((o) => o.isInstancedMesh && o.dispose()); }
    dyn[key] = make(); root.add(dyn[key]);
  }
  function refresh() {
    const d = s.dirty;
    if (d.forest) { swap('forest', () => createForest(s, g, perf.quality())); d.forest = false; }
    if (d.cities) { swap('cities', () => createCities(s, g)); d.cities = false; }
    if (d.track) { swap('track', () => createTrack(s, g)); d.track = false; d.stations = true; }
    if (d.stations) { swap('stations', () => createStations(s, g, colorOf)); d.stations = false; }
  }
  refresh();
  trains.resync();
  perf.onChange(() => { s.dirty.forest = true; });

  return {
    ground: g, trains, overlay, refresh,
    frame(alpha, dt, t) { refresh(); trains.update(alpha, dt); terrain.tick(t); },
    dispose() { stage.scene.remove(root); root.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }); },
  };
}
