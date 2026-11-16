// Constructor de geometrie cu culori pe vârfuri: triunghiuri, patrulatere, cutii orientate, panglici pe polilinii.
import { BufferGeometry, Float32BufferAttribute, Color } from 'three';

const tmp = new Color();
export class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  get empty() { return this.p.length === 0; }
  /** Triunghi; `hint` = direcția dorită a normalei (răsucește automat dacă e invers). */
  tri(a, b, c, col, hint, uv) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; if (uv) uv = [uv[0], uv[2], uv[1]]; }
    tmp.set(col);
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(tmp.r, tmp.g, tmp.b); }
    if (uv) for (const q of uv) this.u.push(q[0], q[1]); else this.u.push(0, 0, 0, 0, 0, 0);
  }
  quad(a, b, c, d, col, hint, uv) {
    this.tri(a, b, c, col, hint, uv && [uv[0], uv[1], uv[2]]);
    this.tri(a, c, d, col, hint, uv && [uv[0], uv[2], uv[3]]);
  }
  /** Cutie orientată: centru, axa lungă (tx,tz) în plan, semi-dimensiuni (lungime, lățime, înălțime), fără fundul. */
  obox(cx, cy, cz, tx, tz, hl, hw, hh, col, bottom = false) {
    const rx = -tz, rz = tx, P = (s, r, h) => [cx + tx * hl * s + rx * hw * r, cy + hh * h, cz + tz * hl * s + rz * hw * r];
    const A = P(-1, -1, 1), B = P(1, -1, 1), C = P(1, 1, 1), D = P(-1, 1, 1), E = P(-1, -1, -1), F = P(1, -1, -1), G = P(1, 1, -1), H = P(-1, 1, -1);
    this.quad(A, B, C, D, col, [0, 1, 0]);
    this.quad(A, B, F, E, col, [-rx, 0, -rz]); this.quad(D, C, G, H, col, [rx, 0, rz]);
    this.quad(B, C, G, F, col, [tx, 0, tz]); this.quad(A, D, H, E, col, [-tx, 0, -tz]);
    if (bottom) this.quad(E, F, G, H, col, [0, -1, 0]);
  }
  /** Panglică de-a lungul unei polilinii [[x,y,z],...]: sus + laterale. off = decalaj lateral, y0..y1 = jos..sus față de y-ul punctului. */
  ribbon(pts, hw, y0, y1, col, side = col, off = 0, jit = 0) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const rx = -dz, rz = dx, p = pts[i];
      L.push([p[0] + rx * (off - hw), p[1], p[2] + rz * (off - hw)]); R.push([p[0] + rx * (off + hw), p[1], p[2] + rz * (off + hw)]);
    }
    const up = (q, h) => [q[0], q[1] + h, q[2]];
    for (let i = 0; i + 1 < pts.length; i++) {
      let top = col;
      if (jit) { const k = 1 + jit * ((Math.abs(Math.sin(pts[i][0] * 91.7 + pts[i][2] * 57.3 + i) * 43758.5) % 1) - 0.5); top = tmp.set(col).multiplyScalar(k).getHex(); }
      this.quad(up(L[i], y1), up(R[i], y1), up(R[i + 1], y1), up(L[i + 1], y1), top, [0, 1, 0]);
      if (y1 > y0) {
        this.quad(up(L[i], y1), up(L[i + 1], y1), up(L[i + 1], y0), up(L[i], y0), side, [L[i][0] - R[i][0], 0, L[i][2] - R[i][2]]);
        this.quad(up(R[i], y1), up(R[i + 1], y1), up(R[i + 1], y0), up(R[i], y0), side, [R[i][0] - L[i][0], 0, R[i][2] - L[i][2]]);
      }
    }
  }
  geometry(withUv = false) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    if (withUv) g.setAttribute('uv', new Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere();
    return g;
  }
}
