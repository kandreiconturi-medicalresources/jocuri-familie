# Bum-Bum Arena — contract

Joc de arenă cu bombe, original, pentru 2–4 jucători:
- pe același dispozitiv (tastatură și gamepad-uri; pe tabletă, 2 jucători cu butoane tactile);
- în rețea, prin camerele din `shared/net/rooms.js`;
- cu boți pentru locurile libere.

Runde scurte, potrivite pentru copii. Nume, personaje și grafică originale.

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
createMatch({ arenaId, players: [{ id, name, avatar, color, bot }], seed, rules }) → state
step(state, inputs /* { [id]: { dx: -1|0|1, dy: -1|0|1, bomb: bool } } */) → events[]  // 30 pași/s
```
- Grilă de 15×13, cu pereți fixi la margini și pe pozițiile pare. Lăzile (`crate`) sunt așezate cu seed, iar colțurile de start rămân libere.
- **Jucător:** poziție în plăci (float), se mișcă pe culoare cu „alunecare” la colțuri. Pornește cu 1 bombă și raza 2.
- **Bomba:**
  - explodează după 2,5 s, cu flăcări în cruce, oprite de pereți;
  - o ladă lovită se sparge și poate lăsa un bonus;
  - o bombă atinsă de flăcări explodează în lanț.
- **Bonusuri:**
  - `bomb` (+1 bombă);
  - `fire` (+1 rază);
  - `speed`;
  - `kick` (împinge bombele);
  - `shield` (o atingere iertată, se vede ca bulă).
- **Rundă:** maximum 2 min. După 90 s, arena se strânge cu blocuri dinspre margini. Câștigă ultimul rămas; la egalitate nu primește nimeni punct. Meciul = primul la 3 runde (configurabil: 1/3/5).
- **Pentru copii:** opțiunea „Mod blând” (implicit pornită) dă fiecărui jucător un scut la începutul rundei, iar bombele proprii nu-l rănesc pe cel care le-a pus.
- `events` pentru sunet și efecte: `place`, `explode`, `crate`, `pickup`, `hit`, `shield`, `out`, `round`, `match`.
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
  - grila se trimite întreagă doar la început și la runde noi; în rest, doar diferențele;
  - plus jucătorii, bombele, flăcările și bonusurile.
- Ceilalți trimit `{k:'in', dx, dy, bomb}` la schimbare (și minimum de 5 ori pe secundă). Afișează snapshot-urile interpolate.
- Dacă gazda pleacă, gazda nouă continuă din ultimul snapshot complet.
- Boții rulează la gazdă.
