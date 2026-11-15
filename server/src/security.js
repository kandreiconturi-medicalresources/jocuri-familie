// Antete de securitate, verificarea Origin (CSRF), IP-ul clientului, citirea corpului JSON și răspunsuri.

export const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

export function setSecurityHeaders(res) {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
}

const isLoopback = (a) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
const fromProxy = (req, cfg) => cfg.trustProxy || isLoopback(req.socket.remoteAddress || '');
const lastValue = (h) => (typeof h === 'string' ? h.split(',').pop().trim() : '');

/** IP-ul clientului: X-Forwarded-For (ultima valoare) doar de la proxy-ul de încredere. */
export function clientIp(req, cfg) {
  const direct = req.socket.remoteAddress || '';
  if (fromProxy(req, cfg)) {
    const fwd = lastValue(req.headers['x-forwarded-for']);
    if (fwd && fwd.length <= 64) return fwd;
  }
  return direct;
}

/** Host-urile acceptate pentru Origin: Host-ul cererii și, de la proxy, X-Forwarded-Host. */
function expectedHosts(req, cfg) {
  const hosts = [];
  if (typeof req.headers.host === 'string') hosts.push(req.headers.host.toLowerCase());
  if (fromProxy(req, cfg)) {
    const fh = lastValue(req.headers['x-forwarded-host']);
    if (fh) hosts.push(fh.toLowerCase());
  }
  return hosts;
}

/** Origin prezent și egal cu host-ul (schema http/https). */
export function originOk(req, cfg) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === 'null') return false;
  let u;
  try { u = new URL(origin); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password || (u.pathname !== '/' && u.pathname !== '')) return false;
  return expectedHosts(req, cfg).includes(u.host.toLowerCase());
}

export function isJsonContentType(req) {
  const ct = req.headers['content-type'];
  return typeof ct === 'string' && ct.split(';')[0].trim().toLowerCase() === 'application/json';
}

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

/** Citește corpul JSON (cel mult `limit` octeți). Corp gol → {}. Doar obiecte. */
export function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.resume(); return reject(new HttpError(413, 'too_large')); }
    const chunks = [];
    let size = 0, done = false;
    const fail = (err) => { if (!done) { done = true; reject(err); } };
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { fail(new HttpError(413, 'too_large')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('error', () => fail(new HttpError(400, 'bad_body')));
    req.on('end', () => {
      if (done) return;
      done = true;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) return resolve({});
      let v;
      try { v = JSON.parse(text); } catch { return reject(new HttpError(400, 'bad_json')); }
      if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(new HttpError(400, 'bad_json'));
      resolve(v);
    });
  });
}

export function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export function redirect(res, location, status = 302) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store', 'Content-Length': 0 });
  res.end();
}
