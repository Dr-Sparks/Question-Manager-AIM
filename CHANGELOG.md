# Änderungsprotokoll / Changelog

Alle bedeutsamen Änderungen am AIM Prüfungs-Manager werden hier dokumentiert.
Format folgt grob [Keep a Changelog](https://keepachangelog.com/de/1.1.0/);
Versionsschema folgt [SemVer](https://semver.org/lang/de/).

## [1.0.6] — 2026-05-17

### Hinzugefügt
- **ErrorBoundary**: Renderfehler erzeugen nicht mehr den weißen Bildschirm,
  sondern eine deutsche Wiederherstellungsseite mit „💾 Notfall-Sicherung
  herunterladen"-Button. Komplette `aim_*`-localStorage-Inhalte werden in
  eine JSON-Datei dumped, bevor neu geladen wird.
- **Automatische Sicherung vor zerstörerischen Operationen**: Vor jedem
  „Alle Daten löschen", JSON-Restore oder Excel-Import wird der aktuelle
  Stand automatisch in `aim_last_backup` gesichert. Dashboard zeigt ein
  grünes Panel „↺ Letzten Stand wiederherstellen" mit Zeitstempel + Inhalt.
- **Speicher-Indikator** im Sidebar-Fuß: „Gespeichert ✓ HH:MM" blinkt kurz
  nach jedem erfolgreichen Persist, danach dezent „Letzte Sicherung HH:MM".
- **Fenster-Position + -Größe** werden zwischen App-Starts gespeichert
  (`userData/window-state.json`), inklusive Maximized- und Fullscreen-Status.
  Geometrie wird gegen verfügbare Displays validiert (kein Off-Screen-Start).
- `LICENSE`, `CHANGELOG.md` und `dependabot.yml` im Repo.

### Behoben
- „Zum Export ↓"-Button im ExamBuilder verwendet jetzt `setView('export')`
  direkt statt `document.querySelector('[data-nav=export]').click()`.
- Kleinere Codequalitäts-Verbesserungen (kompakte Ternär-Ausdrücke,
  veraltete Kommentare).
- `TESTING.md` referenziert jetzt den aktuellen versionsfreien DMG-Dateinamen.

## [1.0.5] — 2026-05-17

### Sicherheit
- XSS-Schutz in `printAsPdf`, `renderHelpImageHtml` und `printHelpManualPdf`:
  alle Benutzereingaben werden vor HTML-Interpolation escaped.
- `<img src>` in Handbuch-Bildern wird auf `data:image/`, `https?:`, `file:`
  oder relative URLs eingeschränkt.

### Behoben
- `localStorage`-Speichereffekte mit `try/catch` + Toast bei Quota-Fehler
  (verhindert White-Screen bei vollem Speicher).
- Bestätigung vor Excel-Import, JSON-Restore und einzelnen Frage-Entfernung.
- `GridInput` aus `SemesterMatrix` herausgezogen — Tastatureingaben in
  Semestertabellen verlieren nicht mehr den Fokus.
- `showConfirm`-Signatur vereinheitlicht (Objekt-Form überall).
- ID-Generator vereinheitlicht auf `crypto.randomUUID()` (vorher mischte
  drei Schemata, eines davon mit Float-Präzisionsverlust in Map-Keys).
- `clearAllData` löscht jetzt wirklich alles (inkl. Hilfe-Inhalte +
  Galerien). Einstellungen (Dark Mode, Sidebar) bleiben erhalten.
- JSON-Backup enthält jetzt Hilfe-Inhalte + alle Galerie-Bilder.
- `getSemesterState` mit `Number.isFinite`-Schutz bei ungültigem Startjahr.
- Modal: `aria-modal`, `Escape` schliesst, Fokus auf Cancel beim Öffnen
  und zurück zum vorherigen Element beim Schliessen.
- `:focus-visible`-Umrandung auf allen interaktiven Elementen.
- First-Mount-Race: Bei fehlendem Init-Flag wird `aim_exam` nicht mehr
  überschrieben.

### Verändert
- Toast-Anzeigedauer skaliert mit Textlänge (4–15 s).
- Print-Fenster nutzen jetzt System-Fonts statt Google-Fonts-CDN
  (offline-tauglich).
- WASD-Annotations-Listener wird nicht mehr bei jedem Tastenanschlag
  re-registriert.
- `Btn` standardmäßig `type="button"`, neuer `autoFocus`-Prop.
- „Speichern & neu" in ExportView nutzt Inline-Modal statt `window.prompt`.
- HelpPage warnt vor Navigation bei ungespeicherten Änderungen.
- Excel-Sheet-Name-Fallbacks für Round-Trips durch Numbers/LibreOffice.
- Excel-Import zeigt jetzt „N neu, M aktualisiert" statt nur „N
  übernommen".

### Entfernt
- Toter DOCX-Code (`dlDocx`, irreführender Hinweis).
- Toter `ImageSlot.updateSelectedAnno`-Code.

### Tooling
- GitHub Actions: `actions/checkout@v5`, `setup-node@v5`,
  `upload-artifact@v5`, Node 22 (silences Node-20-Deprecations).

## [1.0.4] — 2026-05-17

- Internal test release for auto-update flow validation.

## [1.0.3] — 2026-05-17

- **Mac**: Auto-Update wechselt auf „Browser-Download"-Modus —
  Squirrel.Mac kann ohne Apple Developer ID keine In-Place-Updates
  durchführen. Banner öffnet jetzt die DMG-URL im System-Browser; Nutzer
  installiert manuell.
- **Windows**: In-Place-Auto-Update via NSIS funktioniert weiterhin.
- `MAC_IN_PLACE_UPDATE`-Flag in `electron/updater.cjs` — bei Apple
  Developer ID auf `true` schalten.

## [1.0.2] — 2026-05-17

- Ad-hoc-Codesigning der Mac-App via `afterPack`-Hook (erfüllte erste
  Squirrel-Validierung, scheiterte aber an Cross-Version-Identitätsprüfung).

## [1.0.1] — 2026-05-17

- Stabile Download-URLs ohne Versionsnummer im Dateinamen.
- README mit Download-Tabelle für Mac + Windows.
- `package.json` `artifactName` ohne `${version}`.

## [1.0.0] — 2026-05-17

- Erste öffentliche Version.
- React 18 + Vite 5 + Electron 41, bundled als DMG (Mac arm64) und
  NSIS (Windows x64).
- electron-updater mit GitHub-Releases-Backend.
- Hardened Electron Shell (Sandbox, CSP, Single-Instance, deutsche
  Native-Menüs).
- Source Sans 3 + Libre Baskerville offline gebündelt.
- Auto-Update-Banner (deutsche Texte).
- Generiertes AIM-Platzhalter-Icon.
- GitHub Actions CI: Tests auf jedem Push, Releases auf `v*.*.*`-Tags.
- 20 Unit-Tests + Manuelle Smoke-Test-Checkliste in `TESTING.md`.
