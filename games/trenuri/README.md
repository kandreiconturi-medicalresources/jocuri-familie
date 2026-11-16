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
- `buildTrack {path:[[x,y],...]}`, `removeTrack {x,y}`; `pauseTrain {trainId}` / `resumeTrain {trainId}` (în `ALLOWED` pentru rețea);
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

## Etapa 6.5 (mod expert)
Se alege la „Joc nou” (🎓 Mod expert + 0–3 concurenți AI, cu nivel) sau în lobby (gazda; cfg `expert`, `ai:[nivel…]`). `createWorld({ mode: 'expert', ai: [0|1|2…] })`. Modul simplu nu trece prin cod nou: `s.mode === 'simple'` păstrează economia și hash-ul vechi.
- **Cod** (`src/sim/expert/`): `init.js` (câmpurile companiei + AI-uri), `finance.js`, `stocks.js`, `report.js`, `ai.js` + `aiplan.js`, `hash.js` (intră în `hashState` doar în expert), `index.js` (`expertMonthly`, tabela de comenzi). Totul rulează în `monthly`, din `stepWorld`, doar cu numere întregi și cu `s.rng` (`roll`).
- **Comenzi noi** (toate prin `applyCommand`, toate în `ALLOWED` pentru rețea): `takeLoan`, `repayLoan`, `buyShares {co,n}`, `sellShares {co,n}`, `takeover {co}`, `continueSimple`. Refuzul vine ca `{ok:false, err}` (`expert`, `rating`, `actiuni`, `bani`).
- **Finanțe:** împrumut în tranșe de 10.000 lei; rating A–D după datorii/active (dobândă 5/8/12/18% pe an, fixată la luarea tranșei; 10/7/4/2 tranșe cel mult); dobânda se plătește lunar. Întreținere completă: șină 6, gară 120, îmbunătățire 40, tren `maint` cu +2% pe lună de vârstă (maxim +150%). **Faliment:** cash negativ 6 luni la rând → `s.over`; ecranul blând (`ui/exOver.js`) oferă `continueSimple` (datorii șterse, minim 30.000 lei, modul devine simplu când nu mai e niciun jucător în expert). Un AI falimentat iese din joc.
- **Raport anual:** `co.rep` strânge venit, costuri și venit pe marfă; trenurile au `yi`/`ym` (venit/întreținere pe an). La 1 ianuarie se închide anul (ultimii 5). `ui/exReport.js`: grafice Canvas 2D (pe ani, profit pe tren, venit pe marfă).
- **Bursa:** fiecare companie are 1000 de acțiuni (jucător: 500 ale directorului; AI: 400). Prețul se recalculează lunar: `(valoare netă + 4×profit 12 luni + 2×creștere − ¼ datorii) / 1000`, mutat ⅓ spre țintă. Avere personală `co.pw` (20.000 lei), separată de banii companiei; dividend în ianuarie (30% din profit, cel mult jumătate din cash). Cumperi și vinzi la orice companie (și la a ta = răscumpărare, și la ceilalți jucători în competitiv). Peste 50% dintr-un AI → `takeover`: gările, trenurile, șinele și datoriile trec la tine, ceilalți directori umani sunt plătiți la preț. Clasamentul (`standings`) în expert e după **valoarea netă** = avere personală + acțiuni.
- **AI** (nume și culori originale: Feroviara Vulturul, Trenuri Cetina, Calea Lăstunului): decid o dată pe lună, nu trișează (aceleași comenzi, aceiași bani, costuri și dobânzi). Aleg legături după venit estimat / cost (oraș–oraș și industrie → consumator), pun gări (sau refolosesc ale lor), `planTrack`, `buyTrain` cu ruta; adaugă trenuri pe liniile aglomerate, vând trenurile care nu se plătesc, își iau împrumuturi după nivel. Niveluri: prudent (fără împrumuturi, linii scurte), echilibrat, agresiv. Nu demolează și nu ating nimic al altora; construiesc doar pe plăci libere sau ale lor. Maxim 2 `planTrack` pe lună și AI.
- **Obiective:** măsura `nw` (valoare netă); variante expert pentru „Cărbune pentru oțelărie” și „Marea rețea” (`carbune-x`, `retea-x`: 2 AI, un an în plus, medalii proprii, deblocate cu bronz la scenariul de bază).
- **UI:** butonul 💼 din bara de sus (doar în expert): Finanțe, Bursă, Raport, Clasament; ⓘ pe fiecare termen (tooltip + notă pentru atingere). Fișiere `ui/ex*.js`, `ui/expert.css`.
- **Teste:** `tests/trenuri-expert.test.js` (determinism cu 3 AI la 20.000 de pași + serializare la mijloc, AI cu profit, împrumuturi și dobândă, preț după profit, bursă și preluare, dividende, faliment și revenire, scenarii expert) și `tests/trenuri-expert-net.test.js` (lockstep cu 3 jucători + 2 AI, intrare în timpul jocului, desincronizare reparată).

