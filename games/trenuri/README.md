# Orașe pe Șine — contract

Joc de strategie original cu trenuri și orașe (gen tycoon feroviar): construiești cale ferată, gări și trenuri, transporți pasageri și mărfuri, iar orașele cresc. Grafică 3D low-poly (Three.js, modele Kenney CC0 în `public/models/trenuri/<kit>/`, cu texturile în `Textures/`). Se joacă pe PC, telefon și tabletă, singur sau în rețea (cooperativ și competitiv). Planul complet al fazei e în `docs/ROADMAP.md` (Faza 6, etapele 6.1–6.5).

## Module
| Folder | Rol |
|---|---|
| `src/sim/` | **simularea: pură, deterministă, numai cu numere întregi**; fără DOM, Three sau `Math.random`/trig/float în logică |
| `src/render/` | Three.js: teren pe bucăți, `InstancedMesh` pentru case, copaci și șine, trenuri, evidențieri, LOD după zoom, `perf.quality()` |
| `src/input/` | cameră (drag, pinch, rotire cu două degete, rotița, WASD), alegerea plăcii cu raycast pe teren, gesturi de construcție |
| `src/ui/` | panouri DOM mari pentru touch: bara de unelte, info pentru oraș/gară/tren, finanțe, ziarul, setări |
| `src/net/` | lockstep (etapa 6.4) |
| `src/main.js` | pornire, buclă (`shared/engine/loop.js`), `startPlaySession('trenuri')`, salvare și încărcare |

## Reguli de determinism (obligatorii în `src/sim/`)
- Bani în unități întregi (1 = 1 leu). Poziții pe traseu în `1/256` de placă. Viteze și timpi în pași de simulare.
- Doar `rng(seed)` din `shared/engine/rng.js`, cu stare salvată în `state.rng` (seed-ul curent ca uint32), avansat numai de simulare.
- Iterare doar peste array-uri sau peste chei sortate (fără ordinea de inserare a `Object.keys` pe obiecte construite diferit).
- Fără `Date.now()` în simulare. Timpul de joc e `state.tick`; o zi = 10 pași, o lună = 30 de zile.
- `hashState(state) → uint32` (FNV pe câmpurile relevante), folosit în teste și în rețea.

## Starea (`createWorld({ seed, size: 'S'|'M'|'L', mode: 'simple'|'expert', sandbox, players: [{id,name,color}] })`)
```js
{ version: 1, tick, rng, size, w, h,
  height: Uint8Array(w*h) /* 0–15 */, water: Uint8Array /* 0/1 */, forest: Uint8Array,
  cities: [{ id, name, x, y, pop, level /*0 sat,1 oraș,2 metropolă*/, demand: {...}, supply: {...}, buildings: [...] }],
  industries: [],                       // etapa 6.2 (în 6.1 lista e goală, dar câmpul există)
  track: Uint16Array(w*h),              // biți de conexiuni pe 8 direcții + flag-uri (pod, tunel, proprietar)
  stations: [{ id, owner, x, y, size /*0 haltă,1 gară,2 terminal*/, name, waiting: { pass, mail }, cityId }],
  trains: [{ id, owner, model, cars, route: [stationIds], at, pos, speed, load: {...}, money }],
  companies: [{ id, name, color, cash, loan, history: [...] }],
  date: { y, m, d }, news: [] }
```
Numele orașelor și ale gărilor sunt românești, inventate, generate cu seed.

## Comenzi (singura cale prin care jucătorul schimbă starea)
`applyCommand(state, { type, by /*companyId*/, ... }) → { ok, err?, cost? }`. Validează tot: bani, teren, proprietar.
- `buildTrack {path:[[x,y],...]}`, `removeTrack {x,y}`;
- `buildStation {x,y,size,dir}`, `removeStation {id}`;
- `buyTrain {model, stationId}`, `setRoute {trainId, route}`, `sellTrain {trainId}`;
- `setSpeed` (doar gazda, în afara simulării).

`planTrack(state, from, to, by) → { path, cost } | null`: A* pe grilă cu 8 direcții. Costul crește cu panta, iar apa cere pod (scump). Se folosește pentru previzualizarea din UI, iar UI-ul trimite apoi `buildTrack` cu traseul.

## Etapa 6.1 (fundația jucabilă)
- **Generator de hartă:** relief din zgomot întreg determinist, râuri, păduri, 6–14 orașe pe teren plat. Cu același seed rezultă aceeași hartă.
- **Cale ferată:** trasare cu degetul sau mouse-ul între două puncte, previzualizare cu cost, confirmare. Demolare.
- **Gări:**
  - Raza de colectare: 2/3/4 plăci.
  - Pasagerii și poșta apar în funcție de populația din rază și așteaptă la gară.
- **Trenuri:**
  - În 6.1 sunt 3 modele de locomotivă: abur mic, abur pentru pasageri, diesel.
  - Fiecare are vagoane de pasageri și de poștă.
  - Merge pe traseul de șine dintre gările rutei (pathfinding pe rețeaua de șine), cu accelerare, frânare și oprire în gară.
  - Venitul = cantitate × distanța în linie dreaptă × tarif × bonus de viteză.
  - Două trenuri pe aceeași șină nu se ciocnesc: în 6.1 se trec unul prin altul; semnalizarea simplă vine în 6.2.
- **Bani și timp:** cash de pornire, întreținere mică, „Ziarul” cu primele evenimente. Pauză, 1×, 2×, 4×.
- **Randare:**
  - teren cu culori pe înălțime, apă animată simplu, păduri ca `InstancedMesh` din `nature/`;
  - orașele sunt case din `suburban/`, iar la nivel mai mare și din `commercial/`;
  - șine din `trains/`, cu varianta „straight/curve/corner”; unde lipsește o piesă potrivită, folosește geometrie proprie simplă;
  - trenuri și vagoane din `trains/`.
- **UI pentru copii:** bara de jos are unelte mari (🛤️ Șină, 🚉 Gară, 🚂 Tren, 🧹 Demolare, ℹ️ Info). Sus: bani, dată, viteză. Fiecare unealtă arată un mesaj scurt despre ce să faci.
- **Salvare locală:** prin `gameSave('trenuri')`, cu un slot automat; starea e serializată compact (array-uri tipate în base64).
- **Hub:** cardul nou „Orașe pe Șine” (`hub/gamesScreen.js`).
