// Grafică „Ultra” (doar PC): post-procesare cu umbră de contact (GTAO), strălucire (bloom) și anti-aliasing SMAA.
// Scena se desenează în țintă exact ca pe ecran (ACES + sRGB în shader), ca apa, spuma și ceața translucide să arate identic;
// efectele lucrează apoi pe imaginea finală. Telefoanele nu ajung aici (ultraOn în look.js); la FPS mic perf coboară calitatea și Ultra se oprește.
import { WebGLRenderTarget, Vector2, SRGBColorSpace } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/** Three aplică tone mapping și sRGB în shader doar pe ecran sau în ținte „XR”; marcăm țintele așa (fără conversie hardware sRGB). */
// Fără MSAA aici: bufferul multisample ar avea alt format decât textura (blit invalid); netezirea o face SMAA.
function screenLike(rt) { rt.isXRRenderTarget = true; rt.texture.colorSpace = SRGBColorSpace; return rt; }

/** GTAO doar pe obiecte solide: apa, spuma, cerul, norii și evidențierile translucide nu intră în adâncimea lui (altfel apar linii și pete). */
class SolidGTAO extends GTAOPass {
  _overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const m = o.material, see = (x) => x && (x.transparent || x.depthWrite === false);
      if (o.isPoints || o.isLine || o.isLine2 || o.isSprite || (m && (Array.isArray(m) ? m.some(see) : see(m)))) { o.visible = false; cache.push(o); }
    });
  }
}

export function createUltra(renderer, scene, camera) {
  let composer = null, gtao = null, bloom = null;
  const size = new Vector2();

  function build() {
    renderer.getDrawingBufferSize(size);
    composer = new EffectComposer(renderer, screenLike(new WebGLRenderTarget(size.x, size.y)));
    screenLike(composer.renderTarget2);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new SolidGTAO(scene, camera, size.x, size.y);
    gtao.blendIntensity = 0.8;
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new Vector2(size.x, size.y), 0.15, 0.4, 0.93); // doar ce e foarte luminos: soare, felinare, ferestre
    composer.addPass(bloom);
    composer.addPass(new SMAAPass()); // ultimul: scrie pe ecran valorile deja în sRGB
    if (import.meta.env && import.meta.env.DEV) window.__ultra = composer; // depanare în dev
    sync();
  }
  /** Raza umbrei de contact urmează zoom-ul: aproape e fină, departe acoperă clădiri întregi. */
  function tune(K) {
    if (!gtao) return;
    const r = Math.min(3, Math.max(0.6, 0.9 * K));
    if (gtao._r !== r) { gtao._r = r; gtao.updateGtaoMaterial({ radius: r, distanceExponent: 1.4, thickness: r, scale: 1.1, samples: 16 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }); }
  }
  function sync() {
    if (!composer) return;
    renderer.getDrawingBufferSize(size);
    composer.setPixelRatio(1);
    composer.setSize(size.x, size.y);
  }
  function drop() {
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.dispose(); composer = gtao = bloom = null;
  }
  return {
    get on() { return !!composer; },
    set(on) { if (on && !composer) build(); else if (!on) drop(); },
    resize: sync,
    /** Noaptea strălucesc mai mult felinarele și ferestrele. */
    render(night, K) { tune(K); bloom.strength = 0.15 + 0.45 * night; bloom.threshold = 0.93 - 0.3 * night; composer.render(); },
  };
}