## Îmbunătățiri după feedback
Format de date: **neschimbat** (biții din `track`, `state`); câmpuri noi pe tren: `rel` (fiabilitate curentă 0–100, lipsă = a modelului), `paused`; `UPGRADES` are încă o intrare (indice 4 = `WORKSHOP`), iar `st.up` are acum 5 poziții (la salvările vechi lipsa e tratată ca 0).

1. **„Industria nu produce / nu trimite”.** Cauza: trenul cumpărat din bară avea implicit vagoane de pasageri și poștă (`CAR_SETS[0]`), care nu pot duce petrol sau cărbune; marfa de la sondă rămânea în gară, iar rafinăria stătea la 0 fără nicio explicație. Lanțul în sine merge (test cu tren automat sondă → rafinărie → oraș; combustibilul îl cer doar metropolele). Reparat:
   - `buyTrain` fără `kinds` dar cu `route` alege vagoanele potrivite (`suggestKinds` în `sim/advice.js`); în bară prima opțiune e „🤖 Vagoane potrivite”.
   - Panoul industriei spune ce lipsește, cea mai apropiată sursă și ce să faci, cu „📍 Arată pe hartă” (`industryAdvice`); panoul trenului spune de ce stă gol (`trainAdvice`: „Nu are vagoane de cisternă”, „Gara nu are marfă”, fără rută, fără drum, pauză, stricat).
2. **Șine cu mouse-ul** (`input/trackTool.js`, `parallelTool.js`; desen liber, vezi secțiunea de la final): atingeri sau tragere punct cu punct, previzualizare, „Gata”, „Anulează ultimul” (Enter / Backspace / Esc). Pornit dintr-o placă de șină existentă = ramificație (macaz, plăci cu 3+ legături, evidențiate cyan). „Nu refolosi șina” = `planTrack(..., { reuse: false })`. „Șină paralelă” (`sim/parallel.js`): alegi două puncte, jocul dublează porțiunea la o placă distanță, cu macazuri la capete (`parallelPlan`). `input/pointer.js` ține ultima placă bună, trage pe marginea hărții când pointerul iese și nu pierde punctele puse la gest întrerupt. Semnalizare: la plecare trenul ocolește plăcile ocupate sau pe care vine alt tren, iar din mers se mută pe linia liberă (`reroute`), deci linia dublă cu macazuri lasă două trenuri opuse să treacă fără așteptare.
3. **Marcaje și „De făcut”** (`render/markers.js` DOM peste canvas, `sim/todo.js` pură, `ui/extras.js`): ❗ tren fără rută/drum, 📦 marfă într-o gară fără tren, 🏭 industrie nouă fără gară, 🎯 obiectiv de scenariu, 🏙️ oraș care cere marfă. Atingere = camera merge acolo și se deschide panoul. Butonul 📌 din bara de sus arată lista și numărul.
4. **Catalog** (📋 în bara de jos, `ui/catalog.js`): Șine (normală, paralelă, demolare), Gări (preț, rază), Îmbunătățiri, Trenuri (viteză, putere, preț, fiabilitate; viitoarele gri cu anul). Ce nu-ți permiți e gri, cu motivul.
5. **Pauză:** `pauseTrain` / `resumeTrain` prin `applyCommand` (merg în rețea). Trenul în mers își termină drumul și stă în gara următoare (nu blochează linia). Buton în panoul trenului și în lista 🚆 Trenuri (stare, profit, vârstă, fiabilitate).
6. **Uzură și atelier** (`sim/wear.js`): fiabilitatea scade lunar (simplu: 1 punct pe trimestru, minim 70; expert: 2–4 puncte pe lună, minim 30); cu cât e mai mică, cu atât penele sunt mai dese și mai lungi. Îmbunătățirea de gară „Atelier de întreținere” repară trenul care oprește acolo; în panoul trenului „Trece pe la atelier” pune gara cu atelier în rută. Explicație în UI: „Depoul de apă umple locomotivele cu abur (merg mai repede). Atelierul repară trenurile.”
7. **Teste:** `tests/trenuri-fix.test.js` (lanț sondă → rafinărie → oraș, explicații, ramificație + macaz, linie dublă fără așteptare, `reuse:false`, pauză determinist și în lockstep cu 3 noduri, uzură + atelier, lista „De făcut”).

