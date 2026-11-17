// Material de teren „Ultra” (doar PC): iarbă, stâncă și nisip amestecate per pixel după ponderile de pe vârfuri (atributul `tw`),
// iarbă la două scări (fără repetare vizibilă) și relief din luminozitatea texturii (bump). Culorile de pe vârfuri rămân aceleași.
import { MeshLambertMaterial, Color } from 'three';
import { grassTexture, rockTexture, sandTexture } from './texgen.js';

let mat = null;

/** Ponderile (stâncă, nisip) pentru un vârf: aceleași reguli ca la culori (pantă, înălțime, mal). */
export function terrainWeights(y, slope) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rock = Math.min(1, (y > 0.12 ? sm(0.08, 0.22, slope) : 0) + sm(1.1, 1.5, y) * 0.6);
  const sand = y < 0.08 ? sm(0.08, 0.02, y) : 0;
  return [rock, sand];
}

export function ultraTerrainMaterial() {
  if (mat) return mat;
  const grass = grassTexture(512), rock = rockTexture(512), sand = sandTexture(512);
  mat = new MeshLambertMaterial({ vertexColors: true, map: grass, bumpMap: grass, bumpScale: 1.4, color: new Color(1.2, 1.2, 1.15) });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rockMap = { value: rock }; sh.uniforms.sandMap = { value: sand };
    sh.vertexShader = sh.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec2 tw;\nvarying vec2 vTw;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTw = tw;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <bumpmap_pars_fragment>', `
uniform sampler2D rockMap;
uniform sampler2D sandMap;
varying vec2 vTw;
vec4 terrainTex(vec2 uv) {
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.31 + 0.37; // a doua scară, rotită: rupe repetarea
  vec4 g = texture2D(map, uv) * (0.45 + 0.65 * texture2D(map, uv2)); // firele rămân clare, scara mare dă pete
  vec4 r = texture2D(rockMap, uv * 0.55);
  vec4 s = texture2D(sandMap, uv * 0.8);
  return mix(mix(g, r, vTw.x), s, vTw.y);
}
vec4 terrainH(vec2 uv) { float l = dot(terrainTex(uv).rgb, vec3(0.3, 0.55, 0.15)); float k = 0.35 + 0.65 * max(vTw.x, vTw.y * 0.5); return vec4(l * k); }
#include <bumpmap_pars_fragment>`)
      .replace(/texture2D\( bumpMap, /g, 'terrainH( ')
      .replace('#include <map_fragment>', 'diffuseColor *= terrainTex( vMapUv );');
  };
  mat.customProgramCacheKey = () => 'terrain-ultra';
  return mat;
}
