// Atlasuri Kenney: încărcare + sprite-uri pre-scalate (cache pe dimensiunea reală în pixeli).
import tilesJson from '../assets/kenney/tiles.json';
import enemiesJson from '../assets/kenney/enemies.json';
import bgJson from '../assets/kenney/backgrounds.json';

const URLS = {
  tiles: new URL('../assets/kenney/tiles.png', import.meta.url).href,
  enemies: new URL('../assets/kenney/enemies.png', import.meta.url).href,
  bg: new URL('../assets/kenney/backgrounds.png', import.meta.url).href,
};
const sheets = {
  tiles: { json: tilesJson, img: null },
  enemies: { json: enemiesJson, img: null },
  bg: { json: bgJson, img: null },
};
let scale = 1;
const cache = new Map();

export function loadAtlas() {
  return Promise.all(Object.keys(sheets).map((k) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { sheets[k].img = img; res(); };
    img.onerror = () => rej(new Error('Nu pot încărca ' + k));
    img.src = URLS[k];
  })));
}

export const getScale = () => scale;
export function setAtlasScale(s) {
  if (Math.abs(s - scale) > 0.01) { scale = s; cache.clear(); }
}

export const hasFrame = (sheet, name) => !!sheets[sheet].json[name];
export const sheetImage = (sheet) => sheets[sheet].img;
export const frameRect = (sheet, name) => sheets[sheet].json[name];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Cadrul pre-scalat la dimensiunea ecranului (canvas), sau null dacă lipsește. */
export function sprite(sheet, name, w = 32) {
  const r = sheets[sheet].json[name];
  if (!r) return null;
  const px = Math.max(2, Math.min(r[2], Math.ceil(w * scale)));
  const key = sheet + '/' + name + '/' + px;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(px, Math.round(px * r[3] / r[2]));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(sheets[sheet].img, r[0], r[1], r[2], r[3], 0, 0, c.width, c.height);
    cache.set(key, c);
  }
  return c;
}

/** Desenează un cadru (x,y = colț stânga-sus, w×h logic). `flip` oglindește pe orizontală. */
export function drawSpr(ctx, sheet, name, x, y, w = 32, h = w, flip = false) {
  const c = sprite(sheet, name, w);
  if (!c) return;
  if (flip) {
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0, w, h); ctx.restore();
  } else ctx.drawImage(c, x, y, w, h);
}