## Etapa 6.6 — „ca în viața reală” (contract, scris înainte de implementare)

### Semnalizare cu rezervare de traseu (`sim/signals.js`)
- `state.signals: [{ id, owner, x, y, dir /*0–7, sensul în care protejează*/, twoWay, auto }]`.
- `state.resv: Uint16Array(w*h)`: id-ul trenului + 1 care are placa rezervată; 0 = liberă.
- Semnalele **automate** se pun singure la intrarea în fiecare macaz și în fiecare gară (o opțiune le poate opri). Semnalele **manuale** se pun cu unealta 🚦 pe o placă de șină, într-un singur sens sau în ambele.
- Un tren care ajunge la un semnal cere rezervarea plăcilor de pe ruta lui până la **următorul semnal**, inclusiv tot macazul.
  - Dacă toate plăcile sunt libere, le rezervă și semnalul e verde.
  - Altfel semnalul e roșu și trenul așteaptă.
  - Plăcile se eliberează pe rând, după ce trece ultimul vagon. Când tot traseul s-a eliberat, semnalul devine verde automat.
- Linie simplă cu stație de încrucișare (o bucată de linie dublă): trenul rezervă linia simplă până la semnalul de la capătul îndepărtat al încrucișării, iar cel din sens opus stă la roșu.
- Dacă un tren așteaptă mai mult de N zile, caută un traseu alternativ prin altă ramificație. Dacă nu găsește, se întoarce, ca să nu existe blocaje permanente.
- `signalAspect(state, id) → 0 roșu | 1 verde`, citit de randare.
- **Macazuri:** orice placă cu mai mult de 2 conexiuni. Trenul alege ramura după rută și după rezervare: prima linie liberă spre destinație.
- **Fizică mai realistă:** accelerarea depinde de puterea locomotivei și de greutatea trenului (marfa încărcată cântărește). Rampele încetinesc trenurile grele, pantele le accelerează ușor.

### Teren (`sim/terraform.js`)
- `levelTerrain {x0,y0,x1,y1,h}` nivelează, iar costul crește cu volumul mutat.
- `clearArea` taie pădure sau dărâmă obstacole (nu orașe).
- `planTrack` poate propune „cu nivelare” când nu găsește traseu: arată costul total.
- Tunel scurt prin deal: `buildTunnel` între 2 plăci la aceeași înălțime, cu deal între ele, maximum 6 plăci.

### Gări care cresc (`sim/stations.js`)
- `station.platforms` 1–4: fiecare peron = o linie paralelă, iar fiecare tren ocupă un peron.
- Numărul maxim de peroane depinde de nivelul orașului și de producția din rază (sat → 2, oraș → 3, metropolă sau producție mare → 4).
- Comanda `upgradeStation {id}` e plătită și desenează vizibil mai multe linii și o clădire mai mare.

### Depouri, defecțiuni și remorcare (`sim/depots.js`, runda 2)
- `state.depots: [{ id, owner, x, y, dir, repairTracks: 2, cranes: 1, queue: [trainIds], jobs: [{ trainId, phase: 'lift'|'repair'|'lower', t }] }]`.
  - `buildDepot` se pune pe o placă de șină cu intrare.
  - `sendToDepot {trainId, depotId?}` trimite trenul acolo (cel mai apropiat, dacă nu e ales).
- La depou, macaraua ridică locomotiva pe linia de reparații (`lift`), urmează reparația (`repair`, care durează după uzură), apoi macaraua o pune înapoi (`lower`). Trenul își reia ruta automat.
- **Defecțiune pe traseu:** trenul se oprește, `broken: true`, și își păstrează rezervarea, deci blochează secțiunea.
  - `rescueTrain {trainId}` trimite o locomotivă de remorcare de la cel mai apropiat depou: un tren special cu `tow: { targetId }`. Aceasta ajunge, se cuplează și remorchează trenul la depou.
  - În modul simplu, remorcarea pornește singură după o zi. În expert o comanzi tu; altfel reparația pe loc e scumpă și lentă.
