@echo off
chcp 65001 > nul
title AIM Pruefungs-Manager

:: In den Ordner des Skripts wechseln (funktioniert von jedem Speicherort)
cd /d "%~dp0"

echo.
echo   ██████ AIM Pruefungs-Manager
echo   ──────────────────────────────────────
echo.

:: ── Node.js prüfen ────────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo   FEHLER: Node.js ist nicht installiert.
  echo.
  echo   Bitte Node.js installieren unter:
  echo   https://nodejs.org
  echo.
  echo   Lade die Version mit der Aufschrift "LTS" herunter,
  echo   installiere sie wie ein normales Programm und
  echo   starte danach dieses Skript erneut.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

:: ── Abhaengigkeiten beim ersten Start installieren ────────────────────────────
if not exist "node_modules" (
  echo   Erste Einrichtung - wird nur einmalig durchgefuehrt...
  npm install --silent
  echo   Einrichtung abgeschlossen.
  echo.
)

echo   App wird gestartet...
echo   Der Browser oeffnet sich automatisch sobald die App bereit ist.
echo   Falls kein Browser aufgeht: http://localhost:5173
echo   Zum Beenden: Dieses Fenster schliessen.
echo.

:: Browser erst oeffnen, wenn der Server wirklich erreichbar ist
start /b powershell -NoProfile -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "for($i=0;$i -lt 45;$i++){" ^
  "  try { Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing | Out-Null; Start-Process 'http://localhost:5173'; exit 0 } catch { Start-Sleep -Seconds 1 }" ^
  "}"

:: Server starten
npm run dev -- --host localhost --strictPort --port 5173
