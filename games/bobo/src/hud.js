// HUD mare și clar, desenat pe canvas: inimi, căpșuni, steluțe, numele nivelului, viața boss-ului.
import { icon } from './render/sprites.js';
import { HERO } from './render/hero.js';

const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

function pill(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(40,15,80,.55)';
  ctx.beginPath();
  const r = h / 2;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
}

function text(ctx, s, x, y, size, color = '#fff', align = 'left') {
  ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,10,60,.75)';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}

export function drawHud(ctx, g) {
  const vw = g.view.vw, many = g.players.length > 1;
  g.players.forEach((p, i) => {
    const y = 10 + i * 46, c = HERO[p.i];
    pill(ctx, 10, y, 168, 40);
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(30, y + 20, 14, 0, 6.2832); ctx.fill();
    text(ctx, c.name[0], 30, y + 21, 20, '#3a1a00', 'center');
    for (let k = 0; k < 3; k++) ctx.drawImage(icon(k < p.hearts ? 'heart' : 'heartEmpty'), 52 + k * 40, y + 1, 38, 38);
    if (p.dead) text(ctx, '…', 170, y + 20, 22, '#fff', 'right');
    if (p.shield || p.wand || p.big) text(ctx, (p.big ? '⬆' : '') + (p.shield ? '🫧' : '') + (p.wand ? '★' : ''), 172, y + 4, 14, '#fff', 'right');
  });
  // centru: nume, steluțe, căpșuni
  const cx = vw / 2;
  pill(ctx, cx - 190, 8, 380, 74);
  text(ctx, g.level.name, cx, 26, 26, '#ffe066', 'center');
  for (let k = 0; k < 3; k++) ctx.drawImage(icon(k < g.starSet.size ? 'star' : 'starEmpty'), cx - 150 + k * 40, 42, 38, 38);
  ctx.drawImage(icon('berry'), cx + 20, 42, 38, 38);
  text(ctx, '× ' + g.fruits, cx + 62, 62, 28, '#fff', 'left');
  const b = g.boss;
  if (b && b.state !== 'sleep') {
    const w = 260, x = cx - w / 2, y = 92;
    pill(ctx, x - 6, y - 4, w + 12, 30);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 4, y + 5, w - 8, 12);
    ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x + 4, y + 5, (w - 8) * Math.max(0, b.hp) / b.max, 12);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 4, y + 5, (w - 8) * Math.max(0, b.hp) / b.max, 4);
  }
  if (g.bossIntro > 0) { g.bossIntro--; text(ctx, 'Atenție, șef mare!', cx, 150, 40, '#ff8fa3', 'center'); }
  if (g.hint > 0) { g.hint--; text(ctx, g.hintText, cx, g.view.vh - 60, 26, '#fff', 'center'); }
  if (many && g.players.some((p) => p.dead)) text(ctx, 'Prietenul tău te readuce în joc…', cx, g.view.vh - 30, 20, '#fff', 'center');
}