- Atelierul din 6.6 rămâne o variantă mai mică: repară doar uzura ușoară, la oprire.

### Vizual și interfață (`render/`, `ui/`)
- **Vagoane cu încărcătura vizibilă:** goale sau pline, cu grămezi de cărbune sau minereu, bușteni, containere colorate pe marfă, cisterne cu culoarea mărfii și saci de cereale. Gradul de umplere se vede.
- **Semafoare 3D** roșu/verde la semnale, macazuri vizibile, peroane multiple.
- **Depoul:** hală, 2 linii de reparații și o macara animată care ridică locomotiva. Locomotiva de remorcare are girofar.
- **Cumpărarea unui tren**, pas cu pas, cu iconițe mari:
  1. Ce transporți: Pasageri / Poștă / Marfă.
  2. Ce marfă (combustibil, cereale, oțel…), cu sursa și destinația propuse.
  3. Locomotiva (viteză, putere, preț).
  4. Vagoanele, cu previzualizare.

  În panoul trenului se văd mereu tipul și marfa: „🚂 Tren de marfă · ⛽ Combustibil”.
- **Conductorul se poate apăsa.** Deschide „Unde am rămas”: obiectivul curent, ultimii pași făcuți, ce să faci acum (sfaturi după cereri) și butoane „Arată-mi”.

## Etapa 6.6 — ce s-a implementat (runda 1: semnale, teren, gări; runda 2: depouri, remorcare, semnale de bloc)
**Semnale cu rezervare** (`sim/signals.js`, `sim/reserve.js`):
- `state.signals = [{ id, owner, x, y, dir, twoWay, auto }]`; `dir` = direcția pasului prin care trenul **intră** pe placă (0=N … 7=NV, ca `DX/DY`); `twoWay` o face valabilă și în sens invers. `state.sigId` e contorul de id-uri (separat de `nextId`). `signalAspect(state, id) → 0 roșu | 1 verde` (în `sim/signals.js`, citit de randare).
- Semnalele **automate** (`auto: true`) se pun singure la fiecare intrare de macaz (3+ legături) și de gară, la construirea șinei sau a gării; `setAutoSignals {on}` le oprește. Cele manuale: `placeSignal {x,y,dir,twoWay}` (150 lei, pe o placă de șină cu legătură spre `dir`) și `removeSignal {id | x,y}`.
- Derivate (nu se salvează, se reconstruiesc în `deriveLayers`): `sgm` (biții direcțiilor cu semnal pe placă), `resv` (id tren + 1 pe placă), `pocc` (peroane ocupate pe placa gării). Pe tren: `rv` (plăcile ținute, se salvează), `rl` (indicele până la care a eliberat), `redAt` (placa semnalului unde stă la roșu, +1).
- Trenul cere la semnal plăcile până **înaintea următorului semnal** (la plecarea din gară, de la prima placă); dacă una e rezervată, ocupată fizic sau gara nu are peron liber, e roșu. Plăcile se eliberează după coadă; semnalul e verde automat. La plecare drumul ocolește plăcile rezervate (linie dublă, încrucișare).
- Timpuri la roșu: după `SIG_ALT` (30 pași) caută alt drum prin altă ramificație (cu penalizare, nu interdicție), după `SIG_OVER` (60) intră și în gara cu peroanele pline (altfel două trenuri față în față între gări s-ar bloca), după `SIG_REV + (id & 7)·20` (150+) se întoarce. Fără semnale intermediare, o linie fără macaz e rezervată întreagă; cu **semnale de bloc** (vezi runda 2) trenurile din același sens merg la un bloc distanță.
- **Fizică** (`sim/physics.js`): greutate = locomotivă + vagoane + marfa/2; raportul greutate/forță (`heaviness`) schimbă la câți pași crește viteza (2–4) și cât se pierde la urcare (`slopeVmax`: viteza scade cu panta × raport; la vale crește puțin). Pod și tunel sunt plate.

