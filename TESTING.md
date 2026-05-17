# Manuelle Smoke-Test-Checkliste

Diese Liste wird **vor jedem Release** am gebauten `.dmg` / `.exe` durchgegangen, nicht im Dev-Modus. Jeder Punkt entspricht einer Aussage im `README.md`.

## Vorbereitung

- [ ] `npm test` ist gruen (alle Unit-Tests bestehen)
- [ ] `npm run build:web` ist erfolgreich
- [ ] `npm run build:mac` produziert `release/AIM Pruefungs-Manager-<VERSION>-mac-arm64.dmg`
- [ ] DMG geoeffnet, App in Programme gezogen
- [ ] App startet beim ersten Doppelklick (oder Rechtsklick → Oeffnen)
- [ ] Fenster oeffnet ohne Fehler in der nativen Konsole

## 1. Erste Schritte / Datensicherung

- [ ] App startet mit gefuellter Beispieldatenbank
- [ ] `JSON exportieren` lädt eine `.json` herunter
- [ ] `JSON laden` mit der eben exportierten Datei restauriert identische Daten
- [ ] `Excel exportieren` lädt eine `.xlsx` herunter
- [ ] `Excel importieren` mit der eben exportierten `.xlsx` restauriert identische Daten
- [ ] `Jetzt sichern` schreibt Backup ohne Fehler
- [ ] Excel-Export oeffnet sich korrekt in Numbers / Excel

## 2. Fragen Datenbank

- [ ] Neue Frage anlegen (alle Formate: Single Choice / Multiple Choice / Richtig-Falsch / Ja-Nein)
- [ ] Frage bearbeiten — Aenderung bleibt nach Reload
- [ ] Frage loeschen — Bestaetigung erscheint, danach weg
- [ ] Suche nach Stichwort filtert korrekt
- [ ] Filter nach Modul / Dozent funktioniert
- [ ] Sonderzeichen (ä ö ü ß é) werden korrekt angezeigt + gespeichert

## 3. Weiterbildungsgaenge

- [ ] Neuen Weiterbildungsgang anlegen
- [ ] 6 Semester sind sichtbar
- [ ] 4 Module pro Semester sind sichtbar
- [ ] Jahr, Dozent, Kursname pflegbar
- [ ] Wechsel zwischen normaler und kompakter Ansicht funktioniert
- [ ] Weiterbildungsgang loeschen — Bestaetigung + tatsaechliches Loeschen

## 4. Pruefung erstellen

- [ ] Weiterbildungsgang im Dropdown waehlbar
- [ ] Module pro Semester anwaehlbar
- [ ] Fragen werden automatisch korrekt zusammengestellt
- [ ] Fragen-Anzahl entspricht den Modulen
- [ ] Pruefungsname kann vergeben werden

## 5. Export & Download

- [ ] `Als TXT exportieren` produziert lesbare Textdatei
- [ ] `Als PDF drucken` oeffnet System-Druckdialog mit korrektem Layout
- [ ] `Pruefung speichern und neue starten` legt Pruefung in `Gespeicherte Pruefungen` ab
- [ ] Gespeicherte Pruefung kann wieder geoeffnet werden
- [ ] Geoeffnete gespeicherte Pruefung kann weiterbearbeitet werden

## 6. Hilfe & Anleitung

- [ ] Testportal-Handbuch ist sichtbar und durchblaetterbar
- [ ] AIM Pruefungs-Manager-Handbuch ist sichtbar und durchblaetterbar
- [ ] Eigenes Handbuch erstellen funktioniert
- [ ] Bilder einfuegen funktioniert
- [ ] Handbuch mit Bildern als ZIP exportieren funktioniert
- [ ] Handbuch-ZIP importieren funktioniert
- [ ] Annotations (Pfeile, Markierungen) auf Bildern funktionieren

## 7. Einstellungen

