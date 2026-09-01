// E2E-Test in echtem Chromium, zwei Teile:
//  1) Freie Version (index.html über HTTP): Rechenweg, Freemium-Gate, Persistenz.
//  2) Pro-Auslieferung (dist/nebenkosten-pro.html über file:// — exakt das Kaufartefakt):
//     volles Kontrollbeispiel, Mieterwechsel, Salden, Pro-Funktionen sichtbar.
// Fixtures identisch mit engine.test.mjs (rechtlich hergeleitetes Kontrollbeispiel).
// Aufruf: node ../build-pro.mjs && node test/e2e.mjs [shots]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pwCandidates = [
  process.env.PW_CORE,
  new URL('../../../../../e-rechnung-viewer/node_modules/playwright-core', import.meta.url).pathname,
].filter(Boolean);
const pwPath = pwCandidates.find((p) => existsSync(p));
if (!pwPath) { console.error('playwright-core nicht gefunden (PW_CORE setzen)'); process.exit(1); }
const { chromium } = require(pwPath);

const DIR = new URL('../docs/', import.meta.url).pathname;
const SHOTS = process.argv[2] || join(process.env.TMPDIR || '/tmp', 'nk-shots');
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = readFileSync(join(DIR, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
page.on('console', (m) => {
  // Externes Statistik-Skript (gc.zgo.at) darf in der Testumgebung fehlschlagen — alles andere ist ein Fehler.
  if (m.type() === 'error' && !/gc\.zgo\.at|goatcounter/.test(m.location()?.url || '')) {
    console.error('CONSOLE:', m.text(), m.location()?.url || '');
    process.exitCode = 1;
  }
});

let failures = 0;
const check = (cond, label) => { console.log((cond ? '✓ ' : '✗ ') + label); if (!cond) failures++; };
const norm = (t) => (t || '').replace(/[\u00a0\u202f]/g, ' ');
const cardText = async (i) => norm(await page.locator('.abrechnung').nth(i).textContent());
const seed = (s) => page.evaluate((st) => window.__nkLoad(st), s);

// Gemeinsame Fixtures (Kontrollbeispiel aus research/2026-09-01)
const kontrollBasis = {
  meta: { objekt: 'Musterstraße 1, 12345 Musterstadt', vermieter: 'Max Vermieter', vermieterAdresse: 'Vermieterweg 2, 12345 Musterstadt' },
  zeitraum: { von: '2026-01-01', bis: '2026-12-31' },
  gebaeudeFlaeche: 240,
  einheiten: [{ name: 'A', flaeche: 80 }, { name: 'B', flaeche: 80 }, { name: 'C', flaeche: 80 }],
  kosten: [],
  heizung: {
    kosten: 3000, kwh: 24000, va: 70, co2kg: 4824, co2eur: 289.44, co2aus: 'keine',
    wwMethode: 'formel', wwKorr: '', wwM3: 60, wwTemp: 60, wwKwh: '',
  },
};

// ================= Teil 1: Freie Version =================
console.log('— Freie Version (HTTP) —');
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__nkLoad === 'function');
check((await page.title()).includes('Nebenkostenabrechnung'), 'Seite lädt, Titel gesetzt');
check((await page.locator('#t_einheiten tbody tr').count()) === 1, 'Leerer Start: eine Einheiten-Zeile vorbereitet');

await page.click('#berechnen');
check(await page.locator('#errbox.show').isVisible(), 'Unvollständige Eingabe: Fehlerbox erscheint');

// Gate: Pro-Funktionen versteckt/gesperrt
check(!(await page.locator('#export').isVisible()) && !(await page.locator('#importbtn').isVisible()),
  'Frei: JSON-Export/-Import ausgeblendet');
check(!(await page.locator('#drucken_alle').isVisible()), 'Frei: Sammeldruck ausgeblendet');
check(await page.locator('#h_co2aus').isDisabled(), 'Frei: CO2-Ausnahme § 9 gesperrt (Pro)');

// Gate: zweites Mietverhältnis -> Probox statt Zeile
await page.click('[data-add="mieter"]');
check(await page.locator('#probox.show').isVisible(), 'Frei: 2. Mietverhältnis öffnet Pro-Hinweis');
check((await page.locator('#t_mieter tbody tr').count()) === 1, 'Frei: 2. Mietverhältnis wird nicht angelegt');
check(norm(await page.textContent('#probox')).includes('39 Euro'), 'Pro-Hinweis nennt Preis 39 Euro');
await page.screenshot({ path: join(SHOTS, '1-frei-gate.png') });

// Frei rechnet korrekt: 1 Mietverhältnis, Rest des Gebäudes als Leerstand/Selbstnutzung
// (Verbrauch der unvermieteten Einheiten unter der Einheiten-ID) — MUSS dieselben
// Zahlen liefern wie das voll vermietete Kontrollbeispiel: 1.075,10 €.
await seed({ ...kontrollBasis,
  mieter: [{ einheit: 'A', mieter: 'Mieter A', vorauszahlungen: 0 }],
  heizung: { ...kontrollBasis.heizung, verbrauchH: { MV0: 400, B: 350, C: 250 }, verbrauchW: { MV0: 20, B: 25, C: 15 } },
});
await page.waitForSelector('#ergebnis.show');
check((await page.locator('.abrechnung').count()) === 1, 'Frei: genau eine Abrechnung');
const frei = await cardText(0);
check(frei.includes('1.075,10 €'), 'Frei: Kontrollbeispiel-Summe 1.075,10 € (Leerstands-Verbrauch im Maßstab)');
check(frei.includes('400 / 1000'), 'Frei: Verteilungsmaßstab 400/1000 inkl. unvermieteter Einheiten');
check(frei.includes('20,1 kg CO2 je m² Wohnfläche und Jahr') && frei.includes('57,89'), 'Frei: CO2-Block vollständig');
check(norm(await page.textContent('#t_verbrauch')).includes('ohne Mietverhältnis'), 'Frei: Leerstands-Zeilen in Verbrauchstabelle');

// Kalte Kosten nach Verbrauch (Zähler): Unterzeile mit Zählerständen je Partei
await seed({ ...kontrollBasis,
  mieter: [{ einheit: 'A', mieter: 'Mieter A', vorauszahlungen: 0 }],
  kosten: [{ art: 'Wasser', betrag: 600, schluessel: 'verbrauch', verbrauch: { MV0: 30, B: 20, C: 10 } }],
  heizung: null,
});
await page.waitForSelector('#ergebnis.show');
check((await page.locator('tr.kvsub .kv_in').count()) === 3, 'Frei: Zähler-Unterzeile mit 3 Partei-Feldern');
const wasser = await cardText(0);
check(wasser.includes('300,00 €') && wasser.includes('30 / 60'), 'Frei: Wasser nach Zähler 600 × 30/60 = 300,00 €');

// Persistenz über Reload
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__nkLoad === 'function');
check(await page.inputValue('#z_von') === '2026-01-01', 'Frei: Zeitraum aus localStorage wiederhergestellt');
check((await page.locator('#t_einheiten tbody tr').count()) === 3, 'Frei: Einheiten wiederhergestellt');

