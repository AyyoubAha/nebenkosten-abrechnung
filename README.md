# Nebenkostenabrechnung – kostenloser Rechner für Vermieter

**[→ Zum Rechner](https://ayyoubaha.github.io/nebenkosten-abrechnung/)**

Erstellt formell ordnungsgemäße Betriebs- und Heizkostenabrechnungen (BGH-Anforderungen:
Gesamtkosten, Umlageschlüssel, Rechenweg, Saldo) **komplett lokal im Browser** – keine Cloud,
keine Registrierung, keine Datenübertragung.

## Funktionen

- **Heizkostenverordnung:** 50–70-Split, Warmwasser-Abtrennung nach § 9
  (Wärmezähler, Formel 2,5 × V × (t−10) oder Pauschale; Korrekturen für Brennwert-Erdgas,
  Wärmelieferung, Wärmepumpe)
- **CO2-Kostenaufteilung** nach dem 10-Stufen-Modell (CO2KostAufG) inkl. Pflicht-Ausweis
- **Kalte Betriebskosten** (§ 2 BetrKV): Wohnfläche, Einheiten, Personentage – taggenau
- **Leerstand/Selbstnutzung** bleibt korrekt im Verteilungsmaßstab
- Druck je Mietverhältnis (PDF über den Druckdialog), lokale Speicherung im Browser
- [Pro-Version](https://ayyoubaha.github.io/nebenkosten-abrechnung/pro.html): bis 10 Einheiten,
  Mieterwechsel nach § 9b HeizkostenV (Zwischenablesung + Gradtagszahlen/Zeitanteil),
  CO2-Sonderfälle § 9, JSON-Sicherung, Sammeldruck

## Ratgeber

- [Nebenkostenabrechnung erstellen: Schritt für Schritt](https://ayyoubaha.github.io/nebenkosten-abrechnung/nebenkostenabrechnung-erstellen.html)
- [Umlagefähige Nebenkosten: die Liste nach § 2 BetrKV](https://ayyoubaha.github.io/nebenkosten-abrechnung/umlagefaehige-nebenkosten.html)
- [Frist der Nebenkostenabrechnung (§ 556 BGB)](https://ayyoubaha.github.io/nebenkosten-abrechnung/nebenkostenabrechnung-frist.html)
- [Heizkostenabrechnung selbst erstellen (HeizkostenV)](https://ayyoubaha.github.io/nebenkosten-abrechnung/heizkostenabrechnung-selbst-erstellen.html)
- [CO2-Kosten zwischen Vermieter und Mieter aufteilen](https://ayyoubaha.github.io/nebenkosten-abrechnung/co2-kosten-vermieter-rechner.html)
- [Mieterwechsel: Heiz- und Nebenkosten aufteilen](https://ayyoubaha.github.io/nebenkosten-abrechnung/nebenkostenabrechnung-mieterwechsel.html)
- [Leerstand und Selbstnutzung in der Abrechnung](https://ayyoubaha.github.io/nebenkosten-abrechnung/nebenkostenabrechnung-leerstand.html)
- [Muster mit echten Zahlen](https://ayyoubaha.github.io/nebenkosten-abrechnung/nebenkostenabrechnung-muster.html)

## Technik

Statisches HTML + ein ES-Modul (`docs/engine.mjs`) ohne Abhängigkeiten. Der Rechenkern ist
gegen ein juristisch hergeleitetes Kontrollbeispiel centgenau getestet (`test/`):

```bash
node --test test/engine.test.mjs   # Rechenkern (Fixtures inkl. Mieterwechsel, CO2-Stufen)
node test/e2e.mjs                  # Browser-E2E (Playwright/Chromium erforderlich)
```

Hinweise ohne Gewähr – keine Rechts- oder Steuerberatung.

## Lizenz

MIT – siehe [LICENSE](LICENSE).

Verwandtes Projekt: [E-Rechnung Viewer & Generator](https://github.com/AyyoubAha/e-rechnung-viewer)
