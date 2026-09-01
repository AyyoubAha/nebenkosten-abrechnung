# Stack-Entscheidungen

- Statisches HTML plus ein ES-Modul (docs/engine.mjs) ohne Laufzeit-Abhängigkeiten.
  Begründung: Datenschutz-Versprechen (alles lokal), Betrieb auf GitHub Pages ohne Kosten,
  keine Angriffsfläche durch Dritt-Code.
- Keine Webfonts, keine CDNs, keine Frameworks. Einzige externe Ressource ist das
  GoatCounter-Zählskript auf der Website; der Pro-Build entfernt es (Build-Prüfung).
- Tests: node:test für den Rechenkern, Playwright (Chromium) für Oberfläche und
  Kaufartefakt, eigener Copy-Lint. Playwright wird aus dem Schwester-Repo aufgelöst
  (PW_CORE überschreibbar) und ist keine Abhängigkeit dieses Repos.
- Pro-Auslieferung: eine HTML-Datei (Engine inline, klassisches Script) für file://-Start;
  Build in ../build-pro.mjs (privates Repo), Version dort pflegen.
- Abhängigkeits-Lage September 2026: keine Laufzeit-Abhängigkeiten, daher keine offenen
  Advisories. Vor jedem Release kurz prüfen, ob das unverändert gilt.
