// Efecte: tremur de ecran, bucăți de ladă, unde de șoc, particule + sunetele evenimentelor.
import { sfx } from '../../../../shared/engine/audio.js';
import { T } from './arena.js';

const LABEL = ['', '+ Bombă', '+ Rază', '+ Viteză', '+ Șut', '+ Scut', '+ Mănușă', '+ Telecomandă', 'Ciudățel!'];
const COLOR = ['', '#ddd', '#ff9f43', '#6fb7ff', '#7be08a', '#7ee9ff', '#ff8cc6', '#b79cff', '#d28cff'];

export function createFx(particles) {
  let shake = 0;
  const pieces = [], rings = [];
  const at = (e) => [(e.x + 0.5) * T, (e.y + 0.5) * T];

  function handle(ev, s) {
    const crate = s.arena.theme.crate;
    for (const e of ev) {
      if (e.e === 'place') sfx('place');
      else if (e.e === 'explode') {
        sfx('explode'); shake = Math.max(shake, 7);
        const [x, y] = at(e); rings.push({ x, y, t: 0 }); particles.burst(x, y, '#ff9f1c', 10);
      } else if (e.e === 'crate') {
        sfx('crate');
        const [x, y] = at(e), col = crate.includes('blue') ? '#6fb7ff' : crate.includes('green') ? '#5cc46a' : crate.includes('red') ? '#ff6b6b' : '#c98a4b';
        for (let k = 0; k < 7; k++) pieces.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: -1.5 - Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.7, life: 34, s: 5 + Math.random() * 6, col: k % 2 ? col : '#8a5a2b' });
        particles.dust(x, y, 4);
        if (e.loot) particles.sparkle(x, y, 3);
      } else if (e.e === 'bush') { const [x, y] = at(e); particles.burst(x, y, '#4dbb55', 6); }
      else if (e.e === 'pickup') {
        sfx('pickup'); const x = e.x * T, y = e.y * T;
        particles.sparkle(x, y, 8); particles.text(x, y - 18, LABEL[e.kind], COLOR[e.kind]);
      } else if (e.e === 'respawn') { sfx('pickup'); particles.sparkle(e.x * T, e.y * T, 10); particles.text(e.x * T, e.y * T - 24, 'Înapoi!', '#7be08a'); }
      else if (e.e === 'hit') {
        sfx('hit'); shake = Math.max(shake, 10);
        const p = s.players.find((q) => q.id === e.id);
        particles.burst(e.x * T, e.y * T, p ? p.color : '#fff', 14); particles.text(e.x * T, e.y * T - 20, 'Auu!', '#ff9aa8');
      } else if (e.e === 'out') sfx('out');
      else if (e.e === 'throw') { sfx('place'); const [x, y] = at(e); particles.dust(x, y, 3); }
      else if (e.e === 'curse') { sfx('hit'); particles.sparkle(e.x * T, e.y * T, 8); particles.text(e.x * T, e.y * T - 20, 'Ciudățel!', '#d28cff'); }
      else if (e.e === 'tele') { sfx('tele'); const [x, y] = at(e); particles.sparkle(x, y, 8); }
      else if (e.e === 'block') { sfx('block'); shake = Math.max(shake, 3); const [x, y] = at(e); particles.dust(x, y, 3); }
      else if (e.e === 'match') sfx('match');
      else if (e.e === 'count') sfx('beep');
      else if (e.e === 'go') sfx('go');
    }
  }

  return {
    handle,
    shake() { return shake < 0.3 ? [0, 0] : [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake]; },
    update() {
      shake *= 0.86;
      for (let k = pieces.length - 1; k >= 0; k--) {
        const p = pieces[k];
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.r += p.vr;
        if (--p.life <= 0) pieces.splice(k, 1);
      }
      for (let k = rings.length - 1; k >= 0; k--) if (++rings[k].t > 10) rings.splice(k, 1);
      particles.update(); particles.update();
    },
    draw(c) {
      for (const r of rings) {
        c.strokeStyle = `rgba(255,240,180,${1 - r.t / 10})`; c.lineWidth = 5 - r.t * 0.4;
        c.beginPath(); c.arc(r.x, r.y, 8 + r.t * 7, 0, 7); c.stroke();
      }
      for (const p of pieces) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life / 12);
        c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7); c.restore();
      }
      c.globalAlpha = 1;
      particles.draw(c, 0, 0);
    },
  };
}
