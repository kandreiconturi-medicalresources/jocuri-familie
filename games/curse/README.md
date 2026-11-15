# Turbo Curse — contract

Curse 3D low-poly arcade, originale. Se joacă singur (contra boților), 2 jucători pe ecran împărțit (doar pe PC sau pe o tabletă bună) sau 2–4 jucători în rețea (camerele din `shared/net/rooms.js`). Trebuie să ruleze cu cel puțin 30 FPS pe iPhone SE 1 / iPad 5 (A9, Safari 15, WebGL 1/2).

## Tehnologie
- `three` (npm, `0.187.0`) cu `GLTFLoader`. Modelele sunt în `assets/models/*.glb` (Kenney Racing Kit, CC0): `raceCar*`, piese de drum `road*`, decor.
- **Performanță:**
  - geometria statică a pistei se unește (`mergeGeometries`) pe material;
  - un singur `DirectionalLight` + `HemisphereLight`; umbre doar la `perf.quality() === 2`;
  - `renderer.setPixelRatio(min(devicePixelRatio, [1, 1.5, 2][q]))`;
  - ceață pentru distanța de vizibilitate; antialias doar la `q === 2`;
  - fără post-procesare;
  - decorul folosește `InstancedMesh` unde se repetă (copaci, garduri).

## Module
| Fișier | Rol |
|---|---|
| `src/tracks/` | `pieces.js` (piesă → model + segment de traseu), `tracks.js` (8 piste ca liste de piese + temă), `build.js` (construiește scena și **linia centrală** ca listă de puncte) |
| `src/sim/` | **pur, fără Three/DOM**: `car.js` (fizică arcade), `race.js` (ture, checkpoint-uri, clasament, start cu numărătoare), `ai.js` (boți pe linia centrală, cu variație și „ajutor” pentru cei rămași în urmă) |
| `src/render/` | scena, camera care urmărește mașina (cu înclinare la drift), particule de fum, flacără de nitro, urme de drift |
| `src/net/` | fiecare client își simulează mașina și trimite starea de 15 ori/s; gazda decide startul și clasamentul final |
| `src/screens/` | meniu, alegerea mașinii (4 culori) și a pistei, numărătoare, HUD (poziție, tura, vitezometru, bară de nitro, minimapă), podium |
| `src/main.js` | pornire, buclă, `startPlaySession('curse')` |

## Simulare (`sim/car.js`, 60 Hz)
- Starea: `{ x, z, angle, speed, steer, drift, nitro (0–1), lap, cp, finished }` (y vine din pistă).
- **Arcade, prietenos pentru copii:** accelerare automată opțională (implicit pornită pe touch). Virajul scade la viteză mare.
- **Drift:** ținut în viraj la viteză mare. Umple nitro.
- **Nitro:** apăsare → +40% viteză timp de 1,5 s.
- **Ieșirea de pe pistă:** dacă te depărtezi de linia centrală mai mult decât lățimea drumului, încetinești pe iarbă sau nisip. Marginile cu bordură împing mașina ușor înapoi (fără blocaje). Butonul „Înapoi pe pistă” (sau automat după 3 s blocat) te pune pe linia centrală.
- **Coliziuni între mașini:** cercuri simple, cu împingere ușoară.

## Piste (8)
Fiecare are o temă diferită (culoarea cerului, ceața, solul, decorul):
1. Parcul Verde
2. Plaja la Apus
3. Deșertul
4. Orașul Noaptea (lumini)
5. Muntele cu Zăpadă
6. Pădurea
7. Circuitul cu Pod (rampă și pod)
8. Marele Premiu

Lungimea crește treptat. Se joacă 3 ture (configurabil 1–5).

## Controale
- **Tastatură:** P1 săgeți/WASD + Space = drift + Shift = nitro; P2 (ecran împărțit) IJKL + U/O.
- **Gamepad:** stick, butonul A/RT = accelerare, B/LT = frână, X = nitro.
- **Touch:** ◀ ▶ în stânga, frână + nitro în dreapta, accelerare automată. Opțional, volan prin înclinare: pe iOS, `DeviceOrientationEvent.requestPermission()` se cere la apăsarea unui buton.

## Progres (`gameSave('curse')`)
`{ best: { [trackId]: ms }, wins: { [trackId]: n }, unlocked }`. Pistele se deblochează câte una, după un loc pe podium.
