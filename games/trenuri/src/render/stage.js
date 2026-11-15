// Scena Three.js: lumină caldă, ceață ușoară, cameră în perspectivă, calitate după perf.quality().
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color } from 'three';
import { perf } from '../../../../shared/engine/perf.js';

const SKY = 0xcfe6f2;
export function createStage(canvas) {
  const quality = perf.quality();
  const renderer = new WebGLRenderer({ canvas, antialias: quality >= 2, powerPreference: 'high-performance' });
  const scene = new Scene();
  scene.background = new Color(SKY);
  scene.fog = new Fog(SKY, 40, 120);
  const camera = new PerspectiveCamera(38, 1, 0.5, 400);
  scene.add(new HemisphereLight(0xdcefff, 0xd8b98a, 1.05));
  const sun = new DirectionalLight(0xffe2b0, 1.5);
  sun.position.set(-30, 40, 20);
  scene.add(sun);

  function resize() {
    const q = perf.quality(), dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.5 : 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  perf.onChange(resize);
  resize();
  return { renderer, scene, camera, setFog(near, far) { scene.fog.near = near; scene.fog.far = far; }, render: () => renderer.render(scene, camera) };
}
