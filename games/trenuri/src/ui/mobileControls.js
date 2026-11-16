// Butoane mari pe touch, dreapta-jos: ➕ ➖ zoom, 🧭 rotire 90°, ⛶ ecran complet (Fullscreen API cu prefix webkit; pe iPhone doar un mesaj).
const touchy = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
const IPHONE = /iPhone|iPod/.test(navigator.userAgent);

export function mountMobileControls(root, camera) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:8px;bottom:116px;z-index:30;display:flex;flex-direction:column;gap:6px;pointer-events:none';
  const note = document.createElement('div');
  note.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:60;padding:8px 14px;border-radius:12px;background:rgba(20,28,40,.92);color:#fff;font:600 14px/1.3 system-ui,sans-serif;max-width:86vw;text-align:center;display:none';
  const mk = (txt, label, fn) => {
    const b = document.createElement('button');
    b.textContent = txt; b.setAttribute('aria-label', label);
    b.style.cssText = 'width:40px;height:40px;border-radius:12px;border:2px solid #5b3fa8;background:#fff;font-size:19px;line-height:1;pointer-events:auto;touch-action:manipulation;box-shadow:0 2px 6px rgba(0,0,0,.35)';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', fn);
    box.append(b);
  };
  const fullscreen = () => {
    const d = document, el = d.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (IPHONE || !req) { note.textContent = 'Pe iPhone: Partajare → Adaugă pe ecranul principal, ca să pornească pe tot ecranul'; note.style.display = ''; setTimeout(() => { note.style.display = 'none'; }, 5000); return; }
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const r = req.call(el); if (r && r.catch) r.catch(() => {}); }
  };
  mk('➕', 'Mărește', () => camera.zoom(0.7)); mk('➖', 'Micșorează', () => camera.zoom(1 / 0.7));
  mk('🧭', 'Rotește 90°', () => camera.rotate(Math.PI / 2)); mk('⛶', 'Ecran complet', fullscreen);
  const sync = () => { box.style.display = touchy() ? 'flex' : 'none'; };
  sync(); addEventListener('resize', sync);
  root.append(box, note);
}
