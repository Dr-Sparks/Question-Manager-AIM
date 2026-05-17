// Auto-update orchestrator. Wraps electron-updater so main.cjs stays focused
// on window lifecycle. All renderer-facing state is normalised to a single
// object: { state, info?, error?, progress? } sent on channel "aim:update-status".
//
// Platform behaviour:
//   - Windows: NSIS in-place auto-update. Detect -> auto-download -> banner
//     "Jetzt aktualisieren" -> quitAndInstall.
//   - Mac (unsigned): Squirrel.Mac REQUIRES a stable code-signing identity
//     across versions to apply in-place updates. Ad-hoc signed builds fail
//     validation because each build's CDHash differs. So on Mac we:
//       * detect the update (autoDownload=false to skip the wasted ZIP fetch)
//       * show a banner with "Neue Version herunterladen"
//       * the button opens the stable DMG URL in the system browser
//       * user downloads + drags new .app to /Applications manually
//     Same friction as the initial install. When the app gets a real Apple
//     Developer ID, flip MAC_IN_PLACE_UPDATE to true and this regresses to
//     the Windows-style flow.

const path = require("path");
const { app, dialog, ipcMain, BrowserWindow, shell } = require("electron");

const CHANNEL = "aim:update-status";
const IS_MAC = process.platform === "darwin";

// Set to true once we have a Developer ID and have re-enabled `hardenedRuntime`
// + `identity` in package.json's build.mac config.
const MAC_IN_PLACE_UPDATE = false;

// Stable per-platform download URLs (always resolve to the latest release).
const DOWNLOAD_URLS = {
  darwin:
    "https://github.com/Dr-Sparks/Question-Manager-AIM/releases/latest/download/AIM-Pruefungs-Manager-mac-arm64.dmg",
  win32:
    "https://github.com/Dr-Sparks/Question-Manager-AIM/releases/latest/download/AIM-Pruefungs-Manager-win-x64.exe",
};

let bound = false;
let updater = null;

function getUpdater() {
  if (updater) return updater;
  // Require lazily — electron-updater is large and not needed until ready.
  const { autoUpdater } = require("electron-updater");
  const log = require("electron-log");
  log.transports.file.level = "info";
  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath("userData"), "logs", "main.log");
  autoUpdater.logger = log;

  // Don't auto-download on Mac when we'll just ship the user to the browser.
  autoUpdater.autoDownload = !IS_MAC || MAC_IN_PLACE_UPDATE;
  autoUpdater.autoInstallOnAppQuit = false; // we always ask the user first

  // In dev, electron-updater needs a feed file to test against. The file is
  // gitignored. Without it, dev sessions just skip the check silently.
  if (!app.isPackaged) {
    const devFeed = path.join(__dirname, "..", "dev-app-update.yml");
    try {
      autoUpdater.updateConfigPath = devFeed;
    } catch {
      // not fatal — checks will just no-op in dev
    }
  }
  updater = autoUpdater;
  return updater;
}

function broadcast(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNEL, payload);
    }
  }
}

// Errors that mean "there's no release to update to yet" or "no internet" —
// benign noise on fresh installs / offline machines. Swallowed so a user
// opening a brand-new install isn't greeted by a scary red banner.
const BENIGN_ERROR_PATTERNS = [
  /no published versions/i,
  /Cannot find latest\.yml/i,
  /HttpError: 404/i,
  /ENOTFOUND/i, // offline
  /getaddrinfo ENOTFOUND/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
  /net::ERR_NETWORK_CHANGED/i, // transient network blip
];

function isBenignError(err) {
  const message = err?.message || String(err || "");
  return BENIGN_ERROR_PATTERNS.some((rx) => rx.test(message));
}

function bindUpdaterEvents() {
  if (bound) return;
  bound = true;
  const au = getUpdater();
  au.on("checking-for-update", () => broadcast({ state: "checking" }));
  au.on("update-available", (info) => broadcast({ state: "available", info }));
  au.on("update-not-available", (info) =>
    broadcast({ state: "not-available", info })
  );
  au.on("download-progress", (progress) =>
    broadcast({ state: "downloading", progress })
  );
  au.on("update-downloaded", (info) =>
    broadcast({ state: "downloaded", info })
  );
  au.on("error", (err) => {
    if (isBenignError(err)) {
      // Still logged via electron-log but the user isn't bothered.
      return;
    }
    broadcast({
      state: "error",
      error: { message: err?.message || String(err) },
    });
  });
}

function bindIpc() {
  ipcMain.handle("aim:get-version", () => app.getVersion());
  ipcMain.handle("aim:get-platform", () => process.platform);

  ipcMain.handle("aim:check-for-updates", async () => {
    try {
      bindUpdaterEvents();
      await getUpdater().checkForUpdates();
    } catch (err) {
      broadcast({
        state: "error",
        error: { message: err?.message || String(err) },
      });
    }
  });

  ipcMain.handle("aim:quit-and-install", async () => {
    try {
      getUpdater().quitAndInstall(false, true);
    } catch (err) {
      broadcast({
        state: "error",
        error: { message: err?.message || String(err) },
      });
    }
  });

  // Mac (and any platform we ever fall back) — open the stable DMG/EXE URL
  // in the system browser so the user can download + replace manually.
  ipcMain.handle("aim:open-download-url", async () => {
    const url = DOWNLOAD_URLS[process.platform];
    if (!url) return false;
    try {
      await shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  });
}

// Public: start a check (used on launch and from the native menu)
async function checkForUpdates({ silentIfNone = true } = {}) {
  try {
    bindUpdaterEvents();
    const result = await getUpdater().checkForUpdates();
    if (
      !silentIfNone &&
      (!result ||
        !result.updateInfo ||
        result.updateInfo.version === app.getVersion())
    ) {
      dialog.showMessageBox({
        type: "info",
        title: "Keine Aktualisierung",
        message: "Du verwendest bereits die neueste Version.",
        detail: `Version ${app.getVersion()}`,
        buttons: ["OK"],
      });
    }
  } catch (err) {
    if (!silentIfNone && !isBenignError(err)) {
      dialog.showMessageBox({
        type: "error",
        title: "Update-Pruefung fehlgeschlagen",
        message: "Pruefung auf Updates ist fehlgeschlagen.",
        detail: err?.message || String(err),
        buttons: ["OK"],
      });
    }
  }
}

function initUpdater() {
  bindIpc();
  bindUpdaterEvents();
}

module.exports = { initUpdater, checkForUpdates };
