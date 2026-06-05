# Testportal-Anleitung — Videos ablegen

Hier kommen die kurzen **Loop-Videos** (wie GIFs) für die Testportal-Anleitung hinein.
Jedes Video gehört zu genau einem Schritt der Anleitung. Lege einfach eine Datei mit dem
passenden Namen in **diesen Ordner** und baue die App neu — fertig. Fehlt ein Video, zeigt
die Anleitung automatisch einen sauberen „Video folgt“-Platzhalter (die App bleibt also immer
funktionsfähig).

## Format

- **`.mp4`** (empfohlen, H.264) **oder `.webm`**. Keine echten `.gif` — MP4 ist 10–50× kleiner
  und sieht besser aus. Die Videos werden ohne Ton, automatisch und in Endlosschleife abgespielt
  (wie ein GIF), also bitte **ohne Ton** aufnehmen.
- Empfohlen: Bildschirmaufnahme im **Querformat** (z. B. 1280×720 oder 1680×880), **5–15 Sekunden**,
  nur der relevante Ausschnitt mit dem Klick.
- Bitte **keine echten Zugangsdaten** im Login-Video sichtbar lassen.

## Dateinamen (genau so benennen)

| Datei                          | Schritt der Anleitung |
|--------------------------------|-----------------------|
| `01-login.mp4`                 | Schritt 1 — Bei Testportal anmelden |
| `02-startseite.mp4`            | Schritt 2 — Startseite „My tests“ verstehen |
| `03-import.mp4`                | Schritt 3 — Fragen aus dem AIM Prüfungs-Manager importieren |
| `04-konfiguration.mp4`         | Schritt 4 — Überblick der Konfigurationsseite |
| `04a-basic-settings.mp4`       | Schritt 4 — Basic settings (Name & Beschreibung) |
| `04b-questions-manager.mp4`    | Schritt 4 — Questions manager (Fragen kontrollieren) |
| `04c-test-sets.mp4`            | Schritt 4 — Test sets (Varianten) |
| `04d-test-access.mp4`          | Schritt 4 — Test access (Zugang) |
| `04e-test-start-page.mp4`      | Schritt 4 — Test start page (Begrüßungsseite) |
| `04f-grading-summary.mp4`      | Schritt 4 — Grading & summary (Punkte & Bestehensgrenze) |
| `04g-time-settings.mp4`        | Schritt 4 — Time settings (Zeit & Termin) |
| `05-durchfuehrung.mp4`         | Schritt 5 — Überblick aktivieren & durchführen |
| `05a-respondent-monitoring.mp4`| Schritt 5 — Respondent monitoring |
| `05b-results-table.mp4`        | Schritt 5 — Results table |
| `05c-test-sheets-review.mp4`   | Schritt 5 — Test sheets review |
| `05d-answers-review.mp4`       | Schritt 5 — Answers review |
| `05e-statistics.mp4`           | Schritt 5 — Statistics |
| `05f-unused-codes.mp4`         | Schritt 5 — Unused codes |
| `06-test-erneut-starten.mp4`   | Schritt 6 — Beendeten Test erneut starten |

> Hinweis: *Certificate template* aus Testportal wird bewusst nicht behandelt — AIM braucht es nicht.

## Wie es technisch funktioniert (für Entwickler)

`src/AnleitungPage.jsx` sammelt alle Dateien hier per `import.meta.glob(...)` beim Build ein.
Vite bündelt sie und liefert **relative** Asset-URLs (`base: "./"` in `vite.config.js`), damit sie
in der Electron-App über `file://` laden. Neuer/umbenannter Clip → einfach `npm run build`
(bzw. Release-Build). Es ist **keine** Code-Änderung nötig, solange die Dateinamen oben stimmen.
