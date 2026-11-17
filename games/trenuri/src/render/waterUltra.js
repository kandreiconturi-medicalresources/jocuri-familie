// Apă „Ultra” (doar PC): un singur shader în locul straturilor apă + adâncime + sclipiri + spumă.
// Valuri din sume de unde (normale calculate analitic), reflexia cerului (Fresnel), sclipiri de soare, culoare după adâncime
// (citită din textura stratului de adâncime) și benzi de spumă care vin spre mal (din textura spumei).
import { ShaderMaterial, UniformsLib, UniformsUtils, Color, DoubleSide } from 'three';
import { SUN_DIR } from './sky.js';

const VERT = /* glsl */`
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform float uTime, uNight;
uniform vec2 uSize;
uniform vec3 uSun, uShallow, uDeep, uSky, uGlint;
uniform sampler2D uDepth, uFoam;
varying vec3 vW;
#include <common>
#include <fog_pars_fragment>

// O undă: d = direcția, f = frecvența, a = amplitudinea, s = viteza; adună derivatele înălțimii.
void wave(inout vec2 g, vec2 p, vec2 d, float f, float a, float s) { g += a * f * d * cos(f * dot(d, p) + s * uTime); }

void main() {
  vec2 p = vW.xz, g = vec2(0.0);
  wave(g, p, normalize(vec2(1.0, 0.35)), 1.3, 0.050, 1.1);
  wave(g, p, normalize(vec2(-0.4, 1.0)), 1.9, 0.035, 1.5);
  wave(g, p, normalize(vec2(0.7, -0.8)), 3.7, 0.018, 2.3);
  wave(g, p, normalize(vec2(-0.9, -0.2)), 6.1, 0.010, 3.1);
  wave(g, p, normalize(vec2(0.2, 0.95)), 11.0, 0.006, 4.2);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vW);

  vec2 uv = p / uSize;
  bool inside = uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0;
  float k = inside ? clamp((70.0 - texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r * 255.0) / 55.0, 0.0, 1.0) : 1.0; // 0 = mal, 1 = larg
  float fm = inside ? texture2D(uFoam, vec2(uv.x, 1.0 - uv.y)).a : 0.0;

  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, k));
  col *= 0.82 + 0.18 * N.y + 0.35 * (g.x + g.y); // creste și văi luminate diferit
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col = mix(col, uSky, clamp(fres * 0.85, 0.0, 0.6));
  vec3 R = reflect(-uSun, N);
  float sp = pow(max(dot(R, V), 0.0), 180.0) * 2.2 + pow(max(dot(R, V), 0.0), 24.0) * 0.12;
  col += uGlint * sp * (1.0 - uNight);

  // spumă: margine albă la mal + benzi care curg spre uscat (fm crește spre mal)
  float n = sin(p.x * 2.3 + uTime * 0.7) * sin(p.y * 1.9 - uTime * 0.5);
  float band = smoothstep(0.72, 0.97, sin(fm * 16.0 - uTime * 1.8 + n * 1.5) * 0.5 + 0.5) * smoothstep(0.15, 0.6, fm) * (1.0 - smoothstep(0.85, 1.0, fm));
  float rim = smoothstep(0.9, 1.0, fm) * (0.35 + 0.25 * sin(p.x * 5.0 + p.y * 3.0 + uTime * 2.0)); // margine subțire, care pulsează
  float foam = clamp(rim + band * 0.4, 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.99, 1.0), foam);

  col *= vec3(1.0 - 0.6 * uNight, 1.0 - 0.55 * uNight, 1.0 - 0.3 * uNight);
  float alpha = max(mix(0.62, 0.94, k) + fres * 0.2, foam);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** depthTex / foamTex: texturile de câte un pixel pe placă ale straturilor existente (refăcute la nivelare, se citesc direct). */
export function createUltraWater(s, depthTex, foamTex) {
  const material = new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: DoubleSide, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uNight: { value: 0 }, uSize: { value: [s.w, s.h] },
      uSun: { value: SUN_DIR.clone() }, uShallow: { value: new Color('#3fc2c0') }, uDeep: { value: new Color('#1b5e96') },
      uSky: { value: new Color('#b9dcf2') }, uGlint: { value: new Color('#fff1cf') },
      uDepth: { value: null }, uFoam: { value: null },
    }]),
  });
  material.uniforms.uDepth.value = depthTex; material.uniforms.uFoam.value = foamTex;
  return {
    material,
    tick(t, night) { material.uniforms.uTime.value = t; material.uniforms.uNight.value = night; },
    dispose() { material.dispose(); },
  };
}
