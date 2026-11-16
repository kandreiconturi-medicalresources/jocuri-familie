// Asamblează straturile randate pentru o lume: teren, păduri, orașe, drumuri, șine, catenară, gări, trenuri, nori, evidențieri.
import { Group } from 'three';
import { MODELS } from '../sim/consts.js';
import { makeGround } from './ground.js';
import { createTerrain } from './terrain.js';
import { createForest } from './forest.js';
import { createCities } from './cities.js';
import { createRoads } from './roads.js';
import { createTrack, createStations } from './rails.js';
import { createCatenary } from './catenary.js';
import { createClouds } from './clouds.js';
import { createTrains } from './trains.js';
import { createIndustries, createUpgrades } from './industries.js';
import { createLinks } from './links.js';
import { createOverlay } from './overlay.js';
import { perf } from '../../../../shared/engine/perf.js';

/** Aplică steagurile de umbre ale calității curente pe un strat nou (userData.cast / recv / blob). */
function shade(obj) {
  const on = perf.quality() >= 1;
  obj.traverse((o) => {
    if (o.userData.cast !== undefined) o.castShadow = on && o.userData.cast;
    if (o.userData.recv !== undefined) o.receiveShadow = on && o.userData.recv;
    if (o.userData.blob) o.visible = !on;
  });
}
const electric = (m) => m.key === 'electric' || m.key === 'glont';

export function createView(stage, s) {
  const g = makeGround(s), root = new Group(), dyn = { forest: null, cities: null, roads: null, track: null, power: null, stations: null, industries: null, upgrades: null };
  const terrain = createTerrain(s, g), trains = createTrains(s, g, stage.camera), overlay = createOverlay(s, g), links = createLinks(s, g);
  const clouds = createClouds(s, g, stage.camera);
  root.add(terrain.root, trains.root, overlay.mesh, links.mesh);
  stage.scene.add(root, clouds.root);
  shade(root);
  const colorOf = (id) => (s.companies[id] ? s.companies[id].color : '#ff6b6b');
  const powered = new Set();
  let scanT = -9, lastPowered = 0;

  function swap(key, make) {
    if (dyn[key]) { root.remove(dyn[key]); dyn[key].traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }); }
    dyn[key] = make(); shade(dyn[key]); root.add(dyn[key]);
  }
  function refresh() {
    const d = s.dirty, q = perf.quality();
    if (d.forest) { swap('forest', () => createForest(s, g, q)); d.forest = false; }
    if (d.cities || !dyn.roads) { swap('cities', () => createCities(s, g)); swap('roads', () => createRoads(s, g)); d.cities = false; }
    if (d.track) { swap('track', () => createTrack(s, g, q)); powered.clear(); lastPowered = -1; d.track = false; d.stations = true; }
    if (d.stations) { swap('stations', () => createStations(s, g, colorOf)); swap('upgrades', () => createUpgrades(s, g)); d.stations = false; }
    if (d.industries) { swap('industries', () => createIndustries(s, g)); d.industries = false; d.forest = true; if (links.visible) links.rebuild(); }
    if (q >= 2 && powered.size !== lastPowered) { swap('power', () => createCatenary(s, g, powered)); lastPowered = powered.size; }
    if (q < 2 && dyn.power) { root.remove(dyn.power); dyn.power = null; lastPowered = -1; }
  }
  /** Plăcile traseelor trenurilor electrice (se adună în timp, pe măsură ce își schimbă traseul). */
  function scanPower() {
    for (const t of s.trains) if (electric(MODELS[t.model])) for (const i of t.path) powered.add(i);
  }
  refresh();
  trains.resync();
  const off = perf.onChange(() => { s.dirty.forest = true; s.dirty.track = true; });

  return {
    ground: g, trains, overlay, links, refresh,
    frame(alpha, dt, t) {
      stage.frame(t);
      if (t - scanT > 1.5) { scanT = t; scanPower(); }
      refresh();
      trains.update(alpha, dt, stage.night);
      terrain.tick(t, stage.night);
      clouds.root.visible = perf.quality() >= 2;
      if (clouds.root.visible) clouds.update(dt, stage.night);
    },
    dispose() { off(); stage.scene.remove(root, clouds.root); root.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }); },
  };
}
