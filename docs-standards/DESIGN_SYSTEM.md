# Design-System „Abrechnungsbogen"

Art Direction in einem Satz: Ein ruhiges Formular auf warmem Papier mit Flaschengrün als
einziger Farbe, dünnen harten Linien wie auf einem Abrechnungsbogen, Versal-Beschriftungen
und Tabellenziffern; gegliedert wird durch Nummern und Linien, nicht durch Kästen.

## Typografie
- Ein Grotesk-Systemstapel: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial.
  Begründung: Das Produktversprechen (läuft offline, kein Request an Dritte) verbietet
  Webfonts. Der Stapel ist dokumentiert und damit eine Entscheidung, kein Default.
- Zahlen immer mit font-variant-numeric: tabular-nums.
- Beschriftungen (Labels, Tabellenköpfe, Abschnittstitel): Versalien, letter-spacing
  0.06 bis 0.14 em, 0.7 bis 0.78 rem, Gewicht 600 bis 700.
- Fließtext 15.5 bis 16 px, Zeilenhöhe 1.55 bis 1.6. H1 als einzige große Stufe.

## Farbe (Tokens in stil.css und im Kopf von index.html)
- papier #f4f1ea, blatt #fdfcf8, tinte #26221a, grau #6d675a, linie #d8d2c2
- gruen #1f5c48 (einzige Akzentfarbe), rot #9c3423 nur für Fehler und Nachzahlung,
  warn #7c6017 nur für Hinweise. Dunkelmodus über prefers-color-scheme.

## Container-Logik
- Border-Radius 0, Box-Shadow 0. Keine Pills, keine Badges, keine Karten.
- Abschnitte: fieldset ohne Rahmen, nur border-top 1px in Tintenfarbe; legend als
  nummerierter Versaltitel auf der Linie.
- Flächen (blatt) nur für echte Dokumente: die erzeugte Abrechnung und das Muster.
  Dokumentkopf dort mit 3px-Doppellinie (border-bottom: 3px double).
- Betonte Nebeninhalte (Beispiel, Zählerstand-Unterzeile): 3px- bzw. 2px-Linksstrich
  in gruen, kein umschließender Kasten.

## Zustände
- Fokus: 2px Outline in gruen (":focus-visible" global, Formularfelder mit offset -1px).
- Hover: definierte Farbwechsel (gruen zu gruen-dunkel), keine filter-Tricks.
- Readonly-Felder: graue Schrift auf Papierton. Disabled: Opazität 0.5 plus not-allowed.
- Fehler (rot) und Hinweise (warn) als Linksstrich-Blöcke mit role="alert" bzw. "status".

## Bewegung
- Nur Farbtransitionen (0.12 s), ausschließlich unter
  @media (prefers-reduced-motion: no-preference). scrollIntoView nutzt "smooth" nur,
  wenn Reduced Motion nicht gesetzt ist.

## Dateien
- Werkzeugseite: docs/index.html trägt ihr CSS inline (Basis für den Pro-Build).
- Ratgeber, Kaufseite, Rechtsseiten: gemeinsames docs/stil.css.
