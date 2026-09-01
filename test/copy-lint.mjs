// Prüft alle nutzerseitigen Texte auf verbotene Zeichen und Floskeln.
// Regeln: docs/VOICE_AND_COPY.md. Ausführen: node test/copy-lint.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DOCS = join(ROOT, 'docs');

const VERBOTEN = [
  { re: /—/g, name: 'Geviertstrich (em dash)' },
  { re: /·/g, name: 'Mittelpunkt als Trenner' },
  { re: /•/g, name: 'Bullet-Zeichen im Fließtext' },
  { re: /revolutionär/gi, name: 'Floskel "revolutionär"' },
  { re: /nahtlos/gi, name: 'Floskel "nahtlos"' },
  { re: /leistungsstark/gi, name: 'Floskel "leistungsstark"' },
  { re: /auf das nächste Level/gi, name: 'Floskel "nächstes Level"' },
  { re: /[Nn]icht (nur )?\w+, sondern/g, name: 'Konstruktion "nicht X, sondern Y"' },
];

const dateien = readdirSync(DOCS, { recursive: true })
  .filter((f) => ['.html', '.txt', '.mjs'].includes(extname(String(f))))
  .map((f) => join(DOCS, String(f)));

let fehler = 0;
for (const datei of dateien) {
  const zeilen = readFileSync(datei, 'utf8').split('\n');
  zeilen.forEach((zeile, i) => {
    for (const { re, name } of VERBOTEN) {
      re.lastIndex = 0;
      if (re.test(zeile)) {
        console.error(`${datei.replace(ROOT, '')}:${i + 1}  ${name}\n    ${zeile.trim().slice(0, 120)}`);
        fehler++;
      }
    }
  });
}
console.log(fehler === 0 ? `Copy-Lint bestanden (${dateien.length} Dateien).` : `\n${fehler} Verstöße gefunden.`);
process.exit(fehler ? 1 : 0);