- [ ] Dark Mode-Umschalter wirkt sofort
- [ ] Dark-Modus bleibt nach Neustart aktiv
- [ ] Sidebar-Einklappen funktioniert + bleibt nach Neustart
- [ ] Semester-Ansicht: Skalierungsstufen 100/85/70/55 % funktionieren

## 8. Persistenz / Datenverlust-Schutz

- [ ] Daten ueberleben App-Neustart (alle Listen wie vorher)
- [ ] Daten ueberleben System-Reboot
- [ ] **Daten ueberleben App-Update** (im Update-Test unten verifiziert)
- [ ] localStorage liegt in `~/Library/Application Support/AIM Pruefungs-Manager/` (Mac) bzw. `%APPDATA%\AIM Pruefungs-Manager\` (Windows)

## 9. Auto-Update

- [ ] App-Menue → "Ueber AIM Pruefungs-Manager" zeigt korrekte Version
- [ ] App-Menue → "Nach Updates suchen…" reagiert (entweder "keine Aktualisierung" oder Banner)
- [ ] Beim Start: nach ~3 s wird stillschweigend nach Updates gesucht (siehe Log)
- [ ] **Update-Banner-Test:** Mit `dev-app-update.yml` lokal einen Update simulieren — Banner muss erscheinen, Download laufen, "Jetzt aktualisieren" muss App schliessen + neu starten
- [ ] Nach Update sind alle alten Daten noch vorhanden
- [ ] "Spaeter" Button verbirgt Banner; bleibt fuer diese Version verborgen

## 10. Offline-Verhalten

- [ ] WLAN ausgeschaltet → App startet trotzdem normal
- [ ] WLAN ausgeschaltet → Schriften (Source Sans 3, Libre Baskerville) sind sichtbar (NICHT Fallback wie Arial)
- [ ] WLAN ausgeschaltet → alle Funktionen ausser Update-Pruefung arbeiten normal

## 11. Sicherheit

- [ ] DevTools sind im Production-Build nicht zugaenglich (Cmd+Opt+I muss nichts tun)
- [ ] Externe Links (z. B. aus Hilfe) oeffnen sich im System-Browser, nicht im App-Fenster
- [ ] Browser-Konsole zeigt keine CSP-Verletzungen

## 12. Multi-Instanz

- [ ] Bei laufender App: zweiter Doppelklick auf das App-Icon fokussiert nur das bestehende Fenster, oeffnet kein zweites
- [ ] Auf Mac: Cmd+W schliesst Fenster aber App laeuft weiter (Mac-Standard)
- [ ] Auf Windows: Schliessen beendet die App komplett

## 13. Native Menues

- [ ] Mac: App-Menue mit Namen "AIM Pruefungs-Manager"
- [ ] Mac: "AIM Pruefungs-Manager ausblenden" / "Beenden" funktionieren
- [ ] Datei / Bearbeiten / Ansicht / Fenster / Hilfe alle auf Deutsch
- [ ] "Vergroessern" / "Verkleinern" via Menue funktioniert
- [ ] "Vollbild" funktioniert

## Release-Freigabe

- [ ] ✅ Alle Punkte oben sind gehaktert ODER ein dokumentierter Grund fuer Abweichung steht in den Release Notes
- [ ] CHANGELOG / Release Notes geschrieben (auf Deutsch)
- [ ] Version in `package.json` ist die neue Release-Version
- [ ] Tag entspricht der Version (`v1.2.3`)

---

**Wie Auto-Update lokal testen** (vor Tag-Push):

1. Server in einem temporaeren Verzeichnis mit dem Inhalt einer alten + neuen Version (`latest-mac.yml`, DMG-blockmap) starten
2. `dev-app-update.yml` neben `electron/` ablegen:
   ```yaml
   provider: generic
   url: http://localhost:8000
   ```
3. App im Dev-Modus starten — der Updater spricht den lokalen Server an
4. Banner muss erscheinen, Download laufen, Install ausloesen
