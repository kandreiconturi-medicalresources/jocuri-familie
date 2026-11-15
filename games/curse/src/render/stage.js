// Scena 3D: randare, lumini, ceață, camere (1 sau 2 jucători pe ecran împărțit), efecte.
import {
  Color, DirectionalLight, Fog, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import { perf } from '../../../../shared/engine/perf.js';
import { createChaseCam } from './camera.js';
import { createTrackMesh, createSky, createGround } from './world.js';
import { createDecor } from './decor.js';
import { createCarMesh, poseCar } from './cars.js';
import { createPool, createSkids } from './fx.js';
import { emitCarFx } from './carfx.js';

const DPR = [1, 1.5, 2];

export function createStage(canvas) {
  const q0 = perf.quality();
  const renderer = new WebGLRenderer({ canvas, antialias: q0 === 2, powerPreference: 'high-performance', alpha: false });
  renderer.shadowMap.enabled = q0 === 2;
  const scene = new Scene();
  const hemi = new HemisphereLight(0xffffff, 0x446644, 1);
  const sun = new DirectionalLight(0xffffff, 1);
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun, sun.target);

  let world = null, decor = null, sky = null, ground = null, meshes = {}, views = [], q = q0, frame = 0, trackRef = null;
  const fx = { smoke: createPool(180, false), fire: createPool(110, true), skids: createSkids(200) };
  scene.add(fx.smoke.pts, fx.fire.pts, fx.skids.mesh);

  function applyQuality() {
    q = perf.quality();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR[q]));
    renderer.setSize(innerWidth, innerHeight, false);
    const sh = q === 2;
    if (sh && !renderer.shadowMap.enabled) { renderer.shadowMap.enabled = true; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    sun.castShadow = sh;
    Object.values(meshes).forEach((m) => { m.userData.body.castShadow = sh; });
    if (decor) decor.setQuality(q);
  }
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); views.forEach((v) => { v.cam.aspect = v.w * innerWidth / (v.h * innerHeight); v.cam.updateProjectionMatrix(); }); };
  addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
  perf.onChange(applyQuality);
  applyQuality();

  return {
    renderer, fx, dbg: null, // dbg = { x, y, z, tx, tz, fov }: cameră de depanare, doar din consolă
    /** Construiește pista (după ce modelele sunt încărcate). */
    loadTrack(track) {
      if (world) { scene.remove(world, sky, decor.group, ground); [world, ...decor.group.children].forEach((o) => o.geometry && o.geometry.dispose()); }
      const th = track.def.theme; trackRef = track;
      world = createTrackMesh(track, th); sky = createSky(th); ground = createGround(th);
      decor = createDecor(track, th, q);
      scene.add(world, sky, ground, decor.group);
      scene.background = new Color(th.sky[1]);
      scene.fog = new Fog(th.fog, th.near, th.far);
      hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.night ? 0.9 : 1.15;
      sun.color.set(th.sunColor || 0xffffff); sun.intensity = th.sun;
      fx.skids.clear();
    },
    /** Creează mesh-urile mașinilor (race.cars cu `color` = id de culoare). */
    setCars(cars) {
      Object.values(meshes).forEach((m) => scene.remove(m));
      meshes = {};
      cars.forEach((c) => { const m = createCarMesh(c.color, q === 2); meshes[c.id] = m; scene.add(m); });
    },
    /** `focus` = [{ id, x, y, w, h }] în fracții de ecran (1 sau 2 vederi). */
    setViews(focus) {
      views = focus.map((f) => {
        const cam = new PerspectiveCamera(60, 1, 0.5, 1300);
        return { ...f, cam, chase: createChaseCam(cam) };
      });
      resize();
    },
    snapCams(race) { views.forEach((v) => v.chase.snap(race.byId[v.id])); },
    render(race, alpha, dt) {
      frame++;
      for (const c of race.cars) { if (meshes[c.id]) poseCar(meshes[c.id], c, alpha); emitCarFx(fx, c, alpha, q, frame); }
      fx.smoke.update(dt); fx.fire.update(dt);
      const H = innerHeight;
      const d = this.dbg;
      if (d && views[0]) { const c = views[0].cam; c.position.set(d.x, d.y, d.z); c.lookAt(d.tx, d.ty || 0, d.tz); c.fov = d.fov || 60; c.updateProjectionMatrix(); sky.position.copy(c.position); renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, H); renderer.render(scene, c); return; }
      renderer.setScissorTest(views.length > 1);
      for (const v of views) {
        const car = race.byId[v.id];
        v.chase.update(car, dt, alpha);
        sky.position.copy(v.cam.position);
        sun.position.set(car.x + 30, 70, car.z + 25); sun.target.position.set(car.x, 0, car.z); sun.target.updateMatrixWorld();
        const vw = Math.round(v.w * innerWidth), vh = Math.round(v.h * H), vx = Math.round(v.x * innerWidth), vy = Math.round((1 - v.y - v.h) * H);
        renderer.setViewport(vx, vy, vw, vh); renderer.setScissor(vx, vy, vw, vh);
        fx.smoke.setView(vh * renderer.getPixelRatio(), v.chase.fov); fx.fire.setView(vh * renderer.getPixelRatio(), v.chase.fov);
        renderer.render(scene, v.cam);
      }
    },
    get quality() { return q; },
    info: () => renderer.info.render,
  };
}
