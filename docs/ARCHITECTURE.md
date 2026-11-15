# Arhitectură

## Ținte
- Cel mai slab dispozitiv: iPhone SE 1 / iPad 5 (A9, Safari 15–16). Fără API-uri mai noi de Safari 15 (fără `OffscreenCanvas`, `structuredClone`, `Array.prototype.at` e ok).
- Fizică la pas fix 60 Hz (nu pe cadru). Randare la cât dă ecranul.
- Totul trebuie să meargă cu tastatură, gamepad și atingere.

## Publicare
- Același build în două locuri: GitHub Pages (doar local/single-player) și NAS (tot + rețea).
- Online = `fetch('api/health')` răspunde. Fără server, jocurile merg integral local.

## Convenții
- Module ES, JavaScript simplu, fără framework. Un fișier = un rol, ideal < 300 rânduri.
- Importuri relative între `games/*` și `shared/*`.
- Text pentru jucători în română. Nume de cod în engleză.
- Chei localStorage: `jf:<namespace>:<cheie>`, mereu prin `shared/engine/save.js` (try/catch inclus).

## Contract `shared/engine`
Fiecare modul exportă doar ce e mai jos; jocurile nu reimplementează aceste lucruri.

### loop.js
`startLoop({ update(dt), render(alpha), hz = 60 }) → { stop(), pause(), resume(), paused }`
Acumulator cu pas fix (`dt = 1/hz` secunde), maxim 5 pași pe cadru, pauză automată la `visibilitychange`.

### input.js
`createInput({ players = 2, keymap = DEFAULT_KEYMAP }) → { read(i), setTouch(i, btn, down), clear(), any(btn) }`
- `read(i)` → `{ left, right, up, down, a, b, start }` (boolean), combinat din tastatură + gamepad i + touch.
- `a` = sare/acțiune principală, `b` = trage/acțiune secundară.
- `DEFAULT_KEYMAP`: P0 = WASD + Space(a) + F(b), P1 = săgeți + Enter/ArrowUp(a) + ArrowDown/Shift dreapta(b). Escape/P = start pentru oricine.
- Gamepad standard: stick/dpad = direcții, butoane 0/1 = a, 2/3 = b, 9 = start. Gamepad-ul k merge la jucătorul k.
- Tastele se resetează la `blur`.

### audio.js
`unlockAudio()` (la primul gest), `tone(f1, f2, dur, wave, vol, delay)`, `defineSfx({ nume: [[f1,f2,dur,wave,vol,delay], ...] })`, `sfx(nume)`, `setMuted(b)`, `isMuted()` (salvat).

### screen.js
- `fitCanvas(canvas, { height = 544, minWidth = 800, maxWidth = 1280 }) → { vw, vh, scale }`: păstrează înălțimea logică fixă, lățimea se adaptează la raport; ține cont de `devicePixelRatio` plafonat de `perf.quality()`. Re-apelează singur la resize/rotire și cheamă `onResize`.
- `toggleFullscreen()` (inclusiv prefix webkit), `needLandscape(el)` (arată `el` în portret pe dispozitive tactile).
- `isTouch`, `isIOS`, `isStandalone`.

### save.js
`store(namespace) → { get(key, fallback), set(key, value), remove(key) }` (JSON).

### profiles.js
- Profil: `{ id, name, avatar, color, createdAt }`. `avatar` = cheie dintre `AVATARS` (ex. `'bear'`, `'bunny'`, `'fox'`, `'cat'`, `'panda'`, `'frog'`, `'owl'`, `'pig'`) desenată cu `drawAvatar(ctx, avatar, x, y, r, color)`.
- `listProfiles()`, `createProfile({ name, avatar, color })`, `updateProfile(id, patch)`, `deleteProfile(id)`, `currentProfile()`, `setCurrentProfile(id)`.
- `gameSave(gameId) → store` legat de profilul curent (`jf:<profileId>:<gameId>`). Sincronizarea cu NAS-ul vine în Faza 2.

### rng.js
`hashSeed(str) → uint32`, `rng(seed) → { next() [0,1), int(a, b), pick(arr), chance(p), range(a, b) }` (mulberry32, determinist).

### perf.js
`perf.tick(frameMs)` din bucla de randare; `perf.quality()` → 0 (slab) | 1 | 2 (bun). Pornește din `localStorage` sau după heuristică (A9/ecran mic → 1). Coboară dacă media FPS < 45 timp de 3 s, urcă greu. `perf.onChange(cb)`. `perf.set(q)` pentru setare manuală.

### particles.js
`createParticles(max) → { burst(x,y,color,n), sparkle(x,y,n), dust(x,y,n,dir), text(x,y,str,color), update(), draw(ctx, camX, camY) }`. Numărul de particule se scalează cu `perf.quality()`.

## `shared/ui`
- `theme.css`: variabile de culoare, font rotunjit (fără descărcări: `"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui`), butoane mari `.btn`, `.btn-round`, panouri `.panel`, safe-area iOS.
- `touchpad.js`: `createTouchpad(input, layout)`; butoane pe ecran cu multi-touch și alunecare între butoane (ca în original). `layout` = listă `{ player, btn, side: 'left'|'right', label }`. Se arată doar pe dispozitive tactile.
- `dom.js`: `$(sel)`, `h(tag, attrs, ...children)`, `show(el, on)`.


## Rețea
Vezi `docs/SERVER.md` (API, securitate, limită de timp, WebSocket, deploy).
