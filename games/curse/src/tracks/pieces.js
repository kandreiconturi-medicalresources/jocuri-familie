// Piese de drum Kenney (grilă 1x1). Pur: fără Three/DOM, ca să se poată testa.
// Cadru local al piesei: (r, f) = (dreapta, înainte) față de celula de intrare (0,0), în unități de dală.
// Modelul GLB (măsurat din fișiere): dala ocupă x∈[0,n], z∈[-n,0]; intrarea e la mijlocul muchiei z=0, mersul e spre -z.
// Colțurile se rotesc spre +x (dreapta) cu raza n-0.5 în jurul colțului (n, 0) al dalei.

export const TILE = 10;          // metri per dală
export const ROAD_HALF = 3.5;    // jumătate din lățimea asfaltului (0.35 dală)
export const SHOULDER = 4.6;     // până unde ține bordura/iarba tăiată (în rest: iarbă)
export const RAMP = 0.27;        // înălțimea rampei, în dale
export const DECK = 0.52;        // înălțimea punții, în dale
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, V (z crește spre sud)

function arc(n, side) {
  const r = n - 0.5, k = 6 + n * 4, pts = [];
  for (let i = 0; i <= k; i++) {
    const t = (i / k) * Math.PI / 2;
    pts.push([side * (r - r * Math.cos(t)), r * Math.sin(t)]);
  }
  return pts;
}

function box(w, l, side) {
  const c = [];
  for (let f = 0; f < l; f++) for (let r = 0; r < w; r++) c.push([side * r, f]);
  return c;
}

const straight = (model, len, extra = {}) => ({
  model, cells: box(1, len, 1), next: [0, len], turn: 0, pts: [[0, 0], [0, len]], dy: 0, ...extra,
});
const corner = (model, n, side) => ({
  model, cells: box(n, n, side), next: [side * n, n - 1], turn: side, pts: arc(n, side), dy: 0, mirror: side < 0,
});

/** Jetoanele pistei (un caracter = o piesă). */
export const PIECES = {
  s: straight('roadStraight', 1),
  S: straight('roadStraightLong', 2),
  t: straight('roadStart', 2, { line: 1, pts: [[0, 0], [0, 1], [0, 2]] }), // linia de start e la mijlocul piesei
  r: corner('roadCornerSmall', 1, 1), l: corner('roadCornerSmall', 1, -1),
  R: corner('roadCornerLarge', 2, 1), L: corner('roadCornerLarge', 2, -1),
  X: corner('roadCornerLarger', 3, 1), Y: corner('roadCornerLarger', 3, -1),
  a: straight('roadRamp', 1, { dy: RAMP }),               // rampă în sus
  d: straight('roadRamp', 1, { dy: -RAMP, flip: true }),  // rampă în jos (același model, întors)
  b: straight('roadStraightBridge', 1, { level: 1, deck: DECK }), // podul
};

export const MODELS = [...new Set(Object.values(PIECES).map((p) => p.model))];
