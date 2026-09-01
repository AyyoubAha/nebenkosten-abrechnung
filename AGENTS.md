# Hinweise für Agenten

Quelle der Wahrheit ist das private Repo GeldMacher, Pfad products/nebenkosten/repo/.
Dorthin entwickeln, dann hierher spiegeln und pushen. Direkte Commits nur hier gelten
als Fehler.

Vor jeder Änderung lesen:
- docs-standards/PRODUCT_QUALITY_STANDARD.md (Prüfungen, die grün sein müssen)
- docs-standards/DESIGN_SYSTEM.md (Gestaltung „Abrechnungsbogen")
- docs-standards/VOICE_AND_COPY.md (Textregeln, automatisch geprüft)
- docs-standards/STACK_DECISIONS.md und DEFINITION_OF_DONE.md

Prüfbefehle: node --test test/engine.test.mjs; node ../build-pro.mjs && node test/e2e.mjs;
node test/copy-lint.mjs
