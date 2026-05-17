# AIM Prüfungs-Manager

Der AIM Prüfungs-Manager hilft dabei, Fragen zu verwalten, Weiterbildungsgänge pro Semester abzubilden, Prüfungen zusammenzustellen, Prüfungen zu speichern und Backups zu importieren oder zu exportieren.

## Installation

Die fertige App ist auf der Releases-Seite erhältlich:

👉 [github.com/Dr-Sparks/Question-Manager-AIM/releases/latest](https://github.com/Dr-Sparks/Question-Manager-AIM/releases/latest)

### Mac (Apple Silicon — M1, M2, M3, M4)

1. `AIM Pruefungs-Manager-<Version>-mac-arm64.dmg` herunterladen
2. Doppelklick auf die heruntergeladene Datei
3. Im sich öffnenden Fenster das App-Symbol auf den `Applications`-Ordner ziehen
4. App im Programme-Ordner öffnen

**Hinweis beim ersten Start:**
Da die App noch nicht von Apple signiert ist, zeigt macOS beim ersten Öffnen eine Warnung. Stattdessen so vorgehen:

1. Rechtsklick (oder Ctrl-Klick) auf das App-Symbol
2. `Öffnen` wählen
3. Im Dialog erneut `Öffnen` klicken

Das ist nur beim allerersten Start nötig. Danach öffnet sich die App per Doppelklick wie jede andere.

### Windows

1. `AIM Pruefungs-Manager-<Version>-win-x64.exe` herunterladen
2. Doppelklick auf die heruntergeladene Datei
3. Falls Windows Defender SmartScreen warnt: `Weitere Informationen` → `Trotzdem ausführen`
4. Installationsassistenten durchklicken
5. App wird ins Startmenü eingetragen

## Automatische Updates

Die App prüft bei jedem Start im Hintergrund, ob eine neue Version verfügbar ist. Falls ja, erscheint oben im Fenster ein grüner Banner:

> ✓ **Version X.Y.Z** ist bereit zur Installation. `[Später]` `[Jetzt aktualisieren]`

- `Jetzt aktualisieren` schliesst die App, installiert die neue Version und startet sie automatisch wieder
- `Später` blendet den Banner für diese Version aus
- Manuelle Prüfung jederzeit möglich über `AIM Prüfungs-Manager` → `Nach Updates suchen…` (Mac) bzw. `Hilfe` → `Nach Updates suchen…` (Windows)

Die App-Daten (Fragen, Weiterbildungsgänge, gespeicherte Prüfungen, Einstellungen) bleiben bei Updates erhalten.

## Was die App macht

### Fragen Datenbank
- Alle Fragen an einem Ort verwalten
- Fragen suchen, filtern, bearbeiten, importieren und exportieren
- Arbeit direkt in der App oder in Excel möglich

### Weiterbildungsgänge
- Pro Weiterbildungsgang 6 Semester verwalten
- Pro Semester immer 4 Module erfassen
- Jahr, Dozent/in und Kursname pflegen
- Normale und kompakte Semesteransicht verfügbar

### Prüfung erstellen
- Weiterbildungsgang auswählen
- Relevante Module auswählen
- Fragen werden automatisch passend zusammengestellt
- Danach kann die Prüfung exportiert, gespeichert oder weiterbearbeitet werden

### Export & Download
- Prüfung als TXT exportieren
- Prüfung als PDF drucken
- Fertige Prüfung speichern und direkt eine neue starten
- Gespeicherte Prüfungen später wieder öffnen und weiterbearbeiten

### Hilfe & Anleitung
- Testportal-Handbuch
- AIM Prüfungs-Manager-Handbuch
- Eigene Handbücher erstellen
- Handbücher mit Bildern exportieren und importieren

## Wo die Daten gespeichert werden

Die App speichert die Daten lokal auf diesem Computer:

- **Mac:** `~/Library/Application Support/AIM Pruefungs-Manager/`
- **Windows:** `%APPDATA%\AIM Pruefungs-Manager\`

Das bedeutet:
- Die Daten sind automatisch gespeichert
- Die Daten sind nicht automatisch auf anderen Geräten
- Für Austausch oder Sicherung sollte immer `Datensicherung` verwendet werden
- Bei einem App-Update bleiben die Daten unverändert erhalten

## Datensicherung

In der App gibt es im Dashboard den Bereich `Datensicherung`.

Dort kann man:
- `💾 Jetzt sichern`
- `↑ JSON laden`
- `↓ JSON exportieren`
- `↓ Excel exportieren`
- `↑ Excel importieren`

Die Backups enthalten:
- Fragen
- Weiterbildungsgänge
- Semesteransicht
- gespeicherte Prüfungen
- aktuelle offene Prüfung

## Leere Startdateien

Im Projekt liegen zwei leere Startdateien:
- `AIM_Leervorlage.json`
- `AIM_Leervorlage.xlsx`

Diese Dateien sind dafür gedacht, die App leer zu starten oder eine neue Datenbasis über `Datensicherung` zu importieren.

## Empfohlener einfacher Ablauf
1. App starten
2. Falls nötig leere Vorlage importieren
3. Fragen Datenbank pflegen
4. Weiterbildungsgänge pflegen
5. Prüfung erstellen
6. Prüfung speichern oder exportieren
7. Regelmässig Backup machen

---

## Für Entwickler

Dieser Abschnitt ist nur relevant, wenn du die App selbst aus dem Quellcode bauen möchtest oder zur Entwicklung beitragen willst. **End-Nutzer:innen brauchen das nicht** — die fertige App ist auf der Releases-Seite verfügbar.

### Voraussetzungen
- [Node.js](https://nodejs.org) (LTS-Version)
- Git
- Für Mac-Builds: macOS mit Xcode Command Line Tools
- Für Icon-Regeneration: `rsvg-convert` und `imagemagick` (z. B. via `brew install librsvg imagemagick`)

### Dev-Setup
```bash
git clone git@github.com:Dr-Sparks/Question-Manager-AIM.git
cd Question-Manager-AIM
npm install
```

### Entwicklung
```bash
npm run dev             # Vite Dev-Server unter http://localhost:5173
npm run start:electron  # Electron-Hülle gegen den gebauten dist/
npm test                # Unit-Tests
```

### Release-Builds
```bash
npm run build:web    # Nur das Web-Bundle
npm run build:mac    # Mac DMG (Apple Silicon)
npm run build:win    # Windows NSIS Installer (x64)
```

Die fertigen Dateien landen im Ordner `release/`.

### Veröffentlichen
Releases werden automatisch über GitHub Actions gebaut, sobald ein Tag im Format `v*.*.*` gepusht wird:

```bash
# Version in package.json anpassen, dann
git tag v1.2.3
git push --tags
```

Das CI-Setup baut Mac + Windows parallel und hängt die Artefakte als **Draft-Release** an den Tag. Im GitHub Releases-Tab dann auf `Edit` → Release Notes ergänzen → `Publish release`. Sobald veröffentlicht, finden alle laufenden Apps die neue Version beim nächsten Auto-Check.

### Smoke-Test vor Release
Siehe [`TESTING.md`](TESTING.md). Wird vor jedem Release vollständig am gebauten `.dmg` / `.exe` durchgegangen.

### Fallback: ohne fertige App starten
Diesen Weg nur verwenden, wenn keine fertige App-Datei vorhanden ist und Node.js bereits installiert ist:

- **Mac:** `scripts/dev/start-mac.command` doppelklicken
- **Windows:** `scripts/dev/start-windows.bat` doppelklicken

Browser öffnet sich automatisch unter `http://localhost:5173`. Daten werden im Browser gespeichert und sind nicht mit der Desktop-App-Datenbank kompatibel.
