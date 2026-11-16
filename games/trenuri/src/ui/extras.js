// Legătura dintre joc și noile panouri: marcaje pe hartă, „De făcut”, catalog, lista de trenuri, „Arată pe hartă”.
import { computeTodos } from '../sim/index.js';
import { viewer } from '../sim/viewer.js';
import { createMarkers } from '../render/markers.js';
import { openTodo } from './todo.js';
import { openCatalog } from './catalog.js';
import { openTrainList } from './trainList.js';
import { openBuyWizard } from './buyWizard.js';
import { openWhereAmI, logStep } from './whereAmI.js';
import { createTrainLabels } from './trainLabels.js';

/** ctx: { stage, uiRoot, panels, camera, state(), view(), hud, tools, pause(id,on) } */
export function createExtras(ctx) {
  const markers = createMarkers(ctx.uiRoot, { camera: ctx.stage.camera, groundAt: (x, z) => (ctx.view() ? ctx.view().ground.at(x, z) : 0), onPick: (it) => go(it) });
  const labels = createTrainLabels(ctx.uiRoot, { camera: ctx.stage.camera, state: ctx.state, view: ctx.view, zoom: () => ctx.camera.cam.dist });
  let items = [], t = 0, on = false;

  function focus(x, y) { const c = ctx.camera; c.focus(x + 0.5, y + 0.5, Math.min(c.cam.dist, 22)); }
  /** Camera merge la locul din listă și se deschide panoul potrivit. */
  function go(it) {
    const s = ctx.state();
    focus(it.x, it.y);
    const r = it.ref;
    if (!r) return;
    if (r.type === 'train') { const tr = s.trains.find((q) => q.id === r.id); if (tr) ctx.panels.train(s, tr); }
    else if (r.type === 'station') { const st = s.stations.find((q) => q.id === r.id); if (st) ctx.panels.station(s, st); }
    else if (r.type === 'industry') { const o = s.industries.find((q) => q.id === r.id); if (o) ctx.panels.industry(s, o); }
    else if (r.type === 'city') { const c = s.cities.find((q) => q.id === r.id); if (c) ctx.panels.city(s, c); }
  }
  function refresh() {
    const s = ctx.state();
    items = on && s ? computeTodos(s, viewer.co) : [];
    markers.set(items);
    ctx.hud.setTodo(items.length);
  }
  const api = {
    markers,
    /** Pornit doar în joc (nu în demo). */
    enable(b) { on = b; markers.show(b); labels.show(b); markers.clear(); items = []; ctx.hud.setTodo(0); t = 0.9; },
    update(dt) { t += dt; if (t >= 1) { t = 0; refresh(); } },
    frame(dt = 0.016) { markers.frame(); labels.frame(dt); },
    /** Pe conductor: „Unde am rămas”. */
    conductor() { openWhereAmI(ctx.panels.card, ctx.state(), { show: (x, y) => api.show(x, y), buy: () => api.buy(), last: ctx.helper ? ctx.helper.last : '' }); },
    buy() { openBuyWizard(ctx.panels.card, ctx.state(), ctx.tools, api, ctx.hud); },
    log(cmd) { logStep(cmd, ctx.state().date); },
    todo() { refresh(); openTodo(ctx.panels.card, items, go); },
    catalog() { openCatalog(ctx.panels.card, ctx.state(), ctx.tools); },
    trains() { openTrainList(ctx.panels.card, ctx.state(), { pause: ctx.pause, pick: (tr) => { const st = ctx.state().stations.find((q) => q.id === tr.to); if (st) focus(st.x, st.y); ctx.panels.train(ctx.state(), tr); } }); },
    /** „Arată pe hartă”: camera merge acolo și apare un 📍. */
    show(x, y) { focus(x, y); markers.ping(x, y); },
    go,
  };
  return api;
}
