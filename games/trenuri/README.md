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

## Etapa 6.2 (economie și creștere)
- **Mărfuri și industrii** (`sim/goods.js`): 14 mărfuri (pasageri, poștă, cereale, mâncare, bușteni, cherestea, cărbune, minereu, oțel, bunuri, lapte, brânză, petrol, combustibil) și 13 industrii în lanțuri: fermă → fabrică de mâncare; pădure → gater; mină de cărbune → centrală / oțelărie; mină de fier → oțelărie → fabrică de bunuri; fermă de lapte → lăptărie; sondă → rafinărie. `placeIndustries` (`sim/indgen.js`) le pune cu seed: ferme pe câmpie, mine pe dealuri (înălțime ≥ 9), păduri pe plăci cu păduri. `state.industries = [{ id, type, x, y, name, in[], out[], made, boost }]`.
- **Producție** (`sim/industry.js`): primarele produc lunar (`PROD`, +50% la recoltă bogată); prelucrătoarele produc zilnic doar din ce au primit. Gările (raza + 1) iau zilnic ce au industriile din rază (`st.cargo[]`); marfa perisabilă se strică lunar, mai încet cu depozit.
- **Vagoane** (`sim/cargo.js`): 8 tipuri (pasageri, poștă, cutie, cărbune/minereu, lemn, cisternă, frigorific, platformă), model `train-carriage-*` pentru fiecare. `buyTrain { model, stationId, kinds: [tipuri] }`. Mod **Automat**: trenul ia ce cer gările următoare din rută. Opțional `setOrders { trainId, orders: [{ load: [mărfuri], unload: [mărfuri] }] }` per gară (`null` = Automat).
- **Venit:** cantitate × distanță × tarif marfă × bonus de viteză. Marfa predată unde nimeni n-o cere plătește `LOW_PAY` (25%), iar ziarul explică prietenos.
- **Orașe:** crescând cu pasageri, poștă și mărfuri cerute (`growCity`, `c.got[]` luna asta, `c.prev[]` luna trecută). Cererea (`wantOf`) crește cu nivelul: sat cere mâncare și cherestea; oraș adaugă bunuri și brânză; metropolă adaugă combustibil. Clădiri noi din `commercial/`, inclusiv zgârie-nori. Panoul orașului arată ce vrea și ce a primit.
- **Epoci și locomotive** (`MODELS` în `sim/consts.js`): anul de start 1840, 1900 sau 1950 (`createWorld({ year })`). Mic 1840, Abur 1856, Abur rapid 1885, Diesel 1930, Electric de oraș 1952, Electric rapid 1970. Au viteză, putere (câte vagoane trag bine), preț, întreținere lunară și fiabilitate (pană rară: trenul stă o zi). Ziarul anunță „O nouă locomotivă a fost inventată!”.
- **Îmbunătățiri de gară** (`UPGRADES`, comanda `buildUpgrade { stationId, kind }`): depou de apă (abur +25% viteză), oficiu poștal (+50% poștă), hotel (+50% pasageri), depozit (marfa se strică mai încet); apar ca modele lângă gară.
- **Semnalizare** (`sim/blocks.js`, `sim/trains.js`): plăcile ocupate de un tren (de la coadă până la placa următoare) sunt blocate; gările nu blochează. Al doilea tren așteaptă la intrare; după `YIELD_BASE` pași, față în față se întoarce trenul care a mers mai puțin spre gara de unde a plecat, iar din urmă se întoarce abia după `YIELD_LONG`. Stratul blocurilor e derivat (nu se salvează, se reconstruiește la încărcare).
- **Ziar** (`sim/events.js`, `sim/economy.js`): oraș nou crescut, industrie nouă, recoltă bogată, record de livrări, locomotivă nouă, pane.
- **UI:** culori și iconițe pe mărfuri (`ui/card.js`), panou industrie / oraș / gară cu îmbunătățiri, panou tren cu Automat/Manual, alegere de an la pornire, stratul **📦 Mărfuri** cu săgeți industrie → cine o vrea (`sim/links.js`, `render/links.js`).
- **Salvări:** versiunea stării a devenit 2; salvările din 6.1 sunt ignorate.
- **Teste:** `tests/trenuri-eco.test.js` (lanț cărbune → oțel, creștere de oraș, locomotive după an, semnalizare în ambele sensuri, hash după serializare).

