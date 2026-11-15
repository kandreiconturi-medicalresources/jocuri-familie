// Importă spritesheet-urile Kenney (CC0) într-un joc: copiază PNG-urile și transformă XML-ul în JSON.
// Folosire: node tools/import-kenney.mjs <folder-pachet-dezarhivat> <folder-destinație> <nume-sheet...>
// Ex.: node tools/import-kenney.mjs C:/tmp/x games/bobo/assets/kenney tiles enemies backgrounds
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [src, dest, ...sheets] = process.argv.slice(2);
if (!src || !dest || !sheets.length) {
  console.error('Folosire: node tools/import-kenney.mjs <sursă> <destinație> <sheet...>');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });

for (const s of sheets) {
  const base = join(src, 'Spritesheets', `spritesheet-${s}-default`);
  const xml = readFileSync(`${base}.xml`, 'utf8');
  const frames = {};
  for (const m of xml.matchAll(/<SubTexture name="([^"]+?)(?:\.png)?" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
    frames[m[1]] = [+m[2], +m[3], +m[4], +m[5]];
  }
  copyFileSync(`${base}.png`, join(dest, `${s}.png`));
  writeFileSync(join(dest, `${s}.json`), JSON.stringify(frames));
  console.log(`${s}: ${Object.keys(frames).length} cadre`);
}
const lic = join(src, 'License.txt');
if (existsSync(lic)) copyFileSync(lic, join(dest, 'LICENSE-kenney.txt'));
