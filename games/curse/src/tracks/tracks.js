// Cele 8 piste: jetoane (vezi pieces.js) + temă. Pur: culorile sunt numere hex, scena le folosește.
// Jetoane: s/S dreaptă 1/2, t start, r l colț mic, R L colț mare, X Y colț foarte mare, a d rampă sus/jos, b pod.
// Fiecare pistă începe cu 2 drepte (grila de start) înainte de „t”, iar lungimea crește treptat.

const T = (id, name, tokens, theme) => ({ id, name, tokens, theme });

export const TRACKS = [
  T('parc', 'Parcul Verde', 'sstssssssssRssssssssssRssssssssssssRssssssssssR', {
    sky: [0x3f9bea, 0xcfeeff], fog: 0xcfeeff, near: 120, far: 520, ground: 0x6fc653, asphalt: 0x585866,
    sun: 1.05, hemi: [0xdff3ff, 0x5a8a4a], decor: [['treeLarge', 1], ['treeSmall', 1.2]], leaf: 0x4fb04a,
  }),
  T('plaja', 'Plaja la Apus', 'ssstXsssssssrlsssssXsssssssXsssssssssssssXsss', {
    sky: [0xff6f61, 0xffd9a0], fog: 0xffc9a0, near: 110, far: 500, ground: 0xf0cf8d, asphalt: 0x5a4f62,
    sun: 1.0, sunColor: 0xffb070, hemi: [0xffe6c8, 0xb08a5a], decor: [['treeSmall', 1.4], ['tent', 0.5], ['flagRed', 0.5]], leaf: 0x3fae5a,
  }),
  T('desert', 'Deșertul', 'sstXsssXssssssssslssssXsRsssssssRsssLsLsrrsssssss', {
    sky: [0xf4a949, 0xffe9b8], fog: 0xffe0a8, near: 130, far: 560, ground: 0xe3b062, asphalt: 0x6a5a52,
    sun: 1.15, sunColor: 0xfff0c8, hemi: [0xffefc8, 0xb9843c], decor: [['treeSmall', 0.8], ['pylon', 1.6], ['billboard', 0.4]], leaf: 0x9a8a3a,
  }),
  T('oras', 'Orașul Noaptea', 'sstRlsslsrsssRsssRlsssrssssssrsssLsslsssrsssrsssssssRss', {
    sky: [0x070b2c, 0x2a2f6e], fog: 0x161a44, near: 70, far: 380, ground: 0x2b3144, asphalt: 0x3a3a46,
    sun: 0.35, sunColor: 0x9db4ff, hemi: [0x6a78c8, 0x1c2036], night: true, decor: [['lightPostLarge', 2], ['billboard', 0.5]], leaf: 0x2a7a5a, city: true,
  }),
  T('zapada', 'Muntele cu Zăpadă', 'sstssXsssssssssXsYssssRssssXssYsssXssXssssssLssssXs', {
    sky: [0x7fa8e0, 0xeaf4ff], fog: 0xe6f0fb, near: 90, far: 440, ground: 0xf3f8ff, asphalt: 0x4f5766,
    sun: 1.0, hemi: [0xe8f2ff, 0x9fb4d0], decor: [['treeLarge', 1.4], ['treeSmall', 1]], leaf: 0x2f7a6a,
  }),
  T('padure', 'Pădurea', 'sstXssssXsssssssssRssLssXsssslsssRssrssssLXsssXsssssssslsss', {
    sky: [0x5aa07a, 0xb9e0c0], fog: 0x9fcfa8, near: 60, far: 330, ground: 0x2f8040, asphalt: 0x4f4a48,
    sun: 0.85, hemi: [0xc8f0c8, 0x274a2a], decor: [['treeLarge', 3.2], ['treeSmall', 2.4]], leaf: 0x2e8b3c,
  }),
  T('pod', 'Circuitul cu Pod', 'sstaabddssssssssssssrssssssssRssssssssssssRsssssssssssssssssLsssssssYsssssYss', {
    sky: [0x6a5acd, 0xffc4e8], fog: 0xf0c8e8, near: 110, far: 500, ground: 0x8ccf55, asphalt: 0x56506a,
    sun: 1.0, sunColor: 0xffd0b0, hemi: [0xf0e0ff, 0x6a8a4a], decor: [['treeLarge', 1], ['treeSmall', 1], ['flagGreen', 0.5]], leaf: 0x5cb54a,
  }),
  T('premiu', 'Marele Premiu', 'sstsXsssssRssLssXsssssRssssLsssssssssRsslssssrsssssRsRsssLsssssYsssssRsssssRsssLs', {
    sky: [0x2d6cdf, 0xb0e2ff], fog: 0xb8e4ff, near: 140, far: 600, ground: 0x62c06c, asphalt: 0x4a4a58,
    sun: 1.1, hemi: [0xe0f4ff, 0x5a8a5a], decor: [['grandStand', 0.6], ['treeLarge', 0.7], ['flagCheckers', 0.5], ['billboard', 0.4]], leaf: 0x48a64a,
  }),
];

export const CAR_COLORS = [
  { id: 'Red', name: 'Roșu', hex: '#e8433c' },
  { id: 'Green', name: 'Verde', hex: '#4cc24f' },
  { id: 'Orange', name: 'Portocaliu', hex: '#ff9a2e' },
  { id: 'White', name: 'Alb', hex: '#f1f1f1' },
];
