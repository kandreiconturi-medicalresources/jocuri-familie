// HUD pentru un jucător: poziție, tura, viteză, bară de nitro, minihartă, mesaje mari.
import { h } from '../../../../shared/ui/dom.js';

const ORD = ['', '1', '2', '3', '4'];

function drawMap(track, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  track.pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
  const sc = (size - 16) / Math.max(x1 - x0, z1 - z0);
  const ox = (size - (x1 - x0) * sc) / 2, oz = (size - (z1 - z0) * sc) / 2;
  const map = (p) => [ox + (p.x - x0) * sc, oz + (p.z - z0) * sc];
  g.lineJoin = g.lineCap = 'round';
  for (const [w, col] of [[8, 'rgba(20,10,50,.85)'], [4.5, '#e8e4ff']]) {
    g.lineWidth = w; g.strokeStyle = col; g.beginPath();
    track.pts.forEach((p, i) => { const [x, y] = map(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath(); g.stroke();
  }
  const [sx, sy] = map(track.pts[0]);
  g.fillStyle = '#ffd23f'; g.fillRect(sx - 4, sy - 4, 8, 8);
  return { img: c, map };
}

export function createHud(parent, track, side = 'full') {
  const pos = h('div', { class: 'pos' }), lap = h('div', { class: 'lap' }), spd = h('b', null, '0'), msg = h('div', { class: 'msg' });
  const nit = h('i'), nitBox = h('div', { class: 'nitro' }, nit, h('span', null, 'NITRO'));
  const SZ = 132, base = drawMap(track, SZ);
  const mm = h('canvas', { class: 'mini', width: SZ, height: SZ });
  const g = mm.getContext('2d');
  const reset = h('button', { class: 'reset' }, '↩ Înapoi pe pistă');
  const el = h('div', { class: 'hud ' + side }, pos, lap, h('div', { class: 'speed' }, spd, h('small', null, 'km/h')), nitBox, mm, msg, reset);
  parent.appendChild(el);
  let msgT = 0, frame = 0, lastPos = 0, lastNit = -1;
  return {
    el, reset,
    flash(text, ms = 1400, cls = '') { msg.textContent = text; msg.className = 'msg show ' + cls; msgT = ms; },
    update(race, car, dt, others) {
      if (msgT > 0 && (msgT -= dt * 1000) <= 0) msg.className = 'msg';
      if (car.rank !== lastPos) { lastPos = car.rank; pos.innerHTML = ''; pos.append(h('b', null, ORD[car.rank] || car.rank), h('small', null, '/' + race.cars.length)); }
      lap.textContent = 'Tura ' + Math.min(race.laps, car.lap + 1) + '/' + race.laps;
      spd.textContent = Math.round(Math.abs(car.speed) * 4);
      const n = Math.round(car.nitro * 20);
      if (n !== lastNit) { lastNit = n; nit.style.width = n * 5 + '%'; nitBox.classList.toggle('full', n >= 20); }
      nitBox.classList.toggle('on', car.boost > 0);
      if (car.wrong && !msgT) { msg.textContent = 'Ai greșit direcția!'; msg.className = 'msg show bad'; msgT = 600; }
      if ((frame++ & 3) === 0) {
        g.clearRect(0, 0, SZ, SZ); g.drawImage(base.img, 0, 0);
        for (const c of race.cars) {
          const [x, y] = base.map(c); g.fillStyle = c.color === 'White' ? '#fff' : { Red: '#ff4b4b', Green: '#4cd35e', Orange: '#ffa02e' }[c.color];
          g.beginPath(); g.arc(x, y, c === car ? 5 : 3.5, 0, 6.3); g.fill();
          if (c === car) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
        }
      }
    },
    destroy() { el.remove(); },
  };
}
