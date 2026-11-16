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
import { createPlatforms, createSwitches } from './platforms.js';
import { createSignals } from './signals3d.js';
import { createDepots } from './depot.js';
import { createTerminals } from './terminal.js';
import { createSea } from './ships.js';
import { createLand } from './land.js';
import { dirtyChunks } from '../sim/terraform.js';
import { createOverlay } from './overlay.js';
import { createGhost } from './ghost.js';
import { perf } from '../../../../shared/engine/perf.js';
import { look, onLook, shadowsOn, rich } from './look.js';
import { createGulls } from './gulls.js';

/** Aplică steagurile de umbre ale calității curente pe un strat nou (userData.cast / recv / blob). */
function shade(obj) {
  const on = shadowsOn();
  obj.traverse((o) => {
    if (o.userData.cast !== undefined) o.castShadow = on && o.userData.cast;
    if (o.userData.recv !== undefined) o.receiveShadow = on && o.userData.recv;
    if (o.userData.blob) o.visible = !on;
  });
}
const electric = (m) => m.key === 'electric' || m.key === 'glont';

export function createView(stage, s) {
  const g = makeGround(s), root = new Group(), dyn = { forest: null, cities: null, roads: null, track: null, power: null, stations: null, industries: null, upgrades: null, platforms: null, switches: null, terminals: null };
  const terrain = createTerrain(s, g), trains = createTrains(s, g, stage.camera), overlay = createOverlay(s, g), ghost = createGhost(s, g, stage), links = createLinks(s, g);
  const clouds = createClouds(s, g, stage.camera), signals = createSignals(s, g);
  let depots = null, platK = '', platT = 0;
  const sea = s.islands ? createSea(s, g, (id) => colorOf(id)) : null; // etapa 7.2: porturi și vapoare
  root.add(terrain.root, trains.root, signals.root, overlay.mesh, links.mesh, ghost.root);
  stage.scene.add(root, clouds.root);
  if (sea) root.add(sea.root);
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
    if (d.terrain) { // teren nivelat: doar bucățile atinse (sau tot, la încărcare fără dreptunghiuri)
      const rects = d.tr || [];
      for (const [x0, y0, x1, y1] of rects) g.refresh(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
      terrain.rebuild(rects.length ? dirtyChunks(s) : []);
      d.terrain = false; d.tr = []; d.forest = d.cities = d.stations = d.signals = true;
    }
    if (d.forest) { swap('forest', () => createForest(s, g, q, look.cool)); d.forest = false; }
    if (d.cities || !dyn.roads) { swap('cities', () => createCities(s, g)); swap('roads', () => createRoads(s, g)); d.cities = false; }
    if (d.track) { swap('track', () => createTrack(s, g, q)); powered.clear(); lastPowered = -1; d.track = false; d.stations = true; swap('switches', () => createSwitches(s, g)); }
    if (d.stations) { swap('stations', () => createStations(s, g, colorOf)); swap('upgrades', () => createUpgrades(s, g)); swap('platforms', () => createPlatforms(s, g)); swap('terminals', () => createTerminals(s, g, colorOf)); d.stations = false; }
    if (s.islands && (d.land || (s.land && !dyn.land))) { swap('land', () => createLand(s, g, colorOf)); d.land = false; } // parcele cumpărate (7.4)
    if (d.industries) { swap('industries', () => createIndustries(s, g)); d.industries = false; d.forest = true; if (links.visible) links.rebuild(); }
    if (rich() && powered.size !== lastPowered) { swap('power', () => createCatenary(s, g, powered)); lastPowered = powered.size; }
    if (!rich() && dyn.power) { root.remove(dyn.power); dyn.power = null; lastPowered = -1; }
  }
  /** Plăcile traseelor trenurilor electrice (se adună în timp, pe măsură ce își schimbă traseul). */
  function scanPower() {
    for (const t of s.trains) if (electric(MODELS[t.model])) for (const i of t.path) powered.add(i);
  }
  refresh();
  trains.resync();
  const redo = () => { s.dirty.forest = true; s.dirty.track = true; };
  const off = perf.onChange(redo), off2 = onLook(() => { redo(); shade(root); });
  const gulls = createGulls(s, stage.camera); root.add(gulls.root);

  return {
    ground: g, trains, overlay, ghost, links, refresh,
    frame(alpha, dt, t) {
      stage.frame(t);
      if (t - scanT > 1.5) { scanT = t; scanPower(); }
      if (t - platT > 1) { platT = t; const k = s.stations.map((q) => q.platforms | 0).join(); if (k !== platK) { platK = k; s.dirty.stations = true; } }
      refresh();
      trains.update(alpha, dt, stage.night);
      signals.update(dt);
      ghost.frame(t);
      if (!depots && Array.isArray(s.depots)) { depots = createDepots(s, g, colorOf); if (depots) { shade(depots.root); root.add(depots.root); } }
      if (depots) depots.update(t);
      if (sea) sea.update(alpha, t);
      if (dyn.terminals) dyn.terminals.userData.update(t);
      terrain.tick(t, stage.night);
      clouds.root.visible = rich() && look.mode !== '2d';
      gulls.update(t);
      if (clouds.root.visible) clouds.update(dt, stage.night);
    },
    dispose() { off(); off2(); ghost.dispose(); stage.scene.remove(root, clouds.root); root.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }); },
  };
}
