# Bum-Bum Arena — contract

Joc de arenă cu bombe, original, pentru 2–4 jucători:
- pe același dispozitiv (tastatură și gamepad-uri; pe tabletă, 2 jucători cu butoane tactile);
- în rețea, prin camerele din `shared/net/rooms.js`;
- cu boți pentru locurile libere.

Meciuri scurte, potrivite pentru copii. Nume, personaje și grafică originale.

## Module
| Fișier | Rol |
|---|---|
| `src/logic/` | simulare **pură și deterministă** (fără DOM): `arenas.js`, `match.js`, `rules.js`, `bots.js`. Rulează identic local, la gazdă și în teste |
| `src/render/` | Canvas 2D: arenă pre-randată, bombe, flăcări, bonusuri, personaje (avatarul profilului + corp mic desenat în cod) |
| `src/net/` | gazda simulează și trimite snapshot-uri, iar ceilalți trimit doar input |
| `src/screens/` | meniu, alegerea jucătorilor și boților, arena, scor, final de meci |
| `src/main.js` | pornire, buclă (`shared/engine/loop.js`), `startPlaySession('bombe')` |

## Logica (`src/logic/match.js`)
```js
createMatch({ arenaId, players: [{ id, name, avatar, color, bot }], seed, rules /* { lives: 1|3|5 } */ }) → state
step(state, inputs /* { [id]: { dx: -1|0|1, dy: -1|0|1, bomb: bool } } */) → events[]  // 30 pași/s
```
- Grilă de 17×15, cu pereți fixi la margini și pe pozițiile pare. Lăzile (`crate`) sunt așezate cu seed, iar colțurile de start (`CORNERS`: (1,1), (15,13), (15,1), (1,13)) rămân libere, cu încă 2 celule libere lângă fiecare.
- **Reguli clasice, fără protecție:** nu există scut, invulnerabilitate sau „mod blând”. Bombele proprii te rănesc, iar bonusul negativ „Ciudățel” există (rar).
- **Jucător:** poziție în plăci (float), se mișcă pe culoare cu „alunecare” la colțuri. Pornește cu 1 bombă, raza 2 și **șut** (toți pot împinge bombele de la început).
- **Bomba:**
  - explodează după 2,5 s, cu flăcări în cruce, oprite de pereți;
  - o ladă lovită se sparge și poate lăsa un bonus;
  - o bombă atinsă de flăcări explodează în lanț;
  - șut: mergi în bombă și o împingi, iar ea alunecă până se oprește de un obstacol.
- **Bonusuri:** `bomb` (+1 bombă), `fire` (+1 rază), `speed`, `glove` (aruncă), `remote` (telecomandă), `curse` (Ciudățel). Șutul și scutul nu mai sunt bonusuri (ids 4 și 5 rămân libere).
- **Meci = o singură arenă, cu vieți** (`rules.lives`: 1/3/5, implicit 3; `state.mc` = numărul meciului, crește la revanșă):
  - lovit de flăcări, lavă sau bloc care se strânge, pierzi o viață (`lives--`) și lași pe hartă cel mult 4 din bonusurile adunate (`DROP_MAX`), pe celule libere alese cu `s.rng`;
  - după `RESPAWN` (2 s) revii în colțul tău de start cu statistici de bază (1 bombă, raza 2, fără puteri), **fără invulnerabilitate**. Revenirea se amână cât timp celula de start sau vecinii ei sunt în raza unei bombe sau în flăcări, sau cât un alt jucător stă lângă ea. Dacă arena s-a strâns peste colț, apari în cea mai apropiată celulă liberă;
  - la 0 vieți ieși (`out`). Când mai are vieți un singur jucător (după `END_DELAY`) meciul se termină, iar acela câștigă;
  - maximum 3 min (`MATCH_STEPS`); după 2 min (`SHRINK_AT`) arena se strânge cu blocuri dinspre margini. La timp expirat câștigă cine are mai multe vieți, la egalitate nimeni (`matchWinner = null`);
  - `phase`: `play` → `match_end`. `startMatch(s)` pornește (sau reia) meciul.
- HUD: fiecare jucător are inimioare (vieți) pe card, „Revine…” cât așteaptă, „Ieșit” la 0. Ecranul de final arată clasamentul după vieți, apoi bombele și raza maximă atinse.
- `events` pentru sunet și efecte: `place`, `explode`, `crate`, `pickup`, `hit`, `respawn`, `out`, `match`.
- `bots.js`: `botInput(state, id, rng)`, cu 3 niveluri (ușor, mediu, greu). Boții fug din raza bombelor, sparg lăzi, iau bonusuri și atacă moderat.

## Arene (8)
Fiecare are alt aspect și altă regulă mică:
1. Grădina: clasică.
2. Plaja: nisip, mai puține lăzi.
3. Gheața: alunecare ușoară.
4. Pădurea: tufișuri care ascund bonusuri.
5. Peștera: lumină în jurul jucătorilor (doar la `perf.quality() ≥ 1`).
6. Cetatea: benzi rulante.
7. Norii: teleportoare pereche.
8. Vulcanul: lavă care pulsează pe 2 plăci.

Grafica vine din planșele Kenney deja importate pentru Bobo: `../bobo/assets/kenney/tiles.*` (`bomb`, `bomb_active`, `block_planks`, `bricks_*`, `terrain_*_block_center` etc.). Se importă din `games/bobo/assets/kenney/`, fără să fie copiate.

## Rețea (fără logică pe server)
- Gazda (`host` din lista camerei) rulează `step` la 30 Hz și trimite `{k:'snap', ...}` de 15 ori pe secundă:
  - grila se trimite întreagă doar la început, la meci nou și la 10 s; în rest, doar diferențele (mesaj ≤ 4 KB);
  - plus jucătorii (cu `lives` și `rt`, timpul rămas până la revenire), bombele, flăcările și bonusurile.
- Ceilalți trimit `{k:'in', dx, dy, bomb}` la schimbare (și minimum de 5 ori pe secundă). Afișează snapshot-urile interpolate.
- Dacă gazda pleacă, gazda nouă continuă din ultimul snapshot complet.
- Boții rulează la gazdă.
