// Semafoare 3D la fiecare semnal din state.signals: stâlp, cap cu două lumini (roșu sus, verde jos), cea aprinsă strălucește.
// signalAspect vine din sim/signals.js; dacă lista state.signals lipsește (salvări vechi), nu desenăm nimic.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, SphereGeometry } from 'three';
import { DX, DY } from '../sim/consts.js';
import { Builder } from './geo.js';
import { signalAspect } from '../sim/signals.js';

const aspectFn = signalAspect;

const lam = new MeshLambertMaterial({ vertexColors: true });
const lampGeo = new SphereGeometry(0.045, 8, 6);
const RED_ON = new MeshBasicMaterial({ color: 0xff2a2a }), RED_OFF = new MeshBasicMaterial({ color: 0x501414 });
const GRN_ON = new MeshBasicMaterial({ color: 0x38ff5a }), GRN_OFF = new MeshBasicMaterial({ color: 0x0f3f1a });
let postGeo = null;

function post() { // stâlp + casetă; fața (lămpile) spre -z
  if (postGeo) return postGeo;
  const B = new Builder();
  B.obox(0, 0.2, 0, 0, 1, 0.012, 0.012, 0.2, '#555a62');
  B.obox(0, 0.36, 0, 0, 1, 0.03, 0.06, 0.1, '#23262b');
  B.obox(0, 0.43, 0.0, 0, 1, 0.035, 0.065, 0.012, '#23262b'); // vizieră
  B.obox(0, 0.02, 0, 0, 1, 0.06, 0.06, 0.02, '#777c84');
  return (postGeo = B.geometry());
}

function head(dirIdx, side) { // semafor pentru sensul dirIdx; side = +1 / -1 decalaj lateral
  const gr = new Group(), body = new Mesh(post(), lam), red = new Mesh(lampGeo, RED_ON), grn = new Mesh(lampGeo, GRN_OFF);
  body.userData.cast = true;
  red.position.set(0, 0.395, -0.036); grn.position.set(0, 0.325, -0.036);
  gr.add(body, red, grn);
  gr.position.x = 0.3 * side;
  const pivot = new Group();
  gr.scale.setScalar(1.6);
  pivot.add(gr);
  pivot.rotation.y = Math.atan2(DX[dirIdx], DY[dirIdx]);
  return { pivot, red, grn };
}

export function createSignals(s, g) {
  const root = new Group(), items = new Map();
  let key = '', chk = 0;
  function build() {
    for (const it of items.values()) root.remove(it.group);
    items.clear();
    for (const sg of s.signals) {
      const group = new Group(), hs = [head(sg.dir, 1)];
      if (sg.twoWay) hs.push(head((sg.dir + 4) & 7, 1));
      for (const h of hs) group.add(h.pivot);
      group.position.set(sg.x + 0.5, g.tileY(sg.x, sg.y), sg.y + 0.5);
      root.add(group); items.set(sg.id, { group, hs, a: -1, sg });
    }
  }
  return {
    root,
    update(dt) {
      if (!Array.isArray(s.signals) || !aspectFn) return;
      chk -= dt;
      if (chk <= 0) { chk = 0.4; const k = s.signals.map((q) => q.id + ':' + q.x + ':' + q.y + ':' + q.dir + q.twoWay).join(); if (k !== key) { key = k; build(); } }
      for (const [id, it] of items) {
        const a = aspectFn(s, id) | 0;
        if (a === it.a) continue;
        it.a = a;
        it.hs.forEach((h) => { const green = a === 1; h.red.material = green ? RED_OFF : RED_ON; h.grn.material = green ? GRN_ON : GRN_OFF; });
      }
    },
  };
}
