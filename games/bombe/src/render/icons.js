// Iconițele bonusurilor: medalion colorat + semn alb desenat în cod (la fel pe arenă, în carduri și în legendă).
const TAU = Math.PI * 2;

export const BADGE = ['', '#555', '#ff7a1a', '#3a8dff', '#3fbf5a', '#31c6e8', '#e0559b', '#8a5cf0', '#7a2fb0'];
export const BONUS_NAME = ['', 'Încă o bombă', 'Flacără mai mare', 'Viteză', '', '', 'Mănușă: aruncă bomba (butonul 2)', 'Telecomandă: bombele explodează la butonul 2', 'Ciudățel (rar, 10 s): se pasează prin atingere'];

const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

function glyph(c, k, r) {
  c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, r * 0.14); c.lineCap = 'round'; c.lineJoin = 'round';
  if (k === 1) { disc(c, 0, r * 0.12, r * 0.5); c.fillRect(-r * 0.05, -r * 0.66, r * 0.12, r * 0.3); disc(c, r * 0.2, -r * 0.7, r * 0.1); } else if (k === 2) {
    c.beginPath(); c.moveTo(0, -r * 0.72); c.quadraticCurveTo(r * 0.7, 0, 0, r * 0.66); c.quadraticCurveTo(-r * 0.7, 0, 0, -r * 0.72); c.fill();
  } else if (k === 3) { c.beginPath(); c.moveTo(r * 0.1, -r * 0.72); c.lineTo(-r * 0.5, r * 0.1); c.lineTo(0, r * 0.1); c.lineTo(-r * 0.1, r * 0.72); c.lineTo(r * 0.5, -r * 0.1); c.lineTo(0, -r * 0.1); c.fill(); } else if (k === 4) {
    c.beginPath(); c.moveTo(-r * 0.55, r * 0.35); c.lineTo(-r * 0.55, -r * 0.1); c.quadraticCurveTo(-r * 0.5, -r * 0.5, 0, -r * 0.45); c.lineTo(r * 0.35, r * 0.05); c.lineTo(r * 0.6, r * 0.05); c.lineTo(r * 0.6, r * 0.35); c.closePath(); c.fill();
  } else if (k === 5) { c.beginPath(); c.arc(0, 0, r * 0.52, 0, TAU); c.stroke(); } else if (k === 6) { // mănușă: palmă + 3 degete + deget mare
    c.fillRect(-r * 0.4, -r * 0.05, r * 0.8, r * 0.55);
    for (let i = 0; i < 3; i++) c.fillRect(-r * 0.4 + i * r * 0.28, -r * 0.55, r * 0.22, r * 0.55);
    c.beginPath(); c.ellipse(-r * 0.5, r * 0.1, r * 0.14, r * 0.26, 0.6, 0, TAU); c.fill();
  } else if (k === 7) { // telecomandă: cutie cu buton și unde
    c.fillRect(-r * 0.3, -r * 0.05, r * 0.6, r * 0.65); c.fillRect(-r * 0.04, -r * 0.5, r * 0.08, r * 0.45); disc(c, 0, -r * 0.55, r * 0.1);
    c.beginPath(); c.arc(0, -r * 0.55, r * 0.3, -2.4, -0.74); c.stroke(); c.beginPath(); c.arc(0, -r * 0.55, r * 0.5, -2.4, -0.74); c.stroke();
    c.fillStyle = BADGE[7]; disc(c, 0, r * 0.3, r * 0.14);
  } else { // Ciudățel: față cu ochi în spirală
    c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.stroke();
    c.beginPath(); c.arc(-r * 0.2, -r * 0.1, r * 0.1, 0, TAU); c.arc(r * 0.2, -r * 0.1, r * 0.1, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, r * 0.32, r * 0.2, 3.4, 6); c.stroke();
  }
}

/** Desenează iconița bonusului `k` cu centrul în (0,0) al contextului curent. */
export function drawBonusIcon(c, k, r) {
  c.fillStyle = '#fff'; disc(c, 0, 0, r + Math.max(2, r * 0.12));
  c.fillStyle = BADGE[k]; disc(c, 0, 0, r);
  glyph(c, k, r);
}

/** Legenda pentru ecranul „Cum se joacă”: un canvas mic pentru fiecare bonus + numele lui. */
export function bonusLegend(h) {
  return h('div', { class: 'legend' }, BONUS_NAME.slice(1).map((name, i) => {
    if (!name) return null;
    const cv = h('canvas', { width: 64, height: 64, style: { width: '32px', height: '32px' } });
    const c = cv.getContext('2d'); c.translate(32, 32); drawBonusIcon(c, i + 1, 24);
    return h('div', { class: 'lg' }, cv, h('span', null, name));
  }));
}
