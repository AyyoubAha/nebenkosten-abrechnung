/**
 * Rechen-Kern Nebenkostenabrechnung (Wette #3).
 * Implementiert das „Minimal korrekte Rechenmodell" aus
 * research/2026-09-01-nebenkosten-rechtsregeln.md (dort alle Rechtsgrundlagen).
 *
 * Pure Funktionen, kein DOM — testbar in Node, nutzbar im Browser.
 * Geld: intern ungerundet, Ausgabeblöcke centgenau gerundet (wie BGH-übliche Darstellung).
 */

// CO2KostAufG Anlage: [Obergrenze kg CO2/m²/a (exklusiv), Mieteranteil %]
export const CO2_STUFEN = [
  [12, 100], [17, 90], [22, 80], [27, 70], [32, 60],
  [37, 50], [42, 40], [47, 30], [52, 20], [Infinity, 5],
];

// Gradtagszahlen-Promille je Monat (anerkannte Regeln der Technik; Summe 1000)
export const GTZ_PROMILLE = { 1: 170, 2: 150, 3: 130, 4: 80, 5: 40, 6: 13, 7: 13, 8: 14, 9: 30, 10: 80, 11: 120, 12: 160 };

export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const d = (iso) => new Date(iso + 'T00:00:00Z');
const DAY = 86400000;
export const tage = (von, bis) => Math.round((d(bis) - d(von)) / DAY) + 1; // inkl. beider Grenztage
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Überlappung zweier ISO-Zeiträume in Tagen (inkl.), 0 wenn keine. */
export function ueberlappungTage(aVon, aBis, bVon, bBis) {
  const von = d(aVon) > d(bVon) ? aVon : bVon;
  const bis = d(aBis) < d(bBis) ? aBis : bBis;
  return d(von) > d(bis) ? 0 : tage(von, bis);
}

/** GTZ-Anteil (0..1) eines Teilzeitraums am Gesamtzeitraum, taggenau nach Promille-Tabelle. */
export function gtzAnteil(teilVon, teilBis, gesVon, gesBis) {
  const promilleImZeitraum = (von, bis) => {
    let sum = 0;
    let cur = d(von);
    const end = d(bis);
    while (cur <= end) {
      const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1;
      const dim = daysInMonth(y, m);
      const monatsEnde = new Date(Date.UTC(y, m - 1, dim));
      const bisHier = monatsEnde < end ? monatsEnde : end;
      const tageImMonat = Math.round((bisHier - cur) / DAY) + 1;
      sum += GTZ_PROMILLE[m] * (tageImMonat / dim);
      cur = new Date(bisHier.getTime() + DAY);
    }
    return sum;
  };
  const ges = promilleImZeitraum(gesVon, gesBis);
  return ges === 0 ? 0 : promilleImZeitraum(teilVon, teilBis) / ges;
}

/** CO2-Aufteilung nach 10-Stufen-Modell. ausnahme: 'keine' | 'halb' (§9 eine Vorgabe) | 'voll' (§9 beide). */
export function co2Split({ kg, kosten, wohnflaeche, ausnahme = 'keine', zeitraumTage = 365 }) {
  if (!kosten || kosten <= 0) return { spezifisch: 0, stufeMieterProzent: 100, vermieterAnteil: 0, mieterAnteil: r2(kosten || 0) };
  const spezifisch = Math.round((kg / wohnflaeche) * 10) / 10; // Rundung 1 Nachkommastelle (§5 Abs.1 S.3)
  const faktor = Math.min(zeitraumTage / 365, 1); // Rumpfzeitraum: Grenzwerte anteilig kürzen (§5 S.4)
  let mieterProzent = 100;
  for (const [grenze, prozent] of CO2_STUFEN) {
    if (spezifisch < grenze * faktor || grenze === Infinity) { mieterProzent = prozent; break; }
  }
  let vermieterProzent = 100 - mieterProzent;
  if (ausnahme === 'halb') vermieterProzent /= 2;   // §9: eine öffentlich-rechtliche Vorgabe
  if (ausnahme === 'voll') vermieterProzent = 0;    // §9: beide Vorgaben
  const vermieterAnteil = r2(kosten * vermieterProzent / 100);
  return { spezifisch, stufeMieterProzent: mieterProzent, vermieterProzent, vermieterAnteil, mieterAnteil: r2(kosten - vermieterAnteil) };
}