**Teren** (`sim/terraform.js`): `levelTerrain {x0,y0,x1,y1,h}` (cel mult 20×20 și 220 plăci; cost `60·volum + volum²/8`; refuză clădiri, șine străine, gări), `clearArea {x0,y0,x1,y1}` (taie pădurea, 40 lei/placă; nu atinge orașe sau industrii), `buildTunnel {x0,y0,x1,y1}` (linie dreaptă, capete la aceeași înălțime, 1–6 plăci cu deal între ele, 700 lei/placă; plăcile din mijloc au `T_TUNNEL`). `planTrack(..., { level: true })` propune, doar dacă nu există traseu, `{ path, cost, level: [[x,y,h]], levelCost }`; `buildTrack { path, level }` aplică nivelarea și plătește totul odată (și pe fir în rețea: `lv`). După schimbarea terenului `markTerrain` pune `dirty.terrain = true` și dreptunghiul în `dirty.tr`; `render/view.js` reface doar bucățile 32×32 atinse (`dirtyChunks`, cu 2 plăci margine; `ground.refresh` recalculează vârfurile). Uneltele: ⛏️ Nivelare (nivelează / taie pădurea), 🕳️ Tunel, opțiunea ⛰️ „Cu nivelare” la unealta Șină.

**Gări** (`sim/stations.js`): `station.platforms` 1–4 (lipsa = 1). `maxPlatforms`: sat 2, oraș 3, metropolă 4; fără oraș 1, +1 pentru fiecare industrie în rază (3 sau mai multe = 4). `upgradeStation {id}` costă 2500 × peroanele de acum; eroarea `limita` când nu se mai poate. Fiecare tren ținut în gară ocupă un peron; cu 2 peroane încarcă 2 trenuri deodată.

**UI**: butonul „🧰 Mai mult” (`ui/tools-extra.js`, legat cu o linie în `game.js`) deschide 🚦 Semnal, ⛏️ Nivelare, 🕳️ Tunel, ⬆️ Gară mai mare; logica e în `input/extraTools.js`. Comenzile noi sunt în `ALLOWED` (`net/wire.js`).

**Teste**: `tests/trenuri-signals.test.js` (+ `tests/trenuri-sig-helpers.js`): semnale automate/manuale, două trenuri opuse pe încrucișare, 4 trenuri pe 3 macazuri fără nicio placă ocupată de 2, verde după eliberare, timeout cu traseu alternativ și întoarcere, nivelare și tunel, limitele peroanelor, 2 trenuri pe 2 peroane, rampa, determinism cu serializare la mijloc și lockstep cu 3 noduri. În `tests/trenuri-eco.test.js` am scos o singură aserțiune veche („unul a cedat”): cu rezervarea trenul al doilea așteaptă în gară, deci nu mai e nevoie de întoarcere.

