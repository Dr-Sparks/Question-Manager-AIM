#!/bin/bash
# AIM Prüfungs-Manager — Mac Starter

# Node.js Pfade für gängige Installationen
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; fi

# Ordner und Name des Projekts ermitteln
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FOLDER_NAME="$(basename "$SCRIPT_DIR")"

echo ""
echo "  ██████ AIM Prüfungs-Manager"
echo "  ──────────────────────────────────────"
echo ""

# ── macOS blockiert Start vom Desktop/Downloads — automatisch verschieben ──
if [[ "$SCRIPT_DIR" == "$HOME/Desktop"* ]] || [[ "$SCRIPT_DIR" == "$HOME/Downloads"* ]]; then
  DEST="$HOME/Documents/$FOLDER_NAME"
  echo "  ⚠️  macOS blockiert den Start vom Desktop oder Downloads."
  echo "      Der Ordner wird einmalig nach Dokumente verschoben..."
  echo ""
  rm -rf "$DEST"
  cp -r "$SCRIPT_DIR" "$DEST"
  chmod +x "$DEST/start-mac.command"
  echo "  ✅  Verschoben nach: Dokumente/$FOLDER_NAME"
  echo "      Ein neues Fenster öffnet sich automatisch..."
  echo ""
  open "$DEST/start-mac.command"
  exit 0
fi

cd "$SCRIPT_DIR"

# ── Node.js prüfen ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  ❌  Node.js ist nicht installiert."
  echo ""
  echo "      Bitte Node.js installieren unter:"
  echo "      👉  https://nodejs.org"
  echo ""
  echo "      Lade die Version mit der Aufschrift «LTS» herunter,"
  echo "      installiere sie wie ein normales Programm und"
  echo "      starte danach dieses Skript erneut."
  echo ""
  open "https://nodejs.org"
  read -p "  Drücke Enter zum Beenden..."
  exit 1
fi

# ── Abhängigkeiten beim ersten Start installieren ─────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "  ⏳  Erste Einrichtung — wird nur einmalig durchgeführt..."
  npm install --silent
  echo "  ✅  Einrichtung abgeschlossen."
  echo ""
fi

echo "  🚀  App wird gestartet..."
echo "      Der Browser öffnet sich automatisch, sobald die App bereit ist."
echo "      Falls kein Browser aufgeht: http://localhost:5173"
echo "      Zum Beenden: Dieses Fenster schliessen."
echo ""

# Browser erst öffnen, wenn der Server wirklich erreichbar ist
(
  for i in {1..45}; do
    if curl -fsS "http://localhost:5173" >/dev/null 2>&1; then
      open -a "Safari" "http://localhost:5173"
      exit 0
    fi
    sleep 1
  done
  echo ""
  echo "  ⚠️  Der Browser konnte nicht automatisch geöffnet werden."
  echo "      Bitte öffne manuell: http://localhost:5173"
  echo ""
) &

npm run dev -- --host localhost --strictPort --port 5173
