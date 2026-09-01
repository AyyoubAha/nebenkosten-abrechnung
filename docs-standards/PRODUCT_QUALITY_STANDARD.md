# Qualitätsstandard

Jede Änderung an diesem Produkt gilt erst als fertig, wenn alle Punkte erfüllt sind:

1. Rechenkern: node --test test/engine.test.mjs ist grün. Das juristisch hergeleitete
   Kontrollbeispiel (1.075,10 Euro; Mieterwechsel 646,21 und 428,89 Euro) wird centgenau
   reproduziert.
2. Oberfläche: node ../build-pro.mjs && node test/e2e.mjs ist grün (freie Seite über HTTP
   und Pro-Artefakt über file://).
3. Texte: node test/copy-lint.mjs ist grün (Regeln in VOICE_AND_COPY.md).
4. Gestaltung folgt DESIGN_SYSTEM.md. Kein neuer Kasten, kein Radius, kein Schatten,
   keine neue Farbe ohne Eintrag dort.
5. Druckbild geprüft: Die erzeugte Abrechnung ist das eigentliche Produkt; Änderungen an
   .abrechnung immer auch im Druckdialog kontrollieren.
6. Tastatur: alle Bedienelemente erreichbar, Fokus sichtbar, dynamische Zeilen haben
   aria-label.
7. Nach Deploy: Live-URLs liefern 200 und die Bytes entsprechen dem getesteten Stand.
