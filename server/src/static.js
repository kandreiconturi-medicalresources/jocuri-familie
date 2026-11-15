// Fișiere statice: doar din directoare fixe (dist/ și public/ pentru login), cu path.resolve + verificare de prefix.
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Decodează și normalizează calea din URL. Întoarce segmentele sau null dacă e suspectă
 * (octet nul, backslash, segmente care încep cu punct, codare invalidă).
 */
export function safeSegments(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0') || p.includes('\\') || !p.startsWith('/')) return null;
  const segs = p.split('/').filter(Boolean);
  for (const s of segs) if (s.startsWith('.') || s.includes(':')) return null;
  return segs;
}

/** Calea absolută din `root`, garantat în interiorul lui (sau null). */
export function inside(root, segs) {
  const full = resolve(root, ...segs);
  return full === root || full.startsWith(root + sep) ? full : null;
}

export function createStatic(rootDir) {
  const root = resolve(rootDir);
  let realRoot = null;

  async function fileAt(full) {
    try {
      const st = await stat(full);
      if (!realRoot) realRoot = await realpath(root);
      const real = await realpath(full);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) return null; // fără legături simbolice în afară
      return st;
    } catch { return null; }
  }

  function send(req, res, full, st) {
    const ext = extname(full).toLowerCase();
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const immutable = /[\\/]assets[\\/]/.test(full.slice(root.length)) && ext !== '.html';
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache',
      ETag: etag,
      'Last-Modified': st.mtime.toUTCString(),
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(full);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  /**
   * Servește `pathname`. Directoare → index.html (cu redirect la „/” final, ca să meargă căile relative).
   * Căi fără extensie inexistente → index.html (SPA). Întoarce false dacă nu a găsit nimic.
   */
  async function serve(req, res, pathname, { spa = true } = {}) {
    const segs = safeSegments(pathname);
    if (!segs) return false;
    const full = inside(root, segs);
    if (!full) return false;
    const st = await fileAt(full);
    if (st && st.isFile()) { send(req, res, full, st); return true; }
    if (st && st.isDirectory()) {
      if (!pathname.endsWith('/')) {
        // Segmentele goale au fost eliminate, deci Location nu poate deveni „//alt-site”.
        res.writeHead(301, { Location: '/' + segs.map(encodeURIComponent).join('/') + '/', 'Content-Length': 0 });
        res.end();
        return true;
      }
      const idx = resolve(full, 'index.html');
      const ist = await fileAt(idx);
      if (ist && ist.isFile()) { send(req, res, idx, ist); return true; }
      return false;
    }
    const last = segs[segs.length - 1] || '';
    if (spa && !extname(last)) {
      const idx = resolve(root, 'index.html');
      const ist = await fileAt(idx);
      if (ist && ist.isFile()) { send(req, res, idx, ist); return true; }
    }
    return false;
  }

  return { serve, root };
}