**Runda 2 — depouri, defecțiuni, remorcare, semnale de bloc.**
- **Depou** (`sim/depots.js` comenzi, `sim/depotJobs.js` pași, `sim/mission.js` drumuri): `state.depots = [{ id, owner, x, y, dir, name, repairTracks: 2, cranes: 1, queue: [trainId], jobs: [{ trainId, phase: 'lift'|'repair'|'lower', t, d, lane }] }]`. `buildDepot {x,y}` (6000 lei) doar pe o placă de șină cu **o singură legătură** (capăt de linie, ca să nu blocheze linia principală); depoul e în `stm` ca o gară (un tren pe intrare, semnal automat la intrare). Macaraua (1) face `lift` și `lower` (30 pași), linia de reparații (2) ține `repair`: 40 + 6 × (100 − fiabilitatea) pași. Trenul reparat primește fiabilitatea modelului, iese pe linia de plecare (`t.org`) și își reia ruta de la gara de unde a pornit.
- **Comenzi** (în `ALLOWED`): `buildDepot`, `sendToDepot {trainId, depotId?}` (trenul își termină drumul până la gară, apoi merge la cel mai apropiat depou; câmp `toDepot`), `rescueTrain {trainId}`, `setAutoBlock {n}` (0 sau 3–12).
- **Stări noi pe tren:** `state 3` = la depou sau cuplat la remorcă (nu se desenează, nu ocupă linia), `dq` depoul, `cpl` remorca, `dead` (defecțiune gravă, în loc de `broken: true`; contor de pași), `resc` remorca trimisă, `tow: { targetId, depotId, ph: 'go'|'haul' }` pe remorcă (cu girofar), `gone` (scoasă la pasul următor). Trenurile în `state 3` nu se pot vinde.
- **Defecțiune pe traseu:** dacă compania are depou, o treime din defecțiunile obișnuite sunt grave: trenul stă pe linie și **își ține rezervarea**, deci blochează secțiunea. În modul simplu remorca pleacă singură după o zi (10 pași); în expert o comanzi tu; fără remorcă, după 400 de pași e reparat pe loc (2000 lei).
- **Remorca** pleacă din cel mai apropiat depou pe drumul cel mai scurt, folosește semnalele și rezervările ca orice tren (poate intra în secțiunea ținută de trenul pe care îl ia), oprește lângă el, se cuplează (trenul devine primul „vagon” al convoiului, în `kinds`), îl duce la depou, apoi dispare din listă. Ziarul: „Trenul 4 a fost remorcat la Depoul Poiana”.
- **Semnale de bloc:** semnalele manuale (🚦) mid-line funcționau deja ca blocuri; acum `setAutoBlock {n}` (opțiunea „Semnale automate pe linie lungă” din 🚦) pune în `syncAuto` (`sim/blocksig.js`) câte un semnal la fiecare n plăci pe porțiunile de linie simplă, câte unul pe sens. Siguranța în sens opus: la fiecare cerere de bloc, linia simplă de după bloc (până la macaz sau gară) nu trebuie să fie ținută de un tren cu sensul opus (`opposed` în `reserve.js`); cine vine din sens opus așteaptă la roșu, apoi se aplică timeout-urile obișnuite.
- **UI:** 🧰 Mai mult → 🏭 Depou și catalogul (tab „Depou”); „🏭 Trimite la depou” / „🚑 Trimite remorcă” în panoul trenului și 🏭/🚑 în lista 🚆; Info pe depou → coada, jobul curent și macaraua (`ui/depotPanel.js`); ❗ pe hartă și în „Unde am rămas” pentru trenul defect. `render/depot.js`: macaraua animată pe `lift`/`lower`, scântei și un bloc pe linia în reparație.
- **Teste:** `tests/trenuri-depot.test.js` (construire, ciclul coadă → lift → repair → lower → ruta reluată, 2 linii + o macara, defecțiune → remorcă → cuplare → depou → secțiune liberă, remorcare automată în simplu, convoi cu blocuri și sens opus fără coliziuni, bucăți de teren marcate, determinism cu serializare la mijloc, lockstep cu 3 noduri). Mai mult, `tests/trenuri-net.test.js` așteaptă acum starea cu `until(...)` în loc de timeout fix.

## Trasarea șinei: desen liber (`input/trackTool.js` + `trackDraw.js`, `sim/trace.js`, `sim/tracePlan.js`, `render/ghost.js`)
Unealta Șină are 3 moduri (butoane în bara de sub unealtă): **✏️ Desen liber** (implicit, mouse și deget), **📍 Punct cu punct** și **🧭 Drum automat** (A* între puncte, `autoTool.js`, comportamentul vechi).
- **Conversie** (pură, numai întregi, testată în `tests/trenuri-trackdraw.test.js`): eșantioane → Bresenham pe 8 direcții (`extend`, `pushTile`: dublurile și întoarcerile taie urma) → `smoothTrace` (medie mobilă pe 5 plăci + `cutCorners`: colțurile ≥ 90° devin curbe de 45°) → `planTrace(state, plăci, by, cache)`.
- **`planTrace`** întoarce `{ ok, err, tiles, kind[], segs, cmds, cost, parts{rail,bridge,clear,level,tunnel}, runs }`. Reguli: apă → pod (peste 8 plăci de apă = ocolire); orașe, industrii și șina altcuiva → ocolire locală cu `planTrack(..., { win })` într-o fereastră mică (rezultatul se ține în `cache`); pantă → tunel dacă există o linie dreaptă de 2–7 plăci cu capete la aceeași înălțime și deal între ele, altfel nivelare (`fitLevels`); pădure → defrișare (inclusă în `buildTrack`); capetele pe apă sau clădire se taie. `cmds` = `buildTrack` / `buildTunnel` în ordinea construcției; costul previzualizat este egal cu banii cheltuiți de `applyCommand`.
- **Control**: lipire magnetică la gări, capete de linie și șină proprie (`input/snap.js`, inel care pulsează); Shift = linie dreaptă, Ctrl = la 45°; rotița face zoom fără să piardă urma; lângă marginea ecranului camera se mișcă singură; clic dreapta, Esc = anulează; la eliberare apar „Construiește (cost)” / „Anulează”, iar trasarea poate continua din capătul urmei; Enter construiește, Backspace șterge ultimele plăci; al doilea deget (cameră) doar oprește gestul, urma rămâne.
- **Performanță**: `input/pointer.js` adună eșantioanele (inclusiv `getCoalescedEvents`) și le procesează o dată pe cadru, cu cel mult ~10 raycast-uri; planul se recalculează o singură dată pe cadru (`dragFlush`); previzualizarea e un singur mesh (`render/ghost.js`, 20 de vârfuri pe placă, fără sute de instanțe) rescris doar de la prima placă schimbată. Cauza sacadării vechi: la fiecare `pointermove` se rula un A* complet între primul punct și cursor (inundă harta când nu există drum), apoi se rescriau cele 700 de instanțe ale suprapunerii (se tăiau după 700, de unde pătratele întrerupte) și se făcea câte un raycast pe eveniment. Verificare: `?stats` / F3 arată FPS-ul.

