// Fixtures aus research/2026-09-01-nebenkosten-rechtsregeln.md — das Kontrollbeispiel
// MUSS centgenau reproduziert werden. Ausführen: node --test products/nebenkosten/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berechneAbrechnung, co2Split, warmwasserQ, gtzAnteil, tage } from '../docs/engine.mjs';

const basis = {
  zeitraum: { von: '2026-01-01', bis: '2026-12-31' },
  gebaeude: { wohnflaeche: 240 },
  einheiten: [
    { id: 'A', flaeche: 80 }, { id: 'B', flaeche: 80 }, { id: 'C', flaeche: 80 },
  ],
  heizung: {
    kostenGesamt: 3000,
    energieKwh: 24000,
    co2: { kg: 4824, kosten: 289.44 },
    verbrauchsanteil: 70,
    warmwasser: { methode: 'formel', volumenM3: 60, temperatur: 60 },
    verbraeucheHeizung: { A: 400, B: 350, C: 250 },
    verbraeucheWarmwasser: { A: 20, B: 25, C: 15 },
  },
};

test('CO2-Split: 20,1 kg/m² -> Stufe 20 % Vermieter, 57,89 €', () => {
  const s = co2Split({ kg: 4824, kosten: 289.44, wohnflaeche: 240 });
  assert.equal(s.spezifisch, 20.1);
  assert.equal(s.vermieterProzent, 20);
  assert.equal(s.vermieterAnteil, 57.89);
  assert.equal(s.mieterAnteil, 231.55);
});

test('CO2-Stufengrenzen exakt (11,9→0 %, 12,0→10 %, 52,0→95 % Vermieter... Mieteranteile)', () => {
  assert.equal(co2Split({ kg: 11.9 * 100, kosten: 100, wohnflaeche: 100 }).vermieterProzent, 0);
  assert.equal(co2Split({ kg: 12.0 * 100, kosten: 100, wohnflaeche: 100 }).vermieterProzent, 10);
  assert.equal(co2Split({ kg: 52.0 * 100, kosten: 100, wohnflaeche: 100 }).vermieterProzent, 95);
});

test('CO2 § 9-Ausnahmen: halbiert / entfällt', () => {
  assert.equal(co2Split({ kg: 4824, kosten: 289.44, wohnflaeche: 240, ausnahme: 'halb' }).vermieterAnteil, 28.94);
  assert.equal(co2Split({ kg: 4824, kosten: 289.44, wohnflaeche: 240, ausnahme: 'voll' }).vermieterAnteil, 0);
});

test('Warmwasser-Formel § 9: 2,5 × 60 m³ × (60−10) = 7500 kWh; Korrekturen', () => {
  assert.equal(warmwasserQ({ methode: 'formel', volumenM3: 60, temperatur: 60 }), 7500);
  assert.equal(warmwasserQ({ methode: 'flaeche', wohnflaeche: 100 }), 3200);
  assert.equal(warmwasserQ({ methode: 'gemessen', qKwh: 5000, korrektur: 'waermepumpe' }), 1500);
});

test('GTZ: Jan–Jun = 583 ‰ des Jahres', () => {
  const a = gtzAnteil('2026-01-01', '2026-06-30', '2026-01-01', '2026-12-31');
  assert.equal(Math.round(a * 1000), 583);
});

test('Kontrollbeispiel ohne Mieterwechsel: Einheit A = 1.075,10 €', () => {
  const input = { ...basis, mietverhaeltnisse: [
    { mieter: 'Mieter A', einheit: 'A', vorauszahlungen: 0 },
    { mieter: 'Mieter B', einheit: 'B', vorauszahlungen: 0 },
    { mieter: 'Mieter C', einheit: 'C', vorauszahlungen: 0 },
  ] };
  const r = berechneAbrechnung(input);
  const A = r.proMietverhaeltnis[0];
  const byName = Object.fromEntries(A.posten.map((p) => [p.bezeichnung, p.betrag]));
  assert.equal(byName['Heizung Grundkosten'], 202.27);
  assert.equal(byName['Heizung Verbrauchskosten'], 566.36);
  assert.equal(byName['Warmwasser Grundkosten'], 91.94);
  assert.equal(byName['Warmwasser Verbrauchskosten'], 214.53);
  assert.equal(A.summe, 1075.10);
  assert.equal(r.gebaeude.heizung.wwTopf, 919.41);
  assert.equal(r.gebaeude.heizung.heizTopf, 2022.70);
  assert.equal(r.gebaeude.co2.vermieterAnteil, 57.89);
});

