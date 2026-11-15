// Jocul în sine: lumea curentă, pașii simulării (cu viteză), comenzi, unelte, salvare locală.
import { createWorld, applyCommand, stepWorld, serialize, deserialize, ERR_TEXT, SIM_HZ } from './sim/index.js';
import { createView } from './render/view.js';
import { createCamera } from './input/camera.js';
import { bindPointer } from './input/pointer.js';
import { createTools } from './input/tools.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { sfx, defineSfx, unlockAudio } from '../../../shared/engine/audio.js';

defineSfx({
  build: [[300, 500, 0.08, 'square', 0.12], [500, 700, 0.1, 'square', 0.12, 0.08]],
  cash: [[880, 1320, 0.1, 'triangle', 0.14], [1320, 1760, 0.12, 'triangle', 0.14, 0.09]],
  nope: [[220, 140, 0.18, 'sawtooth', 0.12]],
});

export function createGame({ stage, canvas, uiRoot, save, onHome }) {
  let s = null, view = null, speed = 1, simAcc = 0, follow = null, orbit = false, saveT = 0, lastCash = 0, clock = 0;
  const camera = createCamera(stage, { w: 64, h: 64 });
  const exec = (cmd) => {
    const r = applyCommand(s, { by: 0, ...cmd });
    if (r.ok) sfx('build'); else { sfx('nope'); hud.hint(ERR_TEXT[r.err] || 'Nu merge asta.', true); }
    return r;
  };
  const panels = createPanels(uiRoot, { sell: (id) => exec({ type: 'sellTrain', trainId: id }) });
  const hud = createHud(uiRoot, {
    speed: (v) => { speed = v; hud.setSpeed(v); },
    tool: (id) => tools.setTool(id),
    news: () => panels.news(s),
    home: () => { game.save(); onHome(); },
  });
  const tools = createTools({
    state: () => s, view: () => view, hud, panels, exec, errText: (k) => ERR_TEXT[k],
    canAfford: (c) => s.sandbox || s.companies[0].cash >= c,
    follow: (id) => { follow = { id, until: clock + 5 }; },
  });
  const pickTile = (p) => {
    const x = Math.floor(p.fx), y = Math.floor(p.fz);
    return x < 0 || y < 0 || x >= s.w || y >= s.h ? null : { x, y, fx: p.fx, fz: p.fz };
  };
  bindPointer(canvas, camera, pickTile, {
    groundAt: (x, z) => (view ? view.ground.at(x, z) : 0),
    wantsDrag: () => !orbit && tools.wantsDrag(), tap: (t) => { if (!orbit) tools.tap(t); }, hover: (t) => { if (!orbit) tools.hover(t); },
    dragStart: (t) => tools.dragStart(t), dragMove: (t) => tools.dragMove(t), dragEnd: (t, m) => tools.dragEnd(t, m), dragCancel: () => tools.dragCancel(),
  });
  canvas.addEventListener('pointerdown', () => { follow = null; unlockAudio(); });

  const game = {
    camera, get state() { return s; }, hud,
    setWorld(state, { demo = false } = {}) {
      if (view) view.dispose();
      s = state; view = createView(stage, s);
      camera.setWorld(s.w, s.h);
      camera.focus(s.w / 2, s.h / 2, Math.max(s.w, s.h) * (demo ? 0.7 : 0.5));
      orbit = demo; simAcc = 0; lastCash = s.companies[0].cash;
      uiRoot.classList.toggle('demo', demo);
      for (const e of hud.el) e.classList.toggle('hidden', demo);
      panels.close(); tools.setTool('track');
      if (!demo) { speed = 1; hud.setSpeed(1); hud.setDate(s.date); hud.setMoney(s.companies[0].cash, s.sandbox); }
      else speed = 1;
      view.trains.onStep();
    },
    newWorld(size, demo) { game.setWorld(createWorld({ seed: (Math.random() * 4294967295) >>> 0, size }), { demo }); },
    load(saved) { game.setWorld(deserialize(saved.state)); speed = saved.speed || 1; hud.setSpeed(speed); },
    save() { if (s && !orbit) save.set('auto', { v: 1, state: serialize(s), speed }); },
    update(dt) {
      if (!s) return;
      clock += dt;
      saveT += dt;
      if (saveT > 30) { saveT = 0; game.save(); }
      camera.update(dt);
      if (orbit) camera.rotate(dt * 0.06);
      simAcc += dt * speed * SIM_HZ;
      let n = 0;
      while (simAcc >= 1 && n++ < 8) { stepWorld(s); view.trains.onStep(); simAcc -= 1; }
      if (simAcc > 1) simAcc = 0;
    },
    render(dt) {
      if (!s) return;
      if (follow) {
        const p = view.trains.positionOf(follow.id);
        if (p && clock < follow.until) { camera.cam.x += (p.x - camera.cam.x) * 0.06; camera.cam.z += (p.z - camera.cam.z) * 0.06; camera.apply(); } else follow = null;
      }
      stage.setFog(camera.cam.dist * 1.15, camera.cam.dist * 3.2);
      view.frame(speed ? simAcc : 1, dt, clock);
      const c = s.companies[0].cash;
      hud.setMoney(c, s.sandbox);
      if (c > lastCash + 50) sfx('cash');
      lastCash = c;
      hud.setDate(s.date);
      stage.render();
    },
  };
  return game;
}