## Asistentul de cumpărare, panourile de marfă și descărcarea parțială (feedback: alegerea gărilor, destinații, mai multe orașe)
- **Asistent fix, nu card** (`ui/buyWizard.js`, pașii 1–4 + `ui/routeStep.js`, pasul 5 „Ruta”). Panoul stă în stânga și NU se închide la atingerea hărții; camera nu mai sare singură (doar „📍” de pe rânduri o mută, la cerere). Zoom, rotița, mutarea hărții și Info merg cât alegi gările. Selecția e în starea pură `ui/assistState.js` (`newAssist`, `assistReduce`, `pruneStops`, `buyCommand`, `stationRows`): acțiunile `tool`/`info`/`camera` nu o ating, deci nici deschiderea Info (care schimbă unealta) nu o pierde. 🚂 din bară reia asistentul deschis, cu selecția intactă; „Fă o rută” din panouri începe unul nou. ✖ îl închide, iar gările demolate dispar singure din selecție.
- **Gări**: atingere pe hartă (unealta Tren, doar la pasul 5; a doua atingere scoate gara) sau din lista „Gările tale” (nume, oraș, distanță de la ultima gară, 📤 ce are / 📥 ce cere marfa aleasă, „＋”/număr, „📍”). Rutele se pot reordona (▲▼) și șterge. Pe hartă: numere 1, 2, 3… peste gări și o linie punctată (`render/routeMarks.js`). Cu marfă, numărul de vagoane se alege la pasul 4 (până la 6).
- **Descărcare pe fiecare oprire** (`sim/drops.js`, `sim/orders.js`, `unload` din `sim/cargo.js`): ordinul gării primește `drop: { m, v? }` cu `m` ∈ `demand` (după cerere), `all` (tot), `cars` (X vagoane, `v` 1–6), `pct` (X%, `v` 1–100), `none` (nimic). `demand`: descarcă cât mai cere orașul (cererea lunară minus ce a primit, `roomAt`) sau fabrica (loc în stoc) și duce restul; dacă nicio gară următoare nu cere marfa, lasă tot. Fără `drop` rămâne regula veche (modul Automat nu s-a schimbat). Venitul se calculează pe fiecare bucată (tone × distanță de la gara de încărcare × tarif × bonus), blocul rămas păstrează `from` și `t`. Asistentul pune `demand` la opririle de mijloc și `all` la ultima; cu două gări și fără alegeri rămâne Automat.
- **Comenzi** (doar prin `applyCommand`, deja în `ALLOWED`): `setOrders` acceptă `drop`, iar `buyTrain` primește opțional `orders` (validate la fel, curățate de câmpuri în plus), ca în rețea să nu aștepți id-ul trenului. Panoul trenului (modul Manual) are „Descarcă:” cu Automat/După cerere/Tot/Vagoane/Procent/Nimic la fiecare gară (`ui/dropRow.js`).
- **Panoul industriei și al orașului** (`sim/routes.js` pură, `ui/destList.js`, `ui/ecoPanels.js`): ce produce (iconiță + producția lunară) și „Spre ce poate duce marfa”: `destinations(s, src, g)` sortează orașele și industriile după profit estimat (venit pe tonă = distanță × tarif, pentru cel mult ~120 t sau cât se cere; fără cerere doar `LOW_PAY`), cu cerere mare/mică/deloc (`cityDemand`, prag 10 pe lună), distanță, lei/t și `railAt` (🚉 gară, 🛤️ șină aproape, ⛔ fără șină). Butoane „📍 Arată” și „🚂 Fă o rută” (asistentul cu marfa și gările din apropiere precompletate). Orașul arată ce cere și cine îl poate aproviziona (`suppliers`).
- **Teste**: `tests/trenuri-multidrop.test.js` (6 vagoane de mâncare descarcă după cerere în 2 orașe, venit exact pe livrare, „tot”/„nimic”/vagoane/%, comenzi, destinații sortate, selecția asistentului, determinism cu serializare la mijloc, lockstep cu 3 noduri).
- **Touch** (`input/touchGate.js` pură + `pointer.js`): cu unealta Șină un deget desenează doar din „ancoră” (șină, gară, oraș, industrie, toleranță 1,5 plăci) sau după apăsare lungă de 300 ms (inel + vibrate), altfel mută harta (cu inerție; dublu-tap = zoom in). Comutatorul „✋ Mut harta / ✏️ Desenez șină” (în bara uneltei, doar pe touch) face ca un deget să deseneze mereu. Al doilea deget anulează curat desenul (`dragAbort`) și camera preia controlul. `ui/mobileControls.js`: ➕ ➖ 🧭 (90°) ⛶ (Fullscreen API cu webkit; pe iPhone doar mesajul „Partajare → Adaugă pe ecranul principal”).