## Etapa 6.3 (scenarii și ajutor)
- **Scenarii** (`src/sim/scenarios/`): 8 scenarii deterministe în `defs.js` (seed, mărime, an, bani, termen în ani, poveste, sfat, obiective cu praguri bronz/argint/aur): Primul tren, Poșta rapidă, Cărbune pentru oțelărie, Fă din sat un oraș, Pâine pentru toți, Peste munți (poduri), Marea rețea (8 orașe), Metropola. `goals.js` are măsurătorile (`del`, `ups`, `lvl`, `bridge`, `served`...) și `evaluate`; medalia scenariului e cea mai mică dintre obiective. `s.scn = { id, end, best, done, vals }` se salvează cu starea; `checkScenario` rulează lunar din `stepWorld`, iar scenariul se încheie la aur sau la termen. Statisticile (`s.stats`: marfă predată cerută, venit, niveluri câștigate) apar în `createWorld`, iar salvările vechi primesc `stats` la încărcare. Tunelurile nu există încă în simulare, deci „Peste munți” folosește poduri.
- **Medalii** (`medals.js`): salvate în `gameSave('trenuri')` cheia `medals`; scenariul i se deblochează cu cel puțin bronz la i-1. Meniul de scenarii (`ui/menu.js`) le arată; ecranul de final (`ui/endScreen.js`) are medalia, confetti și fanfară.
- **Construcție liberă:** `createFreeWorld` (sandbox, anul 1970, fără termen). **Tutorial** (`ui/tutorial.js`): 5 pași cu butonul evidențiat, avansează singur; pornește la primul joc și se reia din meniu sau din ☰.
- **Ajutorul** (`ui/helper.js`, `ui/tips.js`): conductor desenat în SVG, sfaturi din reguli pure (oraș care cere marfă, tren fără rută, bani pentru locomotivă); se opresc din ☰ Meniu (`ui/settings.js`).
- **Sunete** (`src/audio.js`): fluier la plecare, clopoțel la gară, monedă, „ding” la ziar, fanfară; fundal ambiental discret, oprit implicit.
- **Ecrane mici:** panourile încap la 568×320 (bară de sus cu chip dublu bani/dată, opțiunile se mută la dreapta balonului, cardul și meniurile se închid cu tap în afară), butoane ≥ 44 px.
- **Cameră:** zoom-ul și pinch-ul sunt ancorate (`camera.gesture`): punctul de teren de sub degete rămâne sub ele. Înainte, zoom-ul se făcea față de centrul ecranului, deci harta „aluneca”.
- **Teste:** `tests/trenuri-scn.test.js` (bot determinist care ia bronz pe toate cele 8 scenarii, obiective, medalii, sfaturi).

## Etapa 6.4 (multiplayer și salvări pe NAS)
- **Lockstep** (`src/net/lockstep.js`, fără timere: totul merge din `update(dt)`, deci se testează în memorie):
  - Gazda primește comenzile (`{t:'c'}`), le pune în ordine cu număr `q` și pasul `at = max(L, pas curent)` și trimite cadre `{L, sp, c:[[q,at,jucător,companie,comandă]]}`. `L` înseamnă „toate comenzile cu `at < L` sunt cunoscute”; un nod face pasul `t → t+1` doar dacă `t < L`. Gazda trimite un cadru (și „tick-uri goale”) la ~100 ms, cu `L = pas + DELAY(3) + avans`. Comanda are `by` pus de gazdă (nu de client).
  - Viteza și pauza vin doar de la gazdă (`sp` din cadre). La pauză nodurile termină pașii deja confirmați, apoi stau.
  - La fiecare 100 de pași, clientul trimite `hashState`; dacă diferă de al gazdei, gazda trimite starea întreagă. Lipsa unei comenzi (gol în `q`) cere tot starea.
  - **Stare pe bucăți** (`transfer.js`, `pack.js`): starea serializată se comprimă (`CompressionStream` dacă există, altfel JSON simplu), se taie în bucăți de 3000 de caractere (< 4 KB/mesaj), cu fereastră de 6, confirmări cumulative `sa`, reluare după 1,5 s și cel mult ~20 bucăți/s (serverul taie la 30 mesaje/s). Aceeași cale servește intrarea în timpul jocului, resincronizarea și încărcarea unei salvări (`epoch`).
  - **Plecarea gazdei:** noua gazdă (prima din lista camerei) continuă de la ultimul `L` primit; dacă a pierdut ceva, hash-ul îl repară.
  - Comenzile `buildTrack` merg pe fir ca „x,y + șir de direcții” (`wire.js`); `buyTrain` primește `route` direct (în rețea nu se știe id-ul trenului înainte să se aplice comanda). Jucătorii pot trimite doar tipurile din `ALLOWED`.
- **Moduri** (`sim/value.js`, `createNetWorld(cfg)`): `cfg = {mode:'coop'|'comp', seed, size, year, scn?, players}`.
  - **Cooperativ:** o companie, orice jucător dă comenzi (și scenariile merg în coop).
  - **Competitiv:** companie per jucător (`s.net.pl[idJucător] = idCompanie`, culoarea jucătorului); șinele, gările și trenurile au proprietar și simularea refuză orice comandă pe bunurile altuia. Cine intră în timpul jocului primește o companie nouă (`joinCompany`, doar generată de gazdă, cel mult 8). Clasamentul (`standings`) e după valoarea companiei: bani − împrumut + gări + trenuri + șine.
- **Lobby** (`ui/lobby.js`, „🌐 Joacă în rețea”, apare doar când `isOnline()`): creezi cameră sau intri cu cod (`shared/ui/keypad.js`); lista jucătorilor are culorile companiilor; gazda alege modul, harta (mărime, an) sau scenariul și pornește. `{t:'closed', reason:'time'}` arată overlay-ul de timp. Cutiuța din meci (`ui/netHud.js`) arată echipa sau clasamentul.
- **Salvări** (`net/saves.js`, `ui/saves.js`, ☰ → „Salvează / Încarcă”): 3 sloturi; pe NAS prin `listSaves/loadSave/putSave/deleteSave` când `isOnline()`, altfel în `gameSave` local. Conținutul e `pack({v, state, speed})` (base64, sub 1 MB). În rețea doar gazda salvează sau încarcă, iar lumea încărcată se trimite tuturor (`lockstep.load`).
- **Teste:** `tests/trenuri-net.test.js` cu `tests/trenuri-hub.js` (cameră în memorie cu latență, mesaje ≤ 4 KB și ≤ 30/s verificate): 3 clienți la 5000 de pași, intrare în timpul jocului, bucată pierdută, plecarea gazdei, desincronizare forțată, competitiv (refuzuri), încărcare de salvare, sloturi.
