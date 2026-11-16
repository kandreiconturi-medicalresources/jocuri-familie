// Scena Three.js: lumină caldă de după-amiază, cer, ceață, umbre (cascadă urmărind vederea), zi/noapte lent, vederea clasică, statistici.
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, PCFShadowMap, ACESFilmicToneMapping, NoToneMapping, Vector3, MathUtils } from 'three';
import { perf } from '../../../../shared/engine/perf.js';
import { createSky } from './sky.js';
import { createClassic } from './classic.js';
import { createStats } from './stats.js';

const DAY = { sun: new Color(0xffd9a2), hemiSky: new Color(0xd3e6ff), hemiGround: new Color(0xcdae80), fog: new Color(0xe8e6d2) };
const NIGHT = { sun: new Color(0x6f86c8), hemiSky: new Color(0x3d4c82), hemiGround: new Color(0x2a2f48), fog: new Color(0x465782) };
const SUN_DIR = new Vector3(-0.55, 0.62, 0.42).normalize();

export function createStage(canvas) {
  const quality = perf.quality();
  const renderer = new WebGLRenderer({ canvas, antialias: quality >= 2, powerPreference: 'high-performance' });
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  scene.fog = new Fog(DAY.fog, 40, 120);
  const camera = new PerspectiveCamera(38, 1, 0.5, 400);
  const hemi = new HemisphereLight(DAY.hemiSky, DAY.hemiGround, 1.0), sun = new DirectionalLight(DAY.sun, 1.65);
  scene.add(hemi, sun, sun.target);
  const classic = createClassic(camera);
  const sky = createSky(scene, camera);
  const stats = createStats(renderer, () => perf.quality());
  const target = new Vector3(), fwd = new Vector3(), col = new Color();
  const st = { night: 0, shadowOn: false, half: 0 };

  function applyQuality() {
    const q = perf.quality(), on = q >= 1, size = q >= 2 ? 2048 : 1024;
    renderer.toneMapping = q >= 2 ? ACESFilmicToneMapping : NoToneMapping;
    renderer.toneMappingExposure = q >= 2 ? 1.12 : 1;
    sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    renderer.shadowMap.enabled = on;
    if (on !== st.shadowOn) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    st.shadowOn = on;
    scene.traverse((o) => { // umbre reale la q≥1, „blob” la q0
      if (o.userData.cast !== undefined) o.castShadow = on && o.userData.cast;
      if (o.userData.recv !== undefined) o.receiveShadow = on && o.userData.recv;
      if (o.userData.blob) o.visible = !on;
    });
    document.body.classList.toggle('q2', q >= 2);
  }
  function resize() {
    const q = perf.quality(), dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.5 : 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  perf.onChange(() => { resize(); applyQuality(); });
  resize(); applyQuality();

  /** Ziua/noaptea: ciclu foarte lent (≈6 minute), noaptea rămâne vizibilă (max 0.62). */
  function daylight(t) {
    const p = (t / 360) % 1, s = (a, b, x) => { const k = MathUtils.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    return 0.62 * (s(0.6, 0.74, p) - s(0.88, 1, p));
  }
  function frame(t) {
    const n = (st.night = daylight(t));
    sun.color.copy(DAY.sun).lerp(NIGHT.sun, n); sun.intensity = 1.65 - 1.2 * n;
    hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n); hemi.intensity = 1.0 - 0.25 * n;
    scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, n);
    sky.update(n, classic.K);
    // ținta vederii = unde privește camera pe sol; umbra urmărește vederea
    camera.getWorldDirection(fwd);
    const k = fwd.y < -0.01 ? -camera.position.y / fwd.y : 40;
    target.copy(camera.position).addScaledVector(fwd, k);
    const dist = k / classic.K, half = Math.round(MathUtils.clamp(dist * 0.9, 12, perf.quality() >= 2 ? 36 : 28) / 4) * 4, texel = (2 * half) / sun.shadow.mapSize.x;
    target.x = Math.round(target.x / texel) * texel; target.z = Math.round(target.z / texel) * texel; target.y = 0;
    sun.target.position.copy(target); sun.target.updateMatrixWorld();
    sun.position.copy(target).addScaledVector(SUN_DIR, 60);
    if (st.half !== half) {
      const c = sun.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 140; c.updateProjectionMatrix(); st.half = half;
    }
  }
  return {
    renderer, scene, camera, classic, sun, get night() { return st.night; },
    setFog(near, far) { const K = classic.K; scene.fog.near = near * K; scene.fog.far = far * K; },
    frame,
    render() { classic.tick(); renderer.render(scene, camera); stats.update(); },
  };
}