## Planificatorul de rută (🧭 în bară, „De unde aduc?” în panoul orașului, „Unde o duc?” în panoul industriei, „Ajută-mă să fac o rută bună” la conductor)
Flux ghidat în 6 pași, pentru cine n-a mai jucat tycoon: 1 **Ce cere orașul** (carduri pe marfă: ~cerere/lună, cât primește, bară) → 2 **De unde aduc** (surse clasate; ⭐ prima cu motivul) → 3 **Traseul** de la 1 la 2 (numere și linie punctată pe hartă; ✅ există șină / ❌ nu există: „🤖 Construiește automat” sau „✏️ Fac eu” cu unealta Șină; gările lipsă se propun singure) → 4 **Câte vagoane** → 5 **Mai e cineva care vrea aceeași marfă?** → 6 **Rezumat** și „✅ Fă tot”.
- `sim/plannerSrc.js` (pur): `cityRequests`, `monthlyOutput`, `stationAtPlace`, `railLink` (BFS pe șina ta), `spotFor` (loc de gară), `planLeg` (A* simplu → A* cu nivelare → linie dreaptă, apoi `planTrace` pentru pod/nivelare/tunel/defrișare).
- `sim/planner.js` (pur): `buildPlan(s, { g, owner, stops:[sursă, destinații…], cash, year, model? })` → gări noi, șină, tren, cost total, bani rămași, profit lunar; `carsNeeded` (vagoane și trenuri din cerere, producție, lungime, viteza locomotivei și capacitatea vagonului: dus-întors = 2×(drum + 3×vmax) + opriri); `pickModel` (cea mai rapidă din sfertul de bani); `rankOptions` (clasare după efort: cost de construit + 60×distanță, cu producția > 0 și banii în față; profitul se arată, dar nu decide); `otherTakers` (ocol față de traseu: sub `NEAR_PCT` = 25% → același tren, cu `drop` „după cerere”; altfel „tren nou”; `noStock` când sursa nu mai are marfă pentru el).
- `ui/plannerRun.js` (fără DOM): `runPlan(plan, exec)` dă comenzile în ordine (`buildStation`, comenzile lui `planTrace`, `buyTrain` cu `orders`) prin `exec` (= `applyCommand` în teste) și întoarce pașii cu ✅/❌ și motivul. Se oprește la prima eroare; ce s-a făcut rămâne și „Fă tot” continuă cu ce a rămas. În rețea id-urile gărilor noi nu se știu imediat: planificatorul e gândit pentru jocul singur.
- UI: `ui/planner.js` (panou fix ca asistentul de cumpărare, cu `tools` pe „Tren” ca harta să nu piardă planul), `plannerView.js` (pașii 0–4), `plannerEnd.js` (5–6), `plannerCards.js` (cardurile, și în panoul orașului), `plannerMap.js` (plăci colorate: verde = există, galben = nouă, albastru = pod, maro = tunel). „Tren nou pentru X” pune planul curent deoparte; se reface după „Fă tot”.
- Teste: `tests/trenuri-planner.test.js` (sursa recomandată, vagoane vs. cerere/distanță, oraș pe drum vs. departe, „Fă tot” care livrează în 8 luni, lipsa banilor, determinism).
