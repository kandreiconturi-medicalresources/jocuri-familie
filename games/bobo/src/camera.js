// Camera: urmărește jucătorul (sau liderul în 2 jucători), cu anticipare și netezire. Înălțimea nivelului = ecranul.
import { TS } from './tiles.js';

export const createCamera = () => ({ x: 0, look: 0 });

export function updateCamera(g, snap) {
  const cam = g.cam, vw = g.view.vw, alive = g.players.filter((p) => !p.dead);
  const list = g.net ? [g.local] : alive.length ? alive : g.players; // în rețea, fiecare ecran îl urmărește pe jucătorul lui
  let focus;
  if (list.length === 1) {
    const p = list[0];
    cam.look += (p.face * 50 - cam.look) * 0.05;
    focus = p.x + p.w / 2 + cam.look - vw * 0.45;
  } else {
    const lead = Math.max(...list.map((p) => p.x + p.w / 2));
    focus = lead - vw * 0.58;
  }
  const max = Math.max(0, g.level.width * TS - vw);
  const t = Math.max(0, Math.min(max, focus));
  cam.x = snap ? t : cam.x + (t - cam.x) * 0.14;
  cam.x = Math.max(0, Math.min(max, cam.x));
}
