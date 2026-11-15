// Configurația serverului, citită din variabile de mediu. Valorile implicite sunt cele din container.
import { resolve } from 'node:path';

const serverDir = resolve(import.meta.dirname, '..');

function int(v, def, min, max) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
}

/** Construiește configurația; `overrides` e folosit de teste (port 0, director temporar, ceas fals). */
export function loadConfig(overrides = {}, env = process.env) {
  const cfg = {
    host: env.HOST || '0.0.0.0',
    port: int(env.PORT, 8787, 0, 65535),
    dataDir: resolve(env.DATA_DIR || '/data'),
    distDir: resolve(env.DIST_DIR || resolve(serverDir, '..', 'dist')),
    publicDir: resolve(serverDir, 'public'),
    adminUser: env.ADMIN_USER || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    timeZone: 'Europe/Bucharest',
    // Antetele X-Forwarded-* sunt crezute doar de la proxy (tailscale serve). Implicit: doar de la loopback.
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    loginDelayMs: 300,
    loginMaxFails: 5,
    loginBlockMs: 15 * 60 * 1000,
    sessionDays: 30,
    maxBodyBytes: 16 * 1024,
    maxProgressBytes: 64 * 1024,
    now: () => Date.now(),
    log: (...a) => console.log(new Date().toISOString(), ...a),
  };
  return Object.assign(cfg, overrides);
}