// ================= Teil 2: Pro-Auslieferung (file://) =================
console.log('— Pro-Auslieferung (file://) —');
const proFile = process.env.PRO_FILE || new URL('../../dist/nebenkosten-pro.html', import.meta.url).pathname;
if (!existsSync(proFile)) {
  console.log('(Pro-Artefakt nicht vorhanden — Teil 2 übersprungen; PRO_FILE setzen zum Testen)');
  await browser.close(); server.close();
  console.log(failures === 0 ? '\nAlle E2E-Checks bestanden.' : `\n${failures} Checks FEHLGESCHLAGEN`);
  process.exit(failures === 0 && process.exitCode !== 1 ? 0 : 1);
}
await page.goto('file://' + proFile, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__nkLoad === 'function');
check((await page.title()).includes('Pro'), 'Pro: Datei lädt per Doppelklick (file://), Titel gesetzt');
check(norm(await page.textContent('header')).includes('Pro Version 1.2'), 'Pro: Versions-Badge');
check(await page.locator('#export').isVisible() && await page.locator('#drucken_alle').isVisible(),
  'Pro: Export & Sammeldruck sichtbar');
check(!(await page.locator('#h_co2aus').isDisabled()), 'Pro: CO2-Ausnahme § 9 wählbar');

// Brennstoff-Abgrenzung (Leistungsprinzip): 500 + 2000 − 300 + 163,50 = 2.363,50
await page.check('#bs_aktiv');
check(await page.locator('#bsblock').isVisible(), 'Pro: Abgrenzungs-Block erscheint');
await page.fill('#bs_anfang', '500');
await page.fill('#bs_kauf', '2000');
await page.fill('#bs_ende', '300');
await page.fill('#bs_neben', '163,50');
check(await page.inputValue('#h_kosten') === '2363.5', 'Pro: Leistungsprinzip rechnet 2.363,50 € in Gesamtkosten');
check(await page.locator('#h_kosten').evaluate((el) => el.readOnly), 'Pro: Gesamtfeld bei aktiver Abgrenzung schreibgeschützt');
await page.uncheck('#bs_aktiv');
check(!(await page.locator('#h_kosten').evaluate((el) => el.readOnly)), 'Pro: Gesamtfeld wieder frei nach Deaktivierung');

// Volles Kontrollbeispiel (3 Mietverhältnisse)
await seed({ ...kontrollBasis,
  mieter: [
    { einheit: 'A', mieter: 'Mieter A', vorauszahlungen: 0 },
    { einheit: 'B', mieter: 'Mieter B', vorauszahlungen: 0 },
    { einheit: 'C', mieter: 'Mieter C', vorauszahlungen: 0 },
  ],
  heizung: { ...kontrollBasis.heizung, verbrauchH: { MV0: 400, MV1: 350, MV2: 250 }, verbrauchW: { MV0: 20, MV1: 25, MV2: 15 } },
});
await page.waitForSelector('#ergebnis.show');
check((await page.locator('.abrechnung').count()) === 3, 'Pro: 3 Abrechnungen gerendert');
const a = await cardText(0);
check(a.includes('202,27') && a.includes('566,36') && a.includes('91,94') && a.includes('214,53'),
  'Pro: alle vier Heiz-/WW-Posten centgenau (202,27 / 566,36 / 91,94 / 214,53)');
