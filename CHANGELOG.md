# Änderungsprotokoll / Changelog

Alle bedeutsamen Änderungen am AIM Prüfungs-Manager werden hier dokumentiert.
Format folgt grob [Keep a Changelog](https://keepachangelog.com/de/1.1.0/);
Versionsschema folgt [SemVer](https://semver.org/lang/de/).

## [1.0.19] — 2026-06-05

### Geändert
- **Beispieldaten erneuert.** Die mitgelieferten Beispiel-Fragen und
  -Weiterbildungsgänge wurden durch einen sauberen, realistischen Beispiel-
  Datensatz ersetzt:
  - **16 Beispiel-Fragen** aus dem AIM-Fragenkatalog in **4 Kursen**
    (Psychoonkologie, Psychosomatische Erkrankungen, Schwierige
    Therapiesituationen, Einführung in die Schematherapie) — mit Single-Choice-,
    Multiple-Choice- und Richtig/Falsch-Fragen samt korrekt markierten Antworten.
  - **3 realistische Weiterbildungsgänge** über alle 6 Semester. Alle Kurse sind
    den Weiterbildungsgängen zugeordnet, sodass sich sofort eine Beispiel-Prüfung
    erstellen, exportieren und ins Testportal laden lässt.

## [1.0.18] — 2026-06-05

### Hinzugefügt
- **Testportal-Videos in der Anleitung.** Der Testportal-Bereich zeigt jetzt für
  jeden Schritt ein kurzes, in Schleife laufendes Video (18 Clips, inkl. der
  Unterbereiche der Test-Konfiguration und der Auswertung).
- **Video-Geschwindigkeit 1× / 1.5× / 2×** (Standard **2×**, wird gemerkt) — gilt
  für alle Videos gleichzeitig.
- **Neuer Reiter „Dokument“** in der Anleitung: die komplette Anleitung (AIM
  Prüfungs-Manager **und** Testportal) als sauberes, lesbares Dokument mit
  Titel, Inhaltsverzeichnis und anklickbaren Sprungmarken — auch ohne Videos
  verständlich.
- **„Als Word (.docx) herunterladen“** erzeugt aus genau diesem Inhalt ein
  einzelnes Word-Dokument mit **Titelseite + Inhaltsverzeichnis + beiden Teilen**
  (für eine Papier-/PDF-Fassung). Nutzt die vorhandene .docx-Engine, keine
  zusätzliche Abhängigkeit.

### Geändert
- Die Testportal-Schritttexte wurden anhand der echten Videos **ausführlich und
  eigenständig** neu geschrieben (mit Fettungen der wichtigsten Begriffe), u. a.
  mit dem Hinweis, dass importierte Fragen zunächst die Kategorie „Generic“
  haben und die Kategorien (Kursnamen) im **Questions manager** von Hand gesetzt
  werden müssen — wichtig für saubere **Test sets**.

### Behoben
- **Dunkelmodus überarbeitet.** Im Dunkelmodus erschienen Seitenleiste,
  Tabellen-Kopfzeilen, die Export-Vorschau und einzelne Schaltflächen/Reiter
  fälschlich hell (mit unlesbarem Text). Diese Flächen nutzen jetzt eine eigene
  dunkle Farbe und bleiben in beiden Designs korrekt. Auch die hellen
  „Kachel“-Farben (Kurse-Statistik, Start-Semester, Hinweis-Boxen) passen sich
  nun dem Dunkelmodus an.

### Texte / Verständlichkeit
- UI-Texte vereinfacht und entwickler-/„web“-lastige Formulierungen entfernt:
  „im Browser gespeichert“ → „auf diesem Computer gespeichert“; die frühere
  „Sitzung“-Karte (lokaler Server / Terminal / Ctrl+C) → klare „App schliessen“-
  Erklärung; „Auf dieser Seite …“ → „Hier …“.
- Einheitliche deutsche Begriffe und Umlaute: „✕ Reset“ → „✕ Zurücksetzen“,
  „+ Neuer WBG“ → „+ Neuer Weiterbildungsgang“, „Programme“ →
  „Weiterbildungsgänge“; fehlende Umlaute im Update-Banner und Fehler-Bildschirm
  korrigiert („verfügbar“, „Später“, „enthält“).
- Veralteter Export-Hinweis („PDF-Datei“) auf die Word-Datei (.docx) korrigiert.

### Technisch
- Anleitungs-Videos werden als MP4 über `import.meta.glob` gebündelt (1280 px /
  24 fps / H.264, ~13 MB für alle 18 Clips). Drop-in-Ordner
  `src/anleitung-media/testportal/` (Dateinamen siehe README dort).
- `.docx`-Primitive (`docxEsc`, `DOCX_CONTENT_TYPES`, `DOCX_RELS`, `zipStore`)
  aus `AIMExamManager.jsx` exportiert und für die Anleitung wiederverwendet.

## [1.0.17] — 2026-06-05

### Geändert
- **Export für Testportal jetzt als Word-Datei (.docx) statt PDF.** Der Button
  „↓ Als PDF speichern" heißt nun „↓ Word (.docx)" und lädt die Prüfung direkt
  als Word-Datei herunter (kein Druck-Dialog mehr).

### Behoben
- **Testportal erkennt die korrekten Antworten beim Import jetzt zuverlässig.**
  Ursache: In einer PDF ist „fett" nur eine Schriftart-Auswahl; bei der
  Text-Extraktion durch Testportal ging diese Information verloren, sodass
  keine richtige Antwort markiert wurde. Eine .docx speichert den Fettdruck als
  explizite `<w:b/>`-Eigenschaft, die Testportal direkt ausliest — genau wie in
  der offiziellen Testportal-Importvorlage. Nur die korrekte Antwortzeile ist
  fett (inkl. Buchstaben-Präfix); Kurstitel, Frage und falsche Antworten bleiben
  normal, damit keine falsche Antwort markiert wird.

### Technisch
- Die .docx wird ohne zusätzliche Abhängigkeit erzeugt (handgeschriebener
  STORE-Zip aus OOXML-Teilen). `printAsPdf`/`escapeHtml` und der zugehörige
  `window.open`-Druckfenster-Pfad entfielen; der Electron-`setWindowOpenHandler`
  verweigert nun konsequent alle Kind-Fenster (nur externe Links öffnen im
  System-Browser).

## [1.0.16] — 2026-06-05

### Geändert
- **Neue Seite „Anleitung"** ersetzt die bisherigen Seiten „Hilfe & Anleitung"
  und „Über die App" und bündelt beide Anleitungen an einem Ort:
  - **AIM Prüfungs-Manager** — die geführte Tour durch die echte App
    (animierter Cursor + Erklärungen, wie bisher unter „Über die App").
  - **Testportal** — eine neue, nicht-technische Schritt-für-Schritt-Anleitung
    (Anmelden → Startseite → Fragen importieren → Test konfigurieren →
    aktivieren & durchführen → beendeten Test erneut starten) mit kurzen,
    in Schleife laufenden Videos.

### Hinzugefügt
- Drop-in-Ordner `src/anleitung-media/testportal/` für die Testportal-Videos
  (MP4/WebM). Fehlt ein Video, zeigt die Anleitung automatisch einen
  „Video folgt"-Platzhalter. Dateinamen siehe `README.md` im Ordner.

### Entfernt
- Das editierbare Handbuch-System („Hilfe & Anleitung") inkl. Bild-Galerien,
  Annotations-Editor und Handbuch-ZIP-Import/-Export.
- Entwickler-Hilfsordner `handbook-build/` (Screenshot-Pipeline).

### Technisch
- `media-src 'self' blob:` zur Content-Security-Policy hinzugefügt, damit die
  Loop-Videos in der gepackten App laden.
- JSON-Backups enthalten keine Handbuch-/Galerie-Inhalte mehr; das
  Wiederherstellen älterer Backups ignoriert diese Felder verträglich.

## [1.0.15] — 2026-05-18

### Hinzugefügt
- **Verlässlicher Excel-Roundtrip** (Export → in Excel bearbeiten →
  re-importieren). Die exportierte `.xlsx` enthält jetzt sechs Sheets:
  - **README** mit den Spielregeln (deutsch) zum Bearbeiten und Re-Import.
  - **Fragen** — mit einer **ID-Spalte ganz vorne**. ID ist der Schlüssel
    für den Re-Import: vorhandene ID = Eintrag wird aktualisiert, leere
    ID in einer neuen Zeile = neuer Eintrag bekommt beim Import eine ID.
  - **Kurs Übersicht** — eine Zeile pro Kurs, eine Spalte pro
    Weiterbildungsgang („WBG: …"). `x` = Kurs ist für diesen WBG
    getaggt. Beim Re-Import wird die Tag-Zuordnung übernommen.
  - **Weiterbildungsgänge** — Metadaten (ID, Name, Startjahr,
    Startsemester) für stabilen ID-Roundtrip.
  - **Semesteransicht** — die bekannte 6 × 4-Matrix.
  - **Gespeicherte Prüfungen** — wie bisher.
- **Vorschau-Dialog vor jedem Excel-Import**. Statt die DB direkt zu
  überschreiben, zeigt der Import nun eine Vorschau mit pro Kategorie
  *Neu / Aktualisiert / Unverändert* sowie eine Konfliktliste (z.B.
  Frage ohne Kurs oder Frage-Text). Erst nach Klick auf „Anwenden"
  werden Daten gemerged.
- Frozen Header und Auto-Filter in der Fragen- und Kurs-Übersicht-
  Tabelle für angenehmeres Editieren in Excel/Numbers.

### Verändert
- **Excel-Import löscht NICHTS mehr.** Frühere Versionen ersetzten die
  bestehende Datenbank vollständig durch den Inhalt der Excel-Datei.
  Ab v1.0.15 ist der Import ein **Merge per ID** — Zeilen, die in der
  Excel fehlen, bleiben in der App erhalten. Wer Einträge löschen will,
  macht das weiterhin direkt in der App.
- Vor jedem Import wird automatisch ein Snapshot des aktuellen Stands
  in `aim_last_backup` geschrieben — „↺ Letzten Stand wiederherstellen"
  auf dem Dashboard macht den Import damit jederzeit rückgängig.

### Intern
- Neue reine Funktion `computeExcelImportDiff(parsed, current)` in
  `AIMExamManager.helpers.js` mit 10 zusätzlichen Unit-Tests (53 total).
- Neue Pipeline-Funktionen im Monolithen: `parseExcelImport(buffer)`,
  `computeExcelImportDiff(parsed, current)`, `applyExcelImport(diff, …)`
  ersetzen das alte `importExcel(file, …)`.
- Neue UI-Komponente `ExcelImportPreviewModal`.

## [1.0.14] — 2026-05-18

### Hinzugefügt
- **Auto-Füllen-Button** je Weiterbildungsgang in der Semestermatrix.
  Verteilt die für diesen Weiterbildungsgang getaggten Kurse auf die
  6 × 4 Module — anhand des Erstellungsjahres jedes Kurses (häufigster
  Wert aus den vorhandenen Fragen) und der HS/FS-Startsemester-Logik.
- Konservatives Verhalten: **bereits gefüllte Module werden nie
  überschrieben** — nur leere Slots werden gefüllt. Bestätigungsdialog
  zeigt vorab eine Statistik (X eingefügt, Y bereits vorhanden, Z
  passte nicht) und einen klaren Hinweis, dass die Verteilung nur eine
  Annahme ist und nachgeprüft werden sollte.
- Neue Hilfsfunktionen `semesterCalendarFor(program)` und
  `autofillModulesForProgram(program, courseTags, questions)` in
  `AIMExamManager.helpers.js` mit 10 zusätzlichen Unit-Tests (43 total).

## [1.0.13] — 2026-05-18

### Hinzugefügt
- **Kurs Übersicht** als neue Sidebar-Seite zwischen „Fragen Datenbank" und
  „Weiterbildungsgänge". Listet alle Kurse in der Datenbank mit Dozent/in,
  Jahr, Fragen-Anzahl und den zugeordneten Weiterbildungsgängen.
- **Explizite Weiterbildungsgang-Tags pro Kurs**: Auf der Kurs Übersicht
  und im Frage-Bearbeiten-Formular wird per Häkchen gewählt, zu welchen
  Weiterbildungsgängen ein Kurs gehört. Ein Tag-Eintrag gilt für alle
  Fragen dieses Kurses gleichzeitig. Ersetzt das bisherige implizite
  Matching über Kurs+Dozent+Jahr gegen WBG-Module.
- Neue Hilfsfunktion `migrateCourseTagsFromMatrix` mit drei zusätzlichen
  Unit-Tests (33 total).

### Verändert
- **Erst-Start-Migration**: Beim ersten Laden von v1.0.13 werden die Tags
  automatisch aus der bisherigen impliziten Beziehung berechnet (Kurs in
  WBG-Modul) und gespeichert. Danach sind Tags explizit editierbar.
- **„Weiterbildungsgang"-Filter** in der Fragen Datenbank verwendet jetzt
  die expliziten Tags. Die Spalte „Weiterbildungsgänge" zeigt die
  Mitgliedschaften aus der Tag-Map.
- **CourseAutocomplete** in der Weiterbildungsgänge-Matrix schlägt nur
  noch Kurse vor, die für das jeweilige Programm getaggt sind. Freitext
  bleibt erlaubt.
- **PDF-Export**: Frage-Text ist nicht mehr halbfett (`font-weight:600`)
  sondern normal. **Nur die korrekte Antwort** ist fett — damit Testportal
  beim Import die richtige Antwort eindeutig erkennen kann.
- **Backup-Format Version 4**: enthält `courseTags`. Ältere Backups (v3
  und früher) werden beim Wiederherstellen automatisch migriert.
- **„Alle Daten löschen"** entfernt jetzt auch `aim_course_tags`.

### Technisch
- Neue Named-Exports `KursUebersicht`, `migrateCourseTagsFromMatrix`.
- `programsForQuestion(question, programs, courseTags)` — Signatur um
  drittes Argument erweitert.

## [1.0.12] — 2026-05-18

### Verändert
- „Über die App"-Tour zeigt jetzt für **jede App-Seite** den echten,
  vollständigen Bildschirm — gerendert aus den realen Komponenten
  (`Dashboard`, `QuestionDB`, `Programs`, `ExamBuilder`, `ExportView`,
  `SettingsPage`), eingebettet im Tour-Card mit `pointer-events: none`
  und auf passende Größe skaliert. Kein Mockup, kein Screenshot — der
  Benutzer sieht im Tour exakt das, was er auf der echten Seite sehen
  wird.
- Über jedem Bildschirm wandert ein animierter Cursor mit Sprechblasen,
  der nacheinander jede wichtige Stelle erklärt. Sprechblasen wechseln
  alle ~4 Sekunden und loopen automatisch.
- Sechs Sektionen statt der bisherigen fünf — eine pro Hauptseite der
  App: Dashboard, Fragen Datenbank, Weiterbildungsgänge, Prüfung
  erstellen, Export & Download, Einstellungen.

### Technisch
- Neue Named-Exports für `Dashboard`, `QuestionDB`, `Programs`,
  `ExamBuilder`, `ExportView`, `SettingsPage` in AIMExamManager.jsx
  (keine Verhaltensänderung, nur `export`-Keywords).
- AboutPage.jsx hat einen `PageStage`-Wrapper, der die Seite mit
  `transform: scale(…)` skaliert und einen Overlay für Cursor und
  Sprechblasen bietet. Klicks sind deaktiviert, damit der Tour-Modus
  niemals echte Aktionen auslöst.
- Deterministische Mock-Daten (6 Fragen, 2 Weiterbildungsgänge, 1
  laufende Prüfung, 1 gespeicherte Prüfung) füllen die gerenderten
  Seiten.

## [1.0.11] — 2026-05-18

### Verändert
- „Über die App"-Tour-Szenen verwenden jetzt die **echten UI-Komponenten**
  aus dem Monolith. `Btn`, `Badge`, `Field`, der Eingabe-Stil `inp`, die
  Semestermatrix-Tokens (`gridCell`, `gridSubHead`, `gridSemesterHead`,
  `gridStickyName`, …) sowie Konstanten (`FORMATS`, `SEMESTER_COUNT`,
  `abbreviateCourseName`) werden nun von `AIMExamManager.jsx` exportiert
  und in `AboutPage.jsx` wiederverwendet. Die Mini-Mockups sind dadurch
  **pixelgenau identisch** zu den realen Screens — kein Drift mehr zwischen
  Tour und echtem App-UI.
- Animationen (Cursor, getipptes Zeichen-für-Zeichen, Toast-Slide-in,
  Datei-fly-down) bleiben gleich. Sie steuern jetzt die echten Komponenten
  per kontrolliertem State („Marionetten-Strings" am echten UI) statt
  hand-gemalter Annäherungen.

### Technisch
- Neue Named-Exports in `AIMExamManager.jsx` (keine Verhaltensänderung,
  nur `export`-Keywords).
- Zirkuläre Imports sind ESM-sicher, weil `AboutPage` die Imports nur
  innerhalb von Funktions-Rümpfen verwendet (Render-Time), nicht beim
  Modul-Laden.

## [1.0.10] — 2026-05-18

### Hinzugefügt
- **Neue Seite „Über die App"** im Sidebar zwischen Hilfe & Anleitung und
  Einstellungen. Onboarding für nicht-technische Nutzer:innen mit:
  - Willkommens-Hero und kurzer Erklärung
  - **5 animierte Tour-Szenen** — Live-Mini-Mockups der App-UI, die durch
    die wichtigsten Abläufe führen:
    1. Frage hinzufügen (Formular wird ausgefüllt, Toast erscheint)
    2. Weiterbildungsgang einrichten (Semestermatrix wird gefüllt)
    3. Prüfung erstellen (Programm → Module → Zähler)
    4. Als PDF speichern (Toolbar-Klick → PDF-Datei)
    5. Datensicherung (JSON-Export)
  - **„Erste Schritte"-Checkliste** mit 5 Aufgaben, Fortschritt wird in
    `aim_about_checklist_v1` gespeichert
  - **Über-Info-Block** mit Version, Datenort, Update-Hinweis und © AIM
- Animationen sind reine CSS-Keyframes + React-State-Maschinen (kein Video,
  keine schweren Assets). `prefers-reduced-motion` pausiert alle
  Animationen für Nutzer:innen mit entsprechender Systemeinstellung.

### Technisch
- Neue Datei `src/AboutPage.jsx` (~700 Zeilen, in sich abgeschlossen).
- Vom Monolith via Import + Route eingebunden, eine Sidebar-Zeile + ein
  `view==='about'`-Eintrag.
- Mock-UI-Primitive (`MockButton`, `MockInput`, `MockBadge`, `MockToast`,
  `MockCursor`, `MockStage`) wiederverwendbar pro Szene.
- `useLoop(steps, interval)` Hook treibt jede Szene; säubert sich beim
  Unmount automatisch.

## [1.0.9] — 2026-05-17

### Hinzugefügt
- **Weiterbildungsgang-Filter in der Fragen Datenbank**: Neues Dropdown
  „Alle Weiterbildungsgänge" zwischen „Alle Dozenten" und „Alle Formate".
  Bei Auswahl werden nur Fragen angezeigt, die zu mindestens einem Modul
  des gewählten Weiterbildungsgangs passen.
- **Neue Spalte „Weiterbildungsgänge"** in der Fragen-Tabelle zwischen
  Dozent/in und Format. Zeigt für jede Frage die zugeordneten Weiterbildungs-
  gänge als kleine graue Badges (gekürzte Namen ohne Klammerzusatz).
- **Live-Anzeige im Frage-Bearbeiten-Formular**: Unter den Kursfeldern
  steht „Erscheint in: …" — aktualisiert sich live während des Tippens,
  zeigt sofort, welche Weiterbildungsgänge die Frage erfassen wird.

### Technisch
- Beziehung Frage ↔ Weiterbildungsgang ist **berechnet** (nicht gespeichert).
  Selbst-aktualisierend bei jeder Kurs-/Dozent-Änderung, kein Migration-
  Risiko, kein Datendrift. Backups (JSON/Excel) bleiben formatkompatibel.
- Matching-Regel identisch zur „Prüfung erstellen"-Logik: gleicher Kurs,
  Dozent matched falls beide gesetzt, Jahr matched falls beide gesetzt.
  Beide Views sind by construction konsistent.
- Neue Helper `programsForQuestion` + `shortProgramName` in
  `AIMExamManager.helpers.js` mit 11 zusätzlichen Unit-Tests (31 total).

## [1.0.8] — 2026-05-17

### Behoben
- Druck-Fenster schliesst sich automatisch, sobald der System-Druck-Dialog
  abgeschlossen wurde — keine Fenster-Leichen mehr im Dock.
- `window-state.json` wird beim App-Beenden synchron geschrieben statt mit
  400 ms Debounce. Verhindert, dass die letzte Resize-Änderung vor dem
  Quit verloren geht.
- Automatische Sicherung (`aim_last_backup`) warnt jetzt mit einem Toast,
  wenn der Snapshot wegen vollem Speicher nicht erstellt werden konnte.
- ErrorBoundary „✓ Sicherung heruntergeladen"-Status wird nach 3 s
  zurückgesetzt — zweiter Klick zeigt wieder das ursprüngliche Label.
- Speicher-Indikator zeigt zusätzlich das Datum, wenn die letzte Sicherung
  nicht am selben Tag erfolgte (verhindert irreführende „14:23" wenn die
  App über Mitternacht offen war).

### Verändert
- „↓ PDF drucken" heisst jetzt „↓ Als PDF speichern" — entspricht besser
  dem tatsächlichen Endergebnis (System-Druckdialog mit „Als PDF
  sichern"-Option). Format der gedruckten PDF ist unverändert
  (Testportal-kompatibel).
- „Über AIM Prüfungs-Manager" zeigt jetzt die Release-Notes der aktuellen
  Version, gelesen aus der gebündelten `CHANGELOG.md`.

### Tooling
- `CHANGELOG.md` wird über `extraResources` ins Release-Bundle eingebettet.

## [1.0.7] — 2026-05-17

### Behoben
- „↓ PDF drucken" / „↓ Handbuch als PDF" erzeugten keine PDF-Datei mehr.
  Der Electron-WindowOpenHandler in `electron/main.cjs` hat das benötigte
  `about:blank`-Fenster blockiert — `window.open` gab `null` zurück und
  beide Print-Funktionen verliessen still die Funktion. Handler erlaubt
  jetzt blanke URLs (nur für den Druck-Flow). Beide Print-Funktionen
  geben einen Boolean zurück, der UI-Button zeigt einen Fehler-Toast,
  falls das Fenster nicht geöffnet werden konnte.

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
