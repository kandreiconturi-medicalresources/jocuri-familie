// `npm run dev` (argumentele merg la Vite; pentru acces din rețea: npm run dev -- --host): pornește împreună serverul local (port 8787, date în .data/) și Vite (proxy /api, /ws, /login).
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const procs = [
  spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--env-file=server/dev.env', 'server/src/index.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, PORT: '8787' } }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.exitCode === null) p.kill();
  process.exitCode = code;
};
for (const p of procs) p.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