/** Warmwasser-Wärmemenge nach § 9 HeizkostenV. */
export function warmwasserQ({ methode, qKwh, volumenM3, temperatur, wohnflaeche, korrektur }) {
  let q;
  if (methode === 'gemessen') q = qKwh;
  else if (methode === 'formel') q = 2.5 * volumenM3 * ((temperatur ?? 60) - 10);
  else q = 32 * wohnflaeche; // Not-Fallback
  if (korrektur === 'brennwertgas') q *= 1.11;
  if (korrektur === 'waermelieferung') q /= 1.15;
  if (korrektur === 'waermepumpe') q *= 0.30;
  return q;
}

/**
 * Hauptfunktion: komplette Abrechnung.
 * Rückgabe: { proMietverhaeltnis: [...], gebaeude: {...}, warnungen: [...] }
 */
export function berechneAbrechnung(input) {
  const w = [];
  const { zeitraum, gebaeude, einheiten, mietverhaeltnisse, kalteKosten = [], heizung } = input;
  const zTage = tage(zeitraum.von, zeitraum.bis);
  const flaecheGesamt = gebaeude.wohnflaeche ?? einheiten.reduce((s, e) => s + e.flaeche, 0);
  const byId = Object.fromEntries(einheiten.map((e) => [e.id, e]));

  const mv = mietverhaeltnisse.map((m, i) => ({
    ...m,
    idx: i,
    von: d(m.von) > d(zeitraum.von) ? m.von : zeitraum.von,
    bis: !m.bis || d(m.bis) > d(zeitraum.bis) ? zeitraum.bis : m.bis,
  })).filter((m) => ueberlappungTage(m.von, m.bis, zeitraum.von, zeitraum.bis) > 0);

  const posten = mv.map(() => []); // {bezeichnung, gesamt, schluessel, anteilText, betrag}

  // ---------- Kalte Betriebskosten ----------
  for (const k of kalteKosten) {
    const schluessel = k.schluessel || 'flaeche';
    for (const m of mv) {
      const e = byId[m.einheit];
      const zeitFaktor = tage(m.von, m.bis) / zTage;
      let einheitenAnteil, anteilText;
      if (schluessel === 'flaeche') {
        einheitenAnteil = e.flaeche / flaecheGesamt;
        anteilText = `${e.flaeche} / ${flaecheGesamt} m²`;
      } else if (schluessel === 'einheiten') {
        einheitenAnteil = 1 / einheiten.length;
        anteilText = `1 / ${einheiten.length} Einheiten`;
      } else if (schluessel === 'personen') {
        const personentageGesamt = mietverhaeltnisse.reduce((s, x) => {
          const t = ueberlappungTage(x.von || zeitraum.von, x.bis || zeitraum.bis, zeitraum.von, zeitraum.bis);
          return s + (x.personen || 1) * t;
        }, 0);
        const eigene = (m.personen || 1) * tage(m.von, m.bis);
        posten[m.idx].push({ bezeichnung: k.art, gesamt: k.betrag, schluessel: 'Personentage', anteilText: `${eigene} / ${personentageGesamt}`, betrag: r2(k.betrag * eigene / personentageGesamt) });
        continue;
      } else if (schluessel === 'verbrauch') {
        const summe = Object.values(k.verbrauch || {}).reduce((s, v) => s + v, 0);
        const eigener = (k.verbrauch || {})[m.id ?? m.einheit + ':' + m.idx] ?? (k.verbrauch || {})[m.einheit] ?? 0;
        posten[m.idx].push({ bezeichnung: k.art, gesamt: k.betrag, schluessel: 'Verbrauch', anteilText: `${eigener} / ${summe}`, betrag: summe ? r2(k.betrag * eigener / summe) : 0 });
        continue;
      }
      posten[m.idx].push({ bezeichnung: k.art, gesamt: k.betrag, schluessel: schluessel === 'flaeche' ? 'Wohnfläche' : 'Einheiten', anteilText: anteilText + (zeitFaktor < 1 ? ` · ${tage(m.von, m.bis)}/${zTage} Tage` : ''), betrag: r2(k.betrag * einheitenAnteil * zeitFaktor) });
    }
  }

  // ---------- Heizung & Warmwasser ----------
  let gebaeudeInfo = { flaecheGesamt, zeitraum, zTage };
  if (heizung) {
    const va = heizung.verbrauchsanteil ?? 70;
    if (va < 50 || va > 70) w.push(`Verbrauchsanteil ${va} % liegt außerhalb 50–70 % (§ 7 HeizkostenV) — nur mit besonderer Vereinbarung zulässig.`);

    // CO2-Split (vor Verteilung, Gebäudeebene)
    const co2 = heizung.co2 ? co2Split({ kg: heizung.co2.kg, kosten: heizung.co2.kosten, wohnflaeche: flaecheGesamt, ausnahme: heizung.co2.ausnahme, zeitraumTage: zTage }) : null;
    let topf = heizung.kostenGesamt - (co2 ? co2.vermieterAnteil : 0);

    // WW-Abtrennung
    const qWW = heizung.warmwasser ? warmwasserQ({ ...heizung.warmwasser, wohnflaeche: flaecheGesamt }) : 0;
    const wwQuote = heizung.energieKwh ? qWW / heizung.energieKwh : 0;
    const wwTopf = r2(topf * wwQuote);
    const heizTopf = r2(topf - wwTopf);

    // Grund-/Verbrauchssplit
    const heizGrund = r2(heizTopf * (100 - va) / 100);
    const heizVerbrauch = r2(heizTopf - heizGrund);
    const wwGrund = r2(wwTopf * (100 - va) / 100);
    const wwVerbrauch = r2(wwTopf - wwGrund);

    // Verbräuche je Mietverhältnis auflösen (Zwischenablesung) und je Einheit summieren
    const mvKey = (m) => m.id ?? `${m.einheit}:${m.idx}`;
    const hvVon = (m) => (heizung.verbraeucheHeizung || {})[mvKey(m)] ?? (heizung.verbraeucheHeizung || {})[m.einheit] ?? 0;
    const wvVon = (m) => (heizung.verbraeucheWarmwasser || {})[mvKey(m)] ?? (heizung.verbraeucheWarmwasser || {})[m.einheit] ?? 0;
    const einheitHV = {}, einheitWV = {};
    for (const m of mv) {
      einheitHV[m.einheit] = (einheitHV[m.einheit] || 0) + hvVon(m);
      einheitWV[m.einheit] = (einheitWV[m.einheit] || 0) + wvVon(m);
    }
    // Einheiten ohne Mietverhältnis (Leerstand/Selbstnutzung) bleiben Teil des
    // Verteilungsmaßstabs: ihr Verbrauch steht unter der Einheiten-ID und ihr
    // Kostenanteil verbleibt beim Vermieter (wird niemandem in Rechnung gestellt).
    for (const e of einheiten) {
      if (einheitHV[e.id] === undefined) {
        einheitHV[e.id] = (heizung.verbraeucheHeizung || {})[e.id] ?? 0;
        einheitWV[e.id] = (heizung.verbraeucheWarmwasser || {})[e.id] ?? 0;
      }
    }
    const heizSumme = Object.values(einheitHV).reduce((s, v) => s + v, 0);
    const wwSumme = Object.values(einheitWV).reduce((s, v) => s + v, 0);

    // ZWEI-STUFEN-RECHNUNG: erst Einheiten-Block (gerundet), dann Aufteilung innerhalb der
    // Einheit (§ 9b) — hält Einheiten-Summen konsistent und entspricht der Abrechnungspraxis.
    const blockJeEinheit = {};
    for (const e of einheiten) {
      const flAnteil = e.flaeche / flaecheGesamt;
      blockJeEinheit[e.id] = {
        heizGrund: r2(heizGrund * flAnteil),
        heizVerbrauch: heizSumme ? r2(heizVerbrauch * (einheitHV[e.id] || 0) / heizSumme) : 0,
        wwGrund: r2(wwGrund * flAnteil),
        wwVerbrauch: wwSumme ? r2(wwVerbrauch * (einheitWV[e.id] || 0) / wwSumme) : 0,
      };
    }

    // Je Einheit in MV-Reihenfolge abrechnen; der LETZTE Nutzer erhält je Komponente den
    // Restbetrag des Einheiten-Blocks (kein Phantom-Cent, Einheiten-Summe exakt).
    for (const e of einheiten) {
      const teile = mv.filter((x) => x.einheit === e.id).sort((a, b) => d(a.von) - d(b.von));
      if (!teile.length) continue;
      const block = blockJeEinheit[e.id];
      const rest = { hg: block.heizGrund, hv: block.heizVerbrauch, wg: block.wwGrund, wv: block.wwVerbrauch };

      teile.forEach((m, ti) => {
        const letzter = ti === teile.length - 1;
        const teilzeit = tage(m.von, m.bis) < zTage;
        const grundMethode = m.grundkostenMethode || 'gtz'; // §9b: gtz | zeitanteil

        let gFaktor = 1;
        let gText = `${e.flaeche} / ${flaecheGesamt} m²`;
        if (teilzeit) {
          gFaktor = grundMethode === 'gtz' ? gtzAnteil(m.von, m.bis, zeitraum.von, zeitraum.bis) : tage(m.von, m.bis) / zTage;
          gText += grundMethode === 'gtz' ? ` · GTZ ${(gFaktor * 1000).toFixed(0)} ‰` : ` · ${tage(m.von, m.bis)}/${zTage} Tage`;
        }
        const hg = letzter ? r2(rest.hg) : r2(block.heizGrund * gFaktor);
        rest.hg = r2(rest.hg - hg);
        posten[m.idx].push({ bezeichnung: 'Heizung Grundkosten', gesamt: heizGrund, schluessel: 'Wohnfläche' + (teilzeit ? (grundMethode === 'gtz' ? '/Gradtagszahlen' : '/Zeitanteil') : ''), anteilText: gText, betrag: hg });

        const hvW = hvVon(m);
        const hvEinheit = einheitHV[e.id] || 0;
        const hv = letzter ? r2(rest.hv) : (hvEinheit ? r2(block.heizVerbrauch * hvW / hvEinheit) : 0);
        rest.hv = r2(rest.hv - hv);
        posten[m.idx].push({ bezeichnung: 'Heizung Verbrauchskosten', gesamt: heizVerbrauch, schluessel: 'Verbrauch (Erfassung)', anteilText: `${hvW} / ${heizSumme}`, betrag: hv });

        if (wwTopf > 0) {
          const wwGFaktor = teilzeit ? tage(m.von, m.bis) / zTage : 1;
          const wg = letzter ? r2(rest.wg) : r2(block.wwGrund * wwGFaktor);
          rest.wg = r2(rest.wg - wg);
          posten[m.idx].push({ bezeichnung: 'Warmwasser Grundkosten', gesamt: wwGrund, schluessel: 'Wohnfläche' + (teilzeit ? '/Zeitanteil' : ''), anteilText: `${e.flaeche} / ${flaecheGesamt} m²${teilzeit ? ` · ${tage(m.von, m.bis)}/${zTage} Tage` : ''}`, betrag: wg });
          const wvW = wvVon(m);
          const wvEinheit = einheitWV[e.id] || 0;
          const wv2 = letzter ? r2(rest.wv) : (wvEinheit ? r2(block.wwVerbrauch * wvW / wvEinheit) : 0);
          rest.wv = r2(rest.wv - wv2);
          posten[m.idx].push({ bezeichnung: 'Warmwasser Verbrauchskosten', gesamt: wwVerbrauch, schluessel: 'Verbrauch (m³)', anteilText: `${wvW} / ${wwSumme}`, betrag: wv2 });
        }
      });
    }

    gebaeudeInfo = {
      ...gebaeudeInfo,
      co2,
      heizung: { topfNachCO2: r2(topf), wwQuote: r2(wwQuote * 100), wwTopf, heizTopf, heizGrund, heizVerbrauch, wwGrund, wwVerbrauch, qWW: r2(qWW) },
    };
    if (co2 && co2.vermieterAnteil > 0) {
      w.push(`CO2-Ausweis Pflicht (§ 7 Abs. 3 CO2KostAufG): Einstufung ${co2.spezifisch} kg CO2/m²·a, Vermieteranteil ${co2.vermieterProzent} % = ${co2.vermieterAnteil.toFixed(2)} € — in der Abrechnung ausweisen, sonst 3 %-Kürzungsrecht.`);
    }
  }

  // ---------- Salden ----------
  const proMietverhaeltnis = mv.map((m) => {
    const liste = posten[m.idx];
    const summe = r2(liste.reduce((s, p) => s + p.betrag, 0));
    const voraus = m.vorauszahlungen || 0;
    return {
      mieter: m.mieter, einheit: m.einheit, von: m.von, bis: m.bis,
      posten: liste, summe, vorauszahlungen: r2(voraus),
      saldo: r2(summe - voraus), // >0 Nachzahlung, <0 Guthaben
    };
  });

  return { zeitraum, gebaeude: gebaeudeInfo, proMietverhaeltnis, warnungen: w };
}