check(a.includes('1.075,10 €'), 'Pro: Einheit A Summe 1.075,10 €');
check(a.includes('20,1 kg CO2 je m² Wohnfläche und Jahr') && a.includes('Vermieteranteil 20 %') && a.includes('57,89'),
  'Pro: CO2-Block Einstufung 20,1 → 20 %, 57,89 €');
check(a.includes('§ 556') && a.includes('12 Monaten'), 'Pro: Einwendungsfrist § 556 BGB');
check(a.includes('Umlageschlüssel') && a.includes('Gesamtkosten'), 'Pro: BGH-Pflichtspalten');
check((await page.locator('.printbtn').count()) === 3, 'Pro: je Abrechnung ein Druck-Button');
await page.screenshot({ path: join(SHOTS, '2-pro-kontrollbeispiel.png') });

// Mieterwechsel 30.06. (Gradtagszahlen)
await seed({ ...kontrollBasis,
  mieter: [
    { einheit: 'A', mieter: 'Mieter 1', von: '2026-01-01', bis: '2026-06-30', grundkostenMethode: 'gtz', vorauszahlungen: 0 },
    { einheit: 'A', mieter: 'Mieter 2', von: '2026-07-01', grundkostenMethode: 'gtz', vorauszahlungen: 0 },
    { einheit: 'B', mieter: 'Mieter B', vorauszahlungen: 0 },
    { einheit: 'C', mieter: 'Mieter C', vorauszahlungen: 0 },
  ],
  heizung: { ...kontrollBasis.heizung,
    verbrauchH: { MV0: 250, MV1: 150, MV2: 350, MV3: 250 },
    verbrauchW: { MV0: 12, MV1: 8, MV2: 25, MV3: 15 },
  },
});
await page.waitForSelector('#ergebnis.show');
check((await page.locator('.abrechnung').count()) === 4, 'Pro Mieterwechsel: 4 Abrechnungen');
const m1 = await cardText(0), m2 = await cardText(1);
check(m1.includes('646,21 €'), 'Pro: Mieter 1 (Jan–Jun) 646,21 €');
check(m2.includes('428,89 €'), 'Pro: Mieter 2 (Jul–Dez) 428,89 €');
check(m1.includes('01.01.2026 bis 30.06.2026'), 'Pro: Nutzungszeitraum ausgewiesen');
check(m1.includes('Gradtagszahlen'), 'Pro: GTZ-Methode im Schlüssel benannt');
await page.screenshot({ path: join(SHOTS, '3-pro-mieterwechsel.png') });

// Kalte Kosten, Zeitanteil, Guthaben
await seed({
  meta: { objekt: 'Objekt', vermieter: 'V', vermieterAdresse: '' },
  zeitraum: { von: '2026-01-01', bis: '2026-12-31' },
  gebaeudeFlaeche: 200,
  einheiten: [{ name: 'EG', flaeche: 100 }, { name: 'OG', flaeche: 100 }],
  mieter: [
    { einheit: 'EG', mieter: 'X', vorauszahlungen: 700 },
    { einheit: 'OG', mieter: 'Y', von: '2026-07-01', vorauszahlungen: 100 },
  ],
  kosten: [
    { art: 'Grundsteuer', betrag: 800, schluessel: 'flaeche' },
    { art: 'Müllabfuhr', betrag: 400, schluessel: 'einheiten' },
  ],
  heizung: null,
});
await page.waitForSelector('#ergebnis.show');
const x = await cardText(0), y = await cardText(1);
check(x.includes('600,00 €') && x.includes('Guthaben') && x.includes('100,00 €'),
  'Pro kalt: X = 600,00 €, Guthaben 100,00 €');
check(y.includes('184/365 Tage'), 'Pro kalt: Zeitanteil 184/365 Tage');

// Warnung Verbrauchsanteil außerhalb 50–70 %
await seed({ ...kontrollBasis,
  mieter: [{ einheit: 'A', mieter: 'Mieter A', vorauszahlungen: 0 }],
  heizung: { ...kontrollBasis.heizung, va: 80, verbrauchH: { MV0: 400, B: 350, C: 250 }, verbrauchW: { MV0: 20, B: 25, C: 15 } },
});
await page.waitForSelector('#ergebnis.show');
check(norm(await page.textContent('#warnbox')).includes('50–70'), 'Pro: Warnung bei Verbrauchsanteil 80 %');

await browser.close();
server.close();
console.log(failures === 0 ? `\nAlle E2E-Checks bestanden. Screenshots: ${SHOTS}` : `\n${failures} Checks FEHLGESCHLAGEN`);
process.exit(failures === 0 && process.exitCode !== 1 ? 0 : 1);