test('Kontrollbeispiel MIT Mieterwechsel 30.06.: 646,21 € / 428,89 €', () => {
  const input = { ...basis, heizung: { ...basis.heizung,
    verbraeucheHeizung: { 'M1': 250, 'M2': 150, B: 350, C: 250 },
    verbraeucheWarmwasser: { 'M1': 12, 'M2': 8, B: 25, C: 15 },
  }, mietverhaeltnisse: [
    { id: 'M1', mieter: 'Mieter 1', einheit: 'A', von: '2026-01-01', bis: '2026-06-30', grundkostenMethode: 'gtz', vorauszahlungen: 0 },
    { id: 'M2', mieter: 'Mieter 2', einheit: 'A', von: '2026-07-01', bis: '2026-12-31', grundkostenMethode: 'gtz', vorauszahlungen: 0 },
    { mieter: 'Mieter B', einheit: 'B', vorauszahlungen: 0 },
    { mieter: 'Mieter C', einheit: 'C', vorauszahlungen: 0 },
  ] };
  const r = berechneAbrechnung(input);
  const M1 = r.proMietverhaeltnis[0], M2 = r.proMietverhaeltnis[1];
  const p1 = Object.fromEntries(M1.posten.map((p) => [p.bezeichnung, p.betrag]));
  assert.equal(p1['Heizung Grundkosten'], 117.92);       // 202,27 × 583 ‰
  assert.equal(p1['Heizung Verbrauchskosten'], 353.98);  // 250/400
  assert.equal(p1['Warmwasser Grundkosten'], 45.59);     // 181/365 zeitanteilig
  assert.equal(p1['Warmwasser Verbrauchskosten'], 128.72); // 12/20
  assert.equal(M1.summe, 646.21);
  assert.equal(M2.summe, 428.89);
  assert.equal(r2c(M1.summe + M2.summe), 1075.10);
});

test('Kalte Kosten: Fläche + Zeitanteil + Saldo mit Vorauszahlung', () => {
  const input = {
    zeitraum: { von: '2026-01-01', bis: '2026-12-31' },
    gebaeude: { wohnflaeche: 200 },
    einheiten: [{ id: 'A', flaeche: 100 }, { id: 'B', flaeche: 100 }],
    kalteKosten: [
      { art: 'Grundsteuer', betrag: 800, schluessel: 'flaeche' },
      { art: 'Müllabfuhr', betrag: 400, schluessel: 'einheiten' },
    ],
    mietverhaeltnisse: [
      { mieter: 'X', einheit: 'A', vorauszahlungen: 700 },
      { mieter: 'Y', einheit: 'B', von: '2026-07-01', vorauszahlungen: 100 },
    ],
  };
  const r = berechneAbrechnung(input);
  assert.equal(r.proMietverhaeltnis[0].summe, 600);      // 400 + 200
  assert.equal(r.proMietverhaeltnis[0].saldo, -100);     // Guthaben
  // Y: halbes Jahr (184/365)
  assert.equal(r.proMietverhaeltnis[1].posten[0].betrag, Math.round(800 * 0.5 * (184 / 365) * 100) / 100);
});

test('Einheiten ohne Mietverhältnis: Verbrauch (Einheiten-ID) bleibt im Maßstab, Anteil beim Vermieter', () => {
  // Nur A ist vermietet; B und C (Leerstand/Selbstnutzung) liefern Verbrauch unter ihrer ID.
  const input = { ...basis, mietverhaeltnisse: [{ mieter: 'Mieter A', einheit: 'A', vorauszahlungen: 0 }] };
  const r = berechneAbrechnung(input);
  const A = r.proMietverhaeltnis[0];
  // Identische Zahlen wie im Vollvermietungs-Fall: A zahlt 400/1000 bzw. 20/60, nicht 100 %.
  assert.equal(A.summe, 1075.10);
  assert.equal(r.proMietverhaeltnis.length, 1);
});

test('Kalte Kosten nach Verbrauch (Zähler): Anteil eigener/Gesamt, Leerstand verdünnt', () => {
  const input = {
    zeitraum: { von: '2026-01-01', bis: '2026-12-31' },
    gebaeude: { wohnflaeche: 240 },
    einheiten: [{ id: 'A', flaeche: 80 }, { id: 'B', flaeche: 80 }, { id: 'C', flaeche: 80 }],
    kalteKosten: [{ art: 'Wasser', betrag: 600, schluessel: 'verbrauch', verbrauch: { A: 30, B: 20, C: 10 } }],
    mietverhaeltnisse: [
      { mieter: 'X', einheit: 'A', vorauszahlungen: 0 },
      { mieter: 'Y', einheit: 'B', vorauszahlungen: 0 },
      // C ist Leerstand: sein Verbrauch (10) bleibt im Nenner, der Anteil beim Vermieter
    ],
  };
  const r = berechneAbrechnung(input);
  assert.equal(r.proMietverhaeltnis[0].posten[0].betrag, 300); // 600 × 30/60
  assert.equal(r.proMietverhaeltnis[1].posten[0].betrag, 200); // 600 × 20/60
  assert.equal(r.proMietverhaeltnis[0].posten[0].anteilText, '30 / 60');
});

test('Warnung bei Verbrauchsanteil außerhalb 50–70 %', () => {
  const input = { ...basis, heizung: { ...basis.heizung, verbrauchsanteil: 80 }, mietverhaeltnisse: [{ mieter: 'A', einheit: 'A' }] };
  const r = berechneAbrechnung(input);
  assert.ok(r.warnungen.some((x) => x.includes('50–70')));
});

function r2c(n) { return Math.round(n * 100) / 100; }
