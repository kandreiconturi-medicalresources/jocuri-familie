// Parcelele cumpărate (etapa 7.4): chenar subțire, în culoarea stăpânului, pe teren (doar în lumea cu insule).
import { Group, LineSegments, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Color } from 'three';
import { parcelsW } from '../sim/landBase.js';

export function createLand(s, g, colorOf) {
  const root = new Group();
  if (!s.land) return root;
  const w = parcelsW(s), pos = [], col = [], c = new Color();
  const dry = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && !s.water[y * s.w + x];
  const pt = (cx, cy) => [cx, g.tileY(Math.min(s.w - 1, cx), Math.min(s.h - 1, cy)) + 0.09, cy];
  for (let i = 0; i < s.land.length; i++) {
    const v = s.land[i];
    if (!v) continue;
    const px = (i % w) * 4, py = ((i / w) | 0) * 4;
    c.set(colorOf(v - 1));
    const seg = (ax, ay, bx, by, tx, ty) => { // o muchie de placă, doar dacă placa de lângă ea e uscat
      if (!dry(tx, ty)) return;
      pos.push(...pt(ax, ay), ...pt(bx, by)); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    for (let k = 0; k < 4; k++) {
      seg(px + k, py, px + k + 1, py, px + k, py); seg(px + k, py + 4, px + k + 1, py + 4, px + k, py + 3);
      seg(px, py + k, px, py + k + 1, px, py + k); seg(px + 4, py + k, px + 4, py + k + 1, px + 3, py + k);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const line = new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  line.frustumCulled = false; line.renderOrder = 4;
  root.add(line);
  return root;
}
