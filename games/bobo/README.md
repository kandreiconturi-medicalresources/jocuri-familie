# Aventura lui Bobo și Mimi — contract

Platformer pentru 1–2 jucători (Bobo = ursuleț, Mimi = iepuraș), cu 150 de niveluri (10 lumi × 15) și vieți nelimitate.

## Module
| Fișier | Rol | Proprietar |
|---|---|---|
| `src/tiles.js` | legenda plăcilor, `TS=32`, `ROWS=17` | fix |
| `src/physics.js` | `stepPlayer`, `moveX/moveY`, constante; fără efecte | fix (doar extinderi) |
| `src/levels/` | `builder.js`, `classic.js` (L1–L3), `worlds.js`, `chunks/`, `generator.js`, `validate.js`; intrare: `index.js` (`getLevel`, `levelMeta`, `LEVEL_COUNT`, `WORLDS`) | agent niveluri |
| `src/` restul, `render/`, `screens/`, `index.html` | jocul: stare, jucători, inamici, boss, randare, meniuri | agent joc |

## Formatul nivelului (`getLevel(i)`)
```js
{ index, world /*0–9*/, num /*1–15*/, theme /*cheia lumii*/, name, isBoss,
  width, rows: 17, grid: string[17][width],          // copie nouă, se modifică în joc
  spawn: {tx, ty}, portal: {tx, ty},                  // ty = rândul suprafeței (tălpile la ty*TS)
  checkpoints: [{tx, ty}],
  enemies: [{ type, tx, ty, range?, ... }],           // tipurile de mai jos
  platforms: [{ tx, ty, w, dx, dy, speed }],          // platforme mobile one-way: din (tx,ty) până în (tx+dx,ty+dy), dus-întors
  boss: null | { type, hp } }
```

## Legenda grilei (`tiles.js`)
- `.` gol
- `#` teren
- `L` piatră/scări
- `B` cărămidă: se sparge de jos dacă jucătorul e mare
- Cutii lovite de jos, care devin `g` (cutie goală) după lovitură:
  - `G` → căpșună
  - `Q` → bulă-scut
  - `C` → creștere
  - `S` → baghetă
- `=` platformă prin care sari de jos
- `o` căpșună · `h` inimă · `*` steluță (exact 3 pe nivel)
- `^` țepi (rănesc)
- `~` apă (înot)
- `I` gheață (alunecos)
- `T` trambulină
- `X` bloc care se prăbușește: cade după 30 de cadre în care stai pe el și revine după 180
- `V` lavă (moarte)

## Lumi și mecanici (cumulative)
| # | Lume | Teren Kenney | Mecanică nouă | Inamic nou | Boss (niv. 15) |
|---|---|---|---|---|---|
| 1 | Pajiștea Însorită | grass | de bază, cutii | snail, bee | melc uriaș |
| 2 | Pădurea Fermecată | grass (fundal trees) | `=` platforme | ladybug | buburuză uriașă |
| 3 | Dealurile Apusului | purple | platforme mobile | fly | muscă uriașă |
| 4 | Deșertul Auriu | sand (fundal desert) | `X` blocuri care cad | worm, saw | vierme uriaș |
| 5 | Plaja Scoicilor | sand | `~` apă | fish | pește uriaș |
| 6 | Peștera de Cristal | stone | `^` țepi mulți | slime_spike, block (cade) | bloc uriaș |
| 7 | Țara Zăpezii | snow | `I` gheață | mouse | șoarece uriaș |
| 8 | Ciupercile Uriașe | dirt (fundal mushrooms) | `T` trambuline | frog | broască uriașă |
| 9 | Castelul din Nori | cloud (`terrain_*_cloud`) | nori `X` + platforme mobile | slime_normal | slime uriaș |
| 10 | Vulcanul Fierbinte | stone, întunecat | `V` lavă + bile de foc | slime_fire, fireball | slime de foc uriaș |

Tipuri de inamici (`enemies[].type`), după sprite-urile din `assets/kenney/enemies.json`:
- care umblă: `snail`, `ladybug`, `mouse`, `worm`, `slime_normal`, `slime_fire`, `slime_spike` (nu poate fi strivit);
- care zboară: `bee` (orizontal), `fly` (vertical);
- `fish` (înoată);
- `frog` (sare periodic);
- `block` (cade când treci pe sub el; nu poate fi strivit);
- `saw` (se mișcă pe `range`; nu poate fi strivit);
- `fireball` (sare din lavă; nu poate fi strivit).

Boss-ul are `hp` între 3 și 6. Îl lovești sărindu-i în cap sau cu bagheta. După fiecare lovitură devine invulnerabil 60 de cadre și se mișcă mai repede.

## Reguli de joc
- Vieți nelimitate: 3 inimi; la 0 inimi reapari la ultimul checkpoint, cu 3 inimi. Lava și căzutul în gol trimit tot la checkpoint.
- Steluțele (`*`) se salvează per nivel (cel mai bun rezultat). Nivelul următor se deblochează la terminarea celui curent.
- Salvarea se face prin `gameSave('bobo')` din `shared/engine/profiles.js`: `{ unlocked, stars: {i: 0–3}, fruits: {i: n}, twoPlayers }`.

## Grafică
- Bobo, Mimi, căpșunile, portalul și efectele sunt desenate în cod (stilul din original, `drawHero`).
- Restul vine din Kenney (`assets/kenney/*.png` + `.json` = `{nume: [x,y,w,h]}`, cadre de 64 px desenate la 32 logici).
- Terenul are autotile (`_top`, `_top_left`, `_center` etc.) pre-randat pe bucăți, pentru viteză pe A9.
